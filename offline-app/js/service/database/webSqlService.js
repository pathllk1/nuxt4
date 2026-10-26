// service/webSqlService.js - SQLite 3 WebAssembly (sql.js) with Direct Physical SQLite File Persistence
(function (global) {
  'use strict';

  class WebSqlService {
    constructor() {
      this.isNative = false;
      this.isReady = false;
      this.db = null;
      this.SQL = null;
      this.isDirty = false;
      this.autoSaveTimer = null;
      this._initPromise = null;
      this._queryChain = Promise.resolve();
    }

    /**
     * Initializes sql.js WebAssembly engine and loads physical SQLite database from /api/db
     * Singleton guaranteed: Concurrent calls await the same initialization promise.
     */
    init() {
      if (this.isReady && this.db) {
        return Promise.resolve({
          isNative: false,
          engine: 'SQLite 3 (sql.js WebAssembly Engine)'
        });
      }

      if (this._initPromise) {
        return this._initPromise;
      }

      this._initPromise = (async () => {
        try {
          // Remove any leftover IndexedDB databases from prior versions
          try {
            if (typeof indexedDB !== 'undefined') {
              indexedDB.deleteDatabase('erp_sqlite_db');
              indexedDB.deleteDatabase('erp_inventory_websql_db');
            }
          } catch (_) {}

          await this._waitForInitSqlJs();

          console.info('[SQLite] Initializing sql.js WebAssembly engine...');
          this.SQL = await window.initSqlJs({
            locateFile: (file) => `./vendor/${file}`
          });

          // Load physical database.sqlite directly from server endpoint /api/db
          let savedBinary = null;
          try {
            const resp = await fetch('/api/db', { cache: 'no-store' });
            if (resp.ok) {
              const buf = await resp.arrayBuffer();
              if (buf && buf.byteLength > 0) {
                savedBinary = new Uint8Array(buf);
                console.info(`[SQLite] Loaded physical database.sqlite from disk (${(savedBinary.length / 1024).toFixed(1)} KB)`);
              }
            }
          } catch (e) {
            console.warn('[SQLite] Could not fetch /api/db:', e);
          }

          if (savedBinary && savedBinary.length > 0) {
            console.info(`[SQLite] Initializing database (${(savedBinary.length / 1024).toFixed(1)} KB)`);
            this.db = new this.SQL.Database(savedBinary);
            this._createTables();

            // Auto-seed demo firm (GST OFF) and demo stocks if missing
            let stockCount = 0;
            let firmCount = 0;
            try {
              const sc = this.db.exec('SELECT COUNT(*) FROM stocks');
              if (sc.length && sc[0].values.length) stockCount = sc[0].values[0][0];
              const fc = this.db.exec('SELECT COUNT(*) FROM firm_settings');
              if (fc.length && fc[0].values.length) firmCount = fc[0].values[0][0];
            } catch (_) {}

            if (stockCount === 0 || firmCount === 0) {
              console.info(`[SQLite] Missing seed data (stocks: ${stockCount}, firm: ${firmCount}). Seeding demo data now...`);
              await this.seedDemoData(true);
            }
          } else {
            console.info('[SQLite] Creating fresh SQLite database...');
            this.db = new this.SQL.Database();
            this._createTables();
            await this.seedDemoData(true);
            await this.persist();
          }

          // Register lifecycle hooks to flush any pending writes
          if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => this.flushSync());
            window.addEventListener('pagehide', () => this.flushSync());
          }

          this.isReady = true;
          return {
            isNative: false,
            engine: 'SQLite 3 (sql.js WebAssembly Engine)'
          };
        } catch (err) {
          this._initPromise = null;
          console.error('[SQLite] Initialization failed:', err);
          throw err;
        }
      })();

      return this._initPromise;
    }

    /**
     * Wait for window.initSqlJs to become available if scripts load asynchronously
     */
    async _waitForInitSqlJs(maxWaitMs = 10000) {
      const startTime = Date.now();
      while (typeof window.initSqlJs !== 'function') {
        if (Date.now() - startTime > maxWaitMs) {
          throw new Error('Timeout waiting for window.initSqlJs. Check if vendor/sql-wasm.js is loaded.');
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    /**
     * Debounced auto-save to persist changes directly to physical database.sqlite on disk
     */
    _scheduleAutoSave() {
      this.isDirty = true;
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
      }
      this.autoSaveTimer = setTimeout(() => {
        this.persist().catch((err) => console.error('[SQLite] Auto-save error:', err));
      }, 150);
    }

    /**
     * Persist current SQLite database to disk via /api/db
     */
    async persist() {
      if (!this.db) return;
      try {
        const binary = this.db.export();
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: binary
        });
        this.isDirty = false;
      } catch (err) {
        console.error('[SQLite] Persist failed:', err);
      }
    }

    /**
     * Synchronous flush for window unload / pagehide
     */
    flushSync() {
      if (!this.isDirty || !this.db) return;
      try {
        const binary = this.db.export();
        const blob = new Blob([binary], { type: 'application/octet-stream' });
        navigator.sendBeacon('/api/db', blob);
        this.isDirty = false;
      } catch (err) {
        console.warn('[SQLite] Synchronous flush error:', err);
      }
    }

    /**
     * Standard executeSql compatible with existing WebSqlService interface
     * Serialized execution queue guarantees safe operation against the single WASM instance
     * Returns: { insertId: number|null, rowsAffected: number, rows: Array<Object> }
     */
    async executeSql(sql, params = []) {
      await this.init();

      return new Promise((resolve, reject) => {
        this._queryChain = this._queryChain.then(() => {
          try {
            const res = this._executeInternal(sql, params);
            resolve(res);
          } catch (err) {
            reject(err);
          }
        });
      });
    }

    /**
     * Synchronous query execution inside the serialized queue
     */
    _executeInternal(sql, params = []) {
      if (!sql || !sql.trim()) {
        return { insertId: null, rowsAffected: 0, rows: [] };
      }

      const cleanSql = sql.trim().replace(/;+$/, '');
      const normalizedParams = (params || []).map((p) => {
        if (p === undefined) return null;
        if (typeof p === 'boolean') return p ? 1 : 0;
        if (typeof p === 'object' && p !== null) return JSON.stringify(p);
        return p;
      });

      const isSelect = /^\s*(SELECT|PRAGMA|EXPLAIN)\b/i.test(cleanSql);
      const isInsert = /^\s*INSERT\s+INTO\b/i.test(cleanSql);

      try {
        // SELECT / PRAGMA Queries
        if (isSelect) {
          const stmt = this.db.prepare(cleanSql);
          if (normalizedParams.length > 0) {
            stmt.bind(normalizedParams);
          }
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return { insertId: null, rowsAffected: 0, rows };
        }

        // INSERT Queries
        if (isInsert) {
          const stmt = this.db.prepare(cleanSql);
          if (normalizedParams.length > 0) {
            stmt.bind(normalizedParams);
          }
          stmt.step();
          stmt.free();

          const rowsAffected = this.db.getRowsModified();
          let insertId = null;
          try {
            const idRes = this.db.exec('SELECT last_insert_rowid() AS id');
            if (idRes && idRes.length > 0 && idRes[0].values && idRes[0].values.length > 0) {
              insertId = idRes[0].values[0][0];
            }
          } catch (_) {}

          this._scheduleAutoSave();
          return { insertId, rowsAffected, rows: [] };
        }

        // UPDATE / DELETE / CREATE / ALTER / DROP Queries
        const stmt = this.db.prepare(cleanSql);
        if (normalizedParams.length > 0) {
          stmt.bind(normalizedParams);
        }
        stmt.step();
        stmt.free();

        const rowsAffected = this.db.getRowsModified();
        this._scheduleAutoSave();
        return { insertId: null, rowsAffected, rows: [] };
      } catch (err) {
        // Fallback for multi-statement queries (e.g. from SQL console)
        try {
          const results = this.db.exec(cleanSql);
          const rows = [];
          if (results && results.length > 0) {
            const last = results[results.length - 1];
            const { columns, values } = last;
            for (const v of values) {
              const obj = {};
              for (let i = 0; i < columns.length; i++) {
                obj[columns[i]] = v[i];
              }
              rows.push(obj);
            }
          }
          this._scheduleAutoSave();
          return { insertId: null, rowsAffected: this.db.getRowsModified(), rows };
        } catch (multiErr) {
          console.error('[SQLite] Query execution error:', err.message, '\nSQL:', cleanSql);
          throw err;
        }
      }
    }

    /**
     * Alias for executeSql
     */
    execute(sql, params = []) {
      return this.executeSql(sql, params);
    }

    /**
     * Transaction wrapper for backward compatibility
     */
    transaction(callback) {
      const tx = {
        executeSql: (sql, params = [], success, error) => {
          this.executeSql(sql, params)
            .then((resultSet) => {
              if (typeof success === 'function') success(tx, resultSet);
            })
            .catch((err) => {
              if (typeof error === 'function') error(tx, err);
            });
        }
      };
      callback(tx);
    }

    /**
     * Export SQLite database as binary Uint8Array
     */
    exportDatabase() {
      if (!this.db) throw new Error('Database is not initialized');
      return this.db.export();
    }

    /**
     * Download SQLite backup file directly in the browser
     */
    downloadDatabase(filename = 'accounting_erp_backup.sqlite') {
      const binary = this.exportDatabase();
      const blob = new Blob([binary], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    /**
     * Import and replace current SQLite database from Uint8Array
     */
    async importDatabase(uint8Array) {
      await this.init();
      if (this.db) {
        this.db.close();
      }
      this.db = new this.SQL.Database(uint8Array);
      await this.persist();
      return true;
    }

    /**
     * Seeds realistic demo firm (GST OFF) and industrial demo stock items
     */
    async seedDemoData(force = false) {
      if (!this.db) return false;

      if (!force) {
        try {
          const sc = this.db.exec('SELECT COUNT(*) FROM stocks');
          const fc = this.db.exec('SELECT COUNT(*) FROM firm_settings');
          const scCount = (sc.length && sc[0].values.length) ? sc[0].values[0][0] : 0;
          const fcCount = (fc.length && fc[0].values.length) ? fc[0].values[0][0] : 0;
          if (scCount > 0 && fcCount > 0) {
            console.info('[SQLite] Demo data already exists, skipping.');
            return false;
          }
        } catch (_) {}
      }

      console.info('[SQLite] Seeding demo firm (GST OFF) and 8 demo stock items...');
      const seedSql = ``;

      try {
        this.db.exec(seedSql);
        await this.persist();
        console.info('[SQLite] Demo data seeded successfully.');
        return true;
      } catch (err) {
        console.error('[SQLite] Demo seed error:', err);
        return false;
      }
    }

    /**
     * Schema Creation matching Nuxt 4 & accounting ERP specifications
     */
    _createTables() {
      const schemaSql = `
        CREATE TABLE IF NOT EXISTS stocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item TEXT NOT NULL,
          pno TEXT,
          oem TEXT,
          hsn TEXT,
          qty REAL DEFAULT 0,
          uom TEXT DEFAULT 'PCS',
          rate REAL DEFAULT 0,
          cost_rate REAL DEFAULT 0,
          grate REAL DEFAULT 18,
          total REAL DEFAULT 0,
          mrp REAL DEFAULT 0,
          min_qty REAL DEFAULT 5,
          batch TEXT DEFAULT '',
          batches TEXT DEFAULT '[]',
          user TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS parties (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          gstin TEXT DEFAULT 'UNREGISTERED',
          contact TEXT,
          state TEXT DEFAULT 'Maharashtra',
          stateCode TEXT DEFAULT '27',
          address TEXT,
          pin TEXT,
          pan TEXT,
          gstLocations TEXT DEFAULT '[]',
          partyType TEXT NOT NULL DEFAULT 'CUSTOMER',
          openingBalance REAL DEFAULT 0,
          balanceType TEXT DEFAULT 'CR',
          currentBalance REAL DEFAULT 0,
          bankName TEXT,
          accountNumber TEXT,
          ifscCode TEXT,
          branchName TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bno TEXT NOT NULL UNIQUE,
          bdate TEXT NOT NULL,
          btype TEXT NOT NULL,
          billSubtype TEXT,
          invoiceMode TEXT DEFAULT 'INVENTORY',
          partyId INTEGER,
          partyName TEXT NOT NULL,
          partyGstin TEXT,
          partyAddress TEXT,
          partyState TEXT,
          partyStateCode TEXT,
          partyPin TEXT,
          firmGstin TEXT,
          firmState TEXT,
          firmStateCode TEXT,
          grossTotal REAL DEFAULT 0,
          taxableTotal REAL DEFAULT 0,
          cgst REAL DEFAULT 0,
          sgst REAL DEFAULT 0,
          igst REAL DEFAULT 0,
          cess REAL DEFAULT 0,
          roundOff REAL DEFAULT 0,
          netTotal REAL NOT NULL,
          reverseCharge INTEGER DEFAULT 0,
          supplierBillNo TEXT,
          orderNo TEXT,
          vehicleNo TEXT,
          dispatchThrough TEXT,
          narration TEXT,
          refBillId INTEGER,
          refBillNo TEXT,
          status TEXT DEFAULT 'ACTIVE',
          consigneeName TEXT,
          consigneeGstin TEXT,
          consigneeAddress TEXT,
          consigneeState TEXT,
          consigneePin TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bill_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          billId INTEGER NOT NULL,
          stockId INTEGER,
          item TEXT NOT NULL,
          hsn TEXT,
          qty REAL NOT NULL,
          uom TEXT DEFAULT 'PCS',
          rate REAL NOT NULL,
          grate REAL DEFAULT 18,
          disc REAL DEFAULT 0,
          taxable REAL NOT NULL,
          total REAL NOT NULL,
          cgst REAL DEFAULT 0,
          sgst REAL DEFAULT 0,
          igst REAL DEFAULT 0,
          batch TEXT,
          itemType TEXT DEFAULT 'GOODS',
          narration TEXT
        );

        CREATE TABLE IF NOT EXISTS stock_reg (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          bno TEXT,
          bdate TEXT,
          supply TEXT,
          item_type TEXT DEFAULT 'GOODS',
          item TEXT NOT NULL,
          item_narration TEXT,
          batch TEXT,
          hsn TEXT,
          qty REAL NOT NULL,
          uom TEXT DEFAULT 'PCS',
          rate REAL DEFAULT 0,
          grate REAL DEFAULT 0,
          disc REAL DEFAULT 0,
          total REAL DEFAULT 0,
          cost_rate REAL DEFAULT 0,
          stock_id INTEGER,
          stockId INTEGER,
          bill_id INTEGER,
          partyName TEXT,
          qtyh REAL NOT NULL,
          timestamp TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          details TEXT,
          timestamp TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS firm_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          legal_name TEXT,
          code TEXT,
          description TEXT,
          phone_number TEXT,
          secondary_phone TEXT,
          email TEXT,
          website TEXT,
          business_type TEXT DEFAULT 'Private Limited',
          industry_type TEXT,
          establishment_year INTEGER,
          employee_count INTEGER DEFAULT 0,
          registration_number TEXT,
          registration_date TEXT,
          cin_number TEXT,
          pan_number TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          country TEXT DEFAULT 'India',
          pincode TEXT,
          bank_name TEXT,
          bank_account_number TEXT,
          bank_branch TEXT,
          ifsc_code TEXT,
          payment_terms TEXT,
          currency TEXT DEFAULT 'INR',
          locations TEXT DEFAULT '[]',
          gst_enabled INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bank_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_name TEXT NOT NULL,
          account_holder_name TEXT,
          bank_name TEXT NOT NULL,
          branch_name TEXT,
          account_number TEXT NOT NULL,
          ifsc_code TEXT NOT NULL,
          account_type TEXT DEFAULT 'CURRENT',
          upi_id TEXT,
          notes TEXT,
          opening_balance REAL DEFAULT 0,
          balance_type TEXT DEFAULT 'DR',
          current_balance REAL DEFAULT 0,
          is_default INTEGER DEFAULT 0,
          status TEXT DEFAULT 'ACTIVE',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chart_of_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_name TEXT NOT NULL UNIQUE,
          account_type TEXT NOT NULL,
          bs_classification TEXT,
          description TEXT,
          pan TEXT,
          gstin TEXT,
          phone TEXT,
          is_system INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transactionDate TEXT NOT NULL,
          accountHead TEXT NOT NULL,
          accountType TEXT NOT NULL,
          debitAmount REAL DEFAULT 0,
          creditAmount REAL DEFAULT 0,
          narration TEXT,
          voucherGroupId TEXT NOT NULL,
          voucherNo TEXT NOT NULL,
          voucherType TEXT NOT NULL,
          refType TEXT DEFAULT 'VOUCHER',
          refId INTEGER,
          partyId INTEGER,
          bankAccountId INTEGER,
          stockId INTEGER,
          stockRegId INTEGER,
          paymentMode TEXT,
          createdBy TEXT DEFAULT 'Admin',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS voucher_sequences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voucherType TEXT NOT NULL,
          financialYear TEXT NOT NULL,
          currentSequence INTEGER DEFAULT 0,
          UNIQUE(voucherType, financialYear)
        );

        CREATE TABLE IF NOT EXISTS period_locks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lockDate TEXT NOT NULL,
          reason TEXT,
          lockedBy TEXT DEFAULT 'Admin',
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_bill_items_billId ON bill_items(billId);
        CREATE INDEX IF NOT EXISTS idx_stock_reg_stock_id ON stock_reg(stock_id);
        CREATE INDEX IF NOT EXISTS idx_bills_partyId ON bills(partyId);
        CREATE INDEX IF NOT EXISTS idx_bills_bno ON bills(bno);
        CREATE INDEX IF NOT EXISTS idx_ledger_voucherGroupId ON ledger(voucherGroupId);
        CREATE INDEX IF NOT EXISTS idx_ledger_voucherNo ON ledger(voucherNo);
        CREATE INDEX IF NOT EXISTS idx_ledger_transactionDate ON ledger(transactionDate);
        CREATE INDEX IF NOT EXISTS idx_ledger_accountHead ON ledger(accountHead);
        CREATE INDEX IF NOT EXISTS idx_ledger_partyId ON ledger(partyId);
        CREATE INDEX IF NOT EXISTS idx_ledger_bankAccountId ON ledger(bankAccountId);
        CREATE INDEX IF NOT EXISTS idx_coa_account_name ON chart_of_accounts(account_name);
      `;

      this.db.exec(schemaSql);

      // Safe column migration for stock_reg to guarantee both stock_id and stockId are supported
      try {
        const tableInfo = this.db.exec("PRAGMA table_info(stock_reg);");
        if (tableInfo && tableInfo[0] && tableInfo[0].values) {
          const colNames = tableInfo[0].values.map(c => c[1]);
          if (!colNames.includes('stockId')) {
            this.db.exec("ALTER TABLE stock_reg ADD COLUMN stockId INTEGER;");
          }
          if (!colNames.includes('stock_id')) {
            this.db.exec("ALTER TABLE stock_reg ADD COLUMN stock_id INTEGER;");
          }
        }
      } catch (migErr) {
        console.warn('[SQLite] Column migration notice for stock_reg:', migErr);
      }

      // Safe initialization of default COA & bank account if database is existing
      try {
        const coaCountRes = this.db.exec("SELECT COUNT(*) FROM chart_of_accounts;");
        const count = (coaCountRes && coaCountRes[0] && coaCountRes[0].values) ? coaCountRes[0].values[0][0] : 0;
        if (count === 0) {
          const nowIso = new Date().toISOString();
          const defaultAccounts = [
            ['Cash in Hand', 'CASH', 'BALANCE_SHEET', 1],
            ['Sales', 'INCOME', 'PNL', 1],
            ['Purchases', 'EXPENSE', 'PNL', 1],
            ['Inventory', 'ASSET', 'BALANCE_SHEET', 1],
            ['COGS', 'EXPENSE', 'PNL', 1],
            ['Round Off', 'GENERAL', 'PNL', 1],
            ['Stock Adjustment', 'INCOME', 'PNL', 1],
            ['Capital Account', 'CAPITAL', 'BALANCE_SHEET', 1],
            ['Opening Balance', 'CAPITAL', 'BALANCE_SHEET', 1],
            ['Difference in Opening Balances', 'CAPITAL', 'BALANCE_SHEET', 1],
            ['CGST Input Credit', 'ASSET', 'BALANCE_SHEET', 1],
            ['SGST Input Credit', 'ASSET', 'BALANCE_SHEET', 1],
            ['IGST Input Credit', 'ASSET', 'BALANCE_SHEET', 1],
            ['Cess Input Credit', 'ASSET', 'BALANCE_SHEET', 1],
            ['CGST Payable', 'LIABILITY', 'BALANCE_SHEET', 1],
            ['SGST Payable', 'LIABILITY', 'BALANCE_SHEET', 1],
            ['IGST Payable', 'LIABILITY', 'BALANCE_SHEET', 1],
            ['Cess Payable', 'LIABILITY', 'BALANCE_SHEET', 1],
            ['TDS Payable u/s 194C', 'DUTIES_AND_TAXES', 'BALANCE_SHEET', 1],
            ['Salaries & Wages', 'EXPENSE', 'PNL', 1]
          ];
          for (const acc of defaultAccounts) {
            this.db.run("INSERT OR IGNORE INTO chart_of_accounts (account_name, account_type, bs_classification, is_system, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)", [acc[0], acc[1], acc[2], acc[3], nowIso, nowIso]);
          }
        }
      } catch (coaErr) {
        console.warn('[SQLite] COA initialization check notice:', coaErr);
      }
    }
  }

  const webSqlInstance = new WebSqlService();
  global.WebSqlService = webSqlInstance;
  global.webSqlService = webSqlInstance;
})(window);

