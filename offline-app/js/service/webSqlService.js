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
      const seedSql = `
        DELETE FROM firm_settings;
        INSERT INTO firm_settings (
          name, legal_name, code, description, phone_number, secondary_phone, email, website,
          business_type, industry_type, establishment_year, employee_count, registration_number,
          pan_number, address, city, state, country, pincode, bank_name, bank_account_number,
          bank_branch, ifsc_code, payment_terms, currency, locations, gst_enabled, created_at, updated_at
        ) VALUES (
          'Apex Industrial & Hardware Mart',
          'Apex Industrial & Hardware Mart LLP',
          'APEX-01',
          'Wholesale & Retail Distributor of Tools, Hardware, Bearings, and Safety Gear',
          '+91 98765 43210',
          '+91 98230 11223',
          'sales@apexhardware.demo',
          'https://apexhardware.demo',
          'Partnership / LLP',
          'Industrial & Hardware Supplies',
          2021,
          12,
          'REG-MH-2021-8841',
          'AAFAA1234K',
          'Plot 42, Sector 10, MIDC Industrial Area',
          'Pune',
          'Maharashtra',
          'India',
          '411018',
          'HDFC Bank',
          '50200012345678',
          'Pimpri MIDC Branch',
          'HDFC0001234',
          'Net 30 Days',
          'INR',
          '[]',
          0,
          datetime('now'),
          datetime('now')
        );

        DELETE FROM stocks;
        INSERT INTO stocks (id, item, pno, oem, hsn, qty, uom, rate, cost_rate, grate, total, mrp, min_qty, batches, user, created_at, updated_at) VALUES
        (1, 'Bosch Cordless Drill Driver 18V', 'GSR-18V-50', 'Bosch', '8467', 35, 'PCS', 4850.00, 3950.00, 0, 171500.00, 5800.00, 5, '[]', 'Admin', datetime('now'), datetime('now')),
        (2, 'Makita Angle Grinder 850W 100mm', 'M0900B', 'Makita', '8467', 48, 'PCS', 2650.00, 2150.00, 0, 127200.00, 3200.00, 10, '[]', 'Admin', datetime('now'), datetime('now')),
        (3, 'Stanley 46-Piece Metric Socket Set', 'STMT72794-8', 'Stanley', '8204', 28, 'SET', 1750.00, 1400.00, 0, 49000.00, 2250.00, 5, '[]', 'Admin', datetime('now'), datetime('now')),
        (4, 'Taparia Heavy Duty Bench Vice 6 Inch', 'BV-06-HD', 'Taparia', '8205', 15, 'PCS', 3800.00, 3100.00, 0, 57000.00, 4500.00, 3, '[]', 'Admin', datetime('now'), datetime('now')),
        (5, 'Fluke 101 Pocket Digital Multimeter', 'FLUKE-101', 'Fluke', '9030', 22, 'PCS', 3150.00, 2550.00, 0, 69300.00, 3850.00, 4, '[]', 'Admin', datetime('now'), datetime('now')),
        (6, 'Karam Safety Helmet Ratchet Type', 'SHEL-RT-WHT', 'Karam', '6506', 120, 'PCS', 340.00, 260.00, 0, 40800.00, 480.00, 20, '[]', 'Admin', datetime('now'), datetime('now')),
        (7, '3M Cut-Resistant Gloves Comfort Grip L', '3M-CG-L', '3M', '6116', 180, 'PAIR', 190.00, 140.00, 0, 34200.00, 270.00, 25, '[]', 'Admin', datetime('now'), datetime('now')),
        (8, 'SKF Deep Groove Ball Bearing 6205-2RS', '6205-2RS1', 'SKF', '8482', 95, 'PCS', 220.00, 165.00, 0, 20900.00, 295.00, 15, '[]', 'Admin', datetime('now'), datetime('now'));

        DELETE FROM stock_reg WHERE type = 'OPENING_BALANCE';
        INSERT INTO stock_reg (type, bno, bdate, supply, item_type, item, item_narration, batch, hsn, qty, uom, rate, grate, disc, total, cost_rate, stock_id, bill_id, partyName, qtyh, timestamp)
        SELECT 'OPENING_BALANCE', 'OB-2026-001', date('now'), 'INWARD', 'GOODS', item, 'Initial physical inventory audit', '', hsn, qty, uom, rate, grate, 0, total, cost_rate, id, NULL, 'Opening Stock Balance', qty, datetime('now')
        FROM stocks;

        INSERT INTO audit_log (action, details, timestamp) VALUES
        ('DEMO_INITIALIZATION', 'Seeded demo firm settings (GST OFF) and 8 demo stock items', datetime('now'));
      `;

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

        CREATE INDEX IF NOT EXISTS idx_bill_items_billId ON bill_items(billId);
        CREATE INDEX IF NOT EXISTS idx_stock_reg_stock_id ON stock_reg(stock_id);
        CREATE INDEX IF NOT EXISTS idx_bills_partyId ON bills(partyId);
        CREATE INDEX IF NOT EXISTS idx_bills_bno ON bills(bno);
      `;

      this.db.exec(schemaSql);
    }
  }

  const webSqlInstance = new WebSqlService();
  global.WebSqlService = webSqlInstance;
  global.webSqlService = webSqlInstance;
})(window);

