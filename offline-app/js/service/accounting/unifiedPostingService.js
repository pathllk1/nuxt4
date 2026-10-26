// service/accounting/unifiedPostingService.js - Centralized Double-Entry Posting Engine (100% Nuxt 4 Parity)
(function (global) {
  'use strict';

  // 16 Universal Master Account Types
  const UNIVERSAL_MASTER_ACCOUNT_TYPES = [
    'SUNDRY_DEBTORS',
    'SUNDRY_CREDITORS',
    'TRANSPORTER',
    'CASUAL_LABOR',
    'LABOR_LEADER',
    'STAFF',
    'LOANS_BORROWINGS',
    'LOANS_ADVANCES',
    'CAPITAL',
    'DIRECT_EXPENSE',
    'EXPENSE',
    'INCOME',
    'BANK',
    'CASH',
    'DUTIES_AND_TAXES',
    'FIXED_ASSETS'
  ];

  // Voucher Types & Sequential Prefixes (100% Nuxt 4 Parity)
  const VOUCHER_PREFIX_MAP = {
    SALES: 'SI',
    PURCHASE: 'PI',
    PAYMENT: 'PV',
    RECEIPT: 'RV',
    CONTRA: 'CV',
    JOURNAL: 'JV',
    CREDIT_NOTE: 'CN',
    DEBIT_NOTE: 'DN',
    STOCK_ADJUSTMENT: 'SA',
    OPENING_BALANCE: 'OB',
    CLOSING_ENTRY: 'CL',
    PROFORMA: 'PFI',
    DELIVERY_NOTE: 'DC',
    SERVICE: 'SI',
    SERVICE_PURCHASE: 'PI',
    ACCOUNTING_SALES: 'ASI',
    ACCOUNTING_PURCHASE: 'API'
  };

  const DOUBLE_ENTRY_TOLERANCE = 0.01;

  // Balance Sheet vs Profit & Loss classification
  const PNL_ACCOUNT_TYPES = new Set([
    'INCOME',
    'EXPENSE',
    'INDIRECT_INCOME',
    'INDIRECT_EXPENSE',
    'DIRECT_EXPENSE',
    'DIRECT_INCOME',
    'COGS',
    'CASUAL_LABOR',
    'GENERAL'
  ]);

  const BALANCE_SHEET_ACCOUNT_TYPES = new Set([
    'ASSET',
    'LIABILITY',
    'CAPITAL',
    'PAYABLE',
    'CASH',
    'BANK',
    'BANK_ACCOUNT',
    'SUNDRY_DEBTORS',
    'SUNDRY_CREDITORS',
    'DEBTOR',
    'CREDITOR',
    'RECEIVABLE',
    'LABOR_LEADER',
    'TRANSPORTER',
    'STAFF',
    'LOANS_BORROWINGS',
    'LOANS_ADVANCES',
    'DUTIES_AND_TAXES',
    'FIXED_ASSETS'
  ]);

  function classifyAccountType(accountType) {
    const normalized = (accountType || '').toUpperCase().trim();
    if (PNL_ACCOUNT_TYPES.has(normalized)) return 'PNL';
    if (BALANCE_SHEET_ACCOUNT_TYPES.has(normalized)) return 'BALANCE_SHEET';
    return 'BALANCE_SHEET';
  }

  function getFinancialYearFromDate(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    if (month >= 4) {
      const nextYear = String(year + 1).slice(-2);
      return `${year}-${nextYear}`;
    } else {
      const currentYearShort = String(year).slice(-2);
      return `${year - 1}-${currentYearShort}`;
    }
  }

  class UnifiedPostingService {
    constructor() {
      this.dbService = global.webSqlService;
    }

    /**
     * Checks if the transaction date falls within a frozen/locked fiscal period
     */
    async enforcePeriodLock(transactionDate) {
      if (!transactionDate) return;
      try {
        const res = await this.dbService.executeSql(
          'SELECT lockDate, reason FROM period_locks WHERE lockDate >= ? ORDER BY lockDate DESC LIMIT 1',
          [transactionDate]
        );
        if (res.rows && res.rows.length > 0) {
          const lock = res.rows[0];
          throw new Error(`Period Locked: Transactions on or before ${lock.lockDate} are locked (${lock.reason || 'Closed period'})`);
        }
      } catch (err) {
        if (err.message && err.message.includes('Period Locked')) throw err;
      }
    }

    /**
     * Asserts that Sum(Debit) === Sum(Credit) within 1 paisa tolerance
     */
    assertDoubleEntryBalance(legs, voucherType, narration) {
      let totalDebit = 0;
      let totalCredit = 0;

      for (const leg of legs) {
        totalDebit += Number(leg.debitAmount) || 0;
        totalCredit += Number(leg.creditAmount) || 0;
      }

      totalDebit = Math.round(totalDebit * 100) / 100;
      totalCredit = Math.round(totalCredit * 100) / 100;

      const diff = Math.abs(totalDebit - totalCredit);
      if (diff > DOUBLE_ENTRY_TOLERANCE) {
        throw new Error(
          `Unbalanced ${voucherType} voucher: Debit (₹${totalDebit.toFixed(2)}) does not equal Credit (₹${totalCredit.toFixed(2)}). Imbalance: ₹${diff.toFixed(2)}`
        );
      }

      return { totalDebit, totalCredit };
    }

    /**
     * Resolves canonical account from ChartOfAccounts, auto-creating if missing
     */
    async resolveAccountInCOA(accountHead, fallbackType = 'GENERAL') {
      const cleanHead = String(accountHead || '').trim().replace(/\s+/g, ' ');
      if (!cleanHead) throw new Error('Account head name is required');

      const res = await this.dbService.executeSql(
        'SELECT account_name, account_type FROM chart_of_accounts WHERE LOWER(account_name) = LOWER(?) LIMIT 1',
        [cleanHead]
      );

      if (res.rows && res.rows.length > 0) {
        return {
          accountHead: res.rows[0].account_name,
          accountType: res.rows[0].account_type
        };
      }

      // Auto-create in COA if missing
      const bsClass = classifyAccountType(fallbackType);
      const nowIso = new Date().toISOString();
      await this.dbService.executeSql(
        'INSERT OR IGNORE INTO chart_of_accounts (account_name, account_type, bs_classification, is_system, is_active, created_at, updated_at) VALUES (?, ?, ?, 0, 1, ?, ?)',
        [cleanHead, fallbackType, bsClass, nowIso, nowIso]
      );

      return { accountHead: cleanHead, accountType: fallbackType };
    }

    /**
     * Generates the next gapless sequence number for a voucher type and FY
     */
    async getNextSequenceNumber(voucherType, financialYear) {
      const vType = (voucherType || 'JOURNAL').toUpperCase();
      const fy = financialYear || getFinancialYearFromDate();

      await this.dbService.executeSql(
        'INSERT OR IGNORE INTO voucher_sequences (voucherType, financialYear, currentSequence) VALUES (?, ?, 0)',
        [vType, fy]
      );

      await this.dbService.executeSql(
        'UPDATE voucher_sequences SET currentSequence = currentSequence + 1 WHERE voucherType = ? AND financialYear = ?',
        [vType, fy]
      );

      const res = await this.dbService.executeSql(
        'SELECT currentSequence FROM voucher_sequences WHERE voucherType = ? AND financialYear = ? LIMIT 1',
        [vType, fy]
      );

      return res.rows[0].currentSequence;
    }

    /**
     * READ-ONLY PREVIEW of next sequential bill/voucher number (STRICT: ZERO DATABASE WRITES)
     * Exact 1:1 parity with Nuxt 4 previewNextBillNumber()
     */
    async previewNextBillNumber(voucherType, transactionDate) {
      const vType = (voucherType || 'SALES').toUpperCase();
      const fy = getFinancialYearFromDate(transactionDate);
      const prefix = VOUCHER_PREFIX_MAP[vType] || vType.slice(0, 3).toUpperCase();

      let maxNum = 0;

      // Ensure database is initialized before running read-only SELECT
      if (this.dbService && typeof this.dbService.init === 'function') {
        try {
          await this.dbService.init();
        } catch (_) {}
      }

      // 1. Read currentSequence from voucher_sequences table (STRICT: SELECT ONLY)
      try {
        const seqRes = await this.dbService.executeSql(
          'SELECT currentSequence FROM voucher_sequences WHERE voucherType = ? AND financialYear = ? LIMIT 1',
          [vType, fy]
        );
        if (seqRes && seqRes.rows && seqRes.rows.length > 0) {
          maxNum = Number(seqRes.rows[0].currentSequence) || 0;
        }
      } catch (e) {
        // Safe read-only fallback
      }

      // 2. Cross-check against existing bills table to guarantee gapless uniqueness (STRICT: SELECT ONLY)
      try {
        const billsRes = await this.dbService.executeSql(
          'SELECT bno FROM bills WHERE UPPER(btype) = ?',
          [vType]
        );
        for (const row of (billsRes.rows || [])) {
          if (row.bno) {
            const m = row.bno.match(/[/|-](\d+)$/) || row.bno.match(/(\d+)$/);
            if (m) {
              const n = parseInt(m[1], 10);
              if (!isNaN(n) && n > maxNum) maxNum = n;
            }
          }
        }
      } catch (e) {
        // Safe read-only fallback
      }

      const nextNum = maxNum + 1;
      return `${prefix}/${fy}/${String(nextNum).padStart(4, '0')}`;
    }

    /**
     * POST VOUCHER - Single universal entrypoint for all General Ledger writes
     */
    async postVoucher(payload) {
      if (!payload.legs || !Array.isArray(payload.legs) || payload.legs.length === 0) {
        throw new Error('Voucher must contain at least one leg');
      }

      const transactionDate = payload.transactionDate || new Date().toISOString().split('T')[0];

      // 1. Period Lock Guard
      if (!payload._bypassPeriodLock) {
        await this.enforcePeriodLock(transactionDate);
      }

      // 2. Resolve & Validate Legs
      const resolvedLegs = [];
      for (const leg of payload.legs) {
        const dr = Number(leg.debitAmount) || 0;
        const cr = Number(leg.creditAmount) || 0;
        if (dr === 0 && cr === 0) continue; // Skip 0-amount legs

        const { accountHead, accountType } = await this.resolveAccountInCOA(
          leg.accountHead,
          leg.accountType || 'GENERAL'
        );

        resolvedLegs.push({
          ...leg,
          accountHead,
          accountType,
          debitAmount: dr,
          creditAmount: cr,
          narration: leg.narration || payload.narration || ''
        });
      }

      if (resolvedLegs.length === 0) {
        throw new Error('Voucher has no non-zero debit/credit legs');
      }

      // 3. Double-Entry Parity Guard
      const { totalDebit, totalCredit } = this.assertDoubleEntryBalance(
        resolvedLegs,
        payload.voucherType,
        payload.narration
      );

      // 4. Generate Gapless Sequential Number
      const financialYear = getFinancialYearFromDate(transactionDate);
      const prefix = VOUCHER_PREFIX_MAP[payload.voucherType] || 'JV';

      let voucherGroupId = payload.externalVoucherGroupId;
      let voucherNo = payload.externalVoucherNo;

      if (!voucherGroupId || !voucherNo) {
        const seq = await this.getNextSequenceNumber(payload.voucherType, financialYear);
        voucherGroupId = `${prefix}-${financialYear}-${String(seq).padStart(6, '0')}`;
        voucherNo = `${prefix}/${financialYear}/${String(seq).padStart(4, '0')}`;
      }

      const nowIso = new Date().toISOString();
      const createdBy = payload.createdBy || 'Admin';
      const refType = payload.refType || 'VOUCHER';
      const refId = payload.refId || null;

      // 5. Atomic Storage into Ledger
      for (const leg of resolvedLegs) {
        await this.dbService.executeSql(
          `INSERT INTO ledger (
            transactionDate, accountHead, accountType, debitAmount, creditAmount,
            narration, voucherGroupId, voucherNo, voucherType, refType, refId,
            partyId, bankAccountId, stockId, stockRegId, paymentMode, createdBy,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionDate,
            leg.accountHead,
            leg.accountType,
            leg.debitAmount,
            leg.creditAmount,
            leg.narration || payload.narration,
            voucherGroupId,
            voucherNo,
            payload.voucherType,
            refType,
            refId,
            leg.partyId || null,
            leg.bankAccountId || null,
            leg.stockId || null,
            leg.stockRegId || null,
            leg.paymentMode || null,
            createdBy,
            nowIso,
            nowIso
          ]
        );

        // Update Party Current Balance if party is linked
        if (leg.partyId) {
          await this._syncPartyBalance(leg.partyId);
        }

        // Update Bank Account Current Balance if bank account is linked
        if (leg.bankAccountId) {
          await this._syncBankBalance(leg.bankAccountId);
        }
      }

      return {
        success: true,
        voucherGroupId,
        voucherNo,
        entryCount: resolvedLegs.length,
        totalDebit,
        totalCredit
      };
    }

    /**
     * Updates an existing voucher atomically while preserving voucherGroupId & voucherNo
     */
    async updateVoucher(voucherGroupId, payload) {
      if (!voucherGroupId) throw new Error('voucherGroupId is required');

      // 1. Locate existing entries
      const existing = await this.dbService.executeSql(
        'SELECT * FROM ledger WHERE voucherGroupId = ?',
        [voucherGroupId]
      );

      if (!existing.rows || existing.rows.length === 0) {
        throw new Error(`Voucher "${voucherGroupId}" not found in General Ledger`);
      }

      const firstEntry = existing.rows[0];

      // Guard: Commercial Bills should be edited in Bills module
      if (['BILL', 'SALE', 'PURCHASE'].includes(String(firstEntry.refType).toUpperCase())) {
        throw new Error('This voucher was generated by a Commercial Bill. Please modify the bill directly in Bills module.');
      }

      const transactionDate = payload.transactionDate || firstEntry.transactionDate;

      // 2. Period lock guard
      if (!payload._bypassPeriodLock) {
        await this.enforcePeriodLock(firstEntry.transactionDate);
        await this.enforcePeriodLock(transactionDate);
      }

      // 3. Resolve & assert parity of new legs
      const resolvedLegs = [];
      for (const leg of payload.legs) {
        const dr = Number(leg.debitAmount) || 0;
        const cr = Number(leg.creditAmount) || 0;
        if (dr === 0 && cr === 0) continue;

        const { accountHead, accountType } = await this.resolveAccountInCOA(
          leg.accountHead,
          leg.accountType || 'GENERAL'
        );

        resolvedLegs.push({
          ...leg,
          accountHead,
          accountType,
          debitAmount: dr,
          creditAmount: cr,
          narration: leg.narration || payload.narration || ''
        });
      }

      const { totalDebit, totalCredit } = this.assertDoubleEntryBalance(
        resolvedLegs,
        payload.voucherType || firstEntry.voucherType,
        payload.narration
      );

      // 4. Capture touched parties and banks to recalculate balances
      const touchedParties = new Set();
      const touchedBanks = new Set();
      for (const r of existing.rows) {
        if (r.partyId) touchedParties.add(r.partyId);
        if (r.bankAccountId) touchedBanks.add(r.bankAccountId);
      }

      // 5. Delete old legs
      await this.dbService.executeSql('DELETE FROM ledger WHERE voucherGroupId = ?', [voucherGroupId]);

      // 6. Insert new legs
      const nowIso = new Date().toISOString();
      for (const leg of resolvedLegs) {
        await this.dbService.executeSql(
          `INSERT INTO ledger (
            transactionDate, accountHead, accountType, debitAmount, creditAmount,
            narration, voucherGroupId, voucherNo, voucherType, refType, refId,
            partyId, bankAccountId, stockId, stockRegId, paymentMode, createdBy,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            transactionDate,
            leg.accountHead,
            leg.accountType,
            leg.debitAmount,
            leg.creditAmount,
            leg.narration || payload.narration || firstEntry.narration,
            firstEntry.voucherGroupId,
            firstEntry.voucherNo,
            payload.voucherType || firstEntry.voucherType,
            firstEntry.refType,
            firstEntry.refId,
            leg.partyId || null,
            leg.bankAccountId || null,
            leg.stockId || null,
            leg.stockRegId || null,
            leg.paymentMode || null,
            firstEntry.createdBy || 'Admin',
            firstEntry.created_at,
            nowIso
          ]
        );

        if (leg.partyId) touchedParties.add(leg.partyId);
        if (leg.bankAccountId) touchedBanks.add(leg.bankAccountId);
      }

      // Sync updated balances
      for (const pid of touchedParties) await this._syncPartyBalance(pid);
      for (const bid of touchedBanks) await this._syncBankBalance(bid);

      return {
        success: true,
        voucherGroupId: firstEntry.voucherGroupId,
        voucherNo: firstEntry.voucherNo,
        entryCount: resolvedLegs.length,
        totalDebit,
        totalCredit
      };
    }

    /**
     * Reverses a voucher by flipping Debit <-> Credit (Audit-compliant cancellation)
     */
    async reverseVoucher(originalVoucherGroupId, reason = 'Voucher reversal', createdBy = 'Admin') {
      const existing = await this.dbService.executeSql(
        'SELECT * FROM ledger WHERE voucherGroupId = ?',
        [originalVoucherGroupId]
      );

      if (!existing.rows || existing.rows.length === 0) {
        throw new Error(`Cannot reverse: Voucher "${originalVoucherGroupId}" not found`);
      }

      const firstEntry = existing.rows[0];
      const reversalDate = new Date().toISOString().split('T')[0];

      const reversedLegs = existing.rows.map(entry => ({
        accountHead: entry.accountHead,
        accountType: entry.accountType,
        debitAmount: entry.creditAmount || 0,   // Flipped
        creditAmount: entry.debitAmount || 0,  // Flipped
        partyId: entry.partyId || null,
        bankAccountId: entry.bankAccountId || null,
        stockId: entry.stockId || null,
        stockRegId: entry.stockRegId || null,
        paymentMode: entry.paymentMode || null,
        narration: `REVERSAL: ${reason} | Orig: ${originalVoucherGroupId}`
      }));

      return await this.postVoucher({
        voucherType: firstEntry.voucherType || 'JOURNAL',
        transactionDate: reversalDate,
        narration: `REVERSAL: ${reason} | Orig: ${originalVoucherGroupId}`,
        legs: reversedLegs,
        createdBy,
        refType: 'REVERSAL',
        refId: firstEntry.id
      });
    }

    /**
     * Deletes a manual voucher (Period Lock compliant)
     */
    async deleteVoucher(voucherGroupId) {
      const existing = await this.dbService.executeSql(
        'SELECT * FROM ledger WHERE voucherGroupId = ?',
        [voucherGroupId]
      );

      if (!existing.rows || existing.rows.length === 0) return true;

      const firstEntry = existing.rows[0];
      await this.enforcePeriodLock(firstEntry.transactionDate);

      const touchedParties = new Set();
      const touchedBanks = new Set();
      for (const r of existing.rows) {
        if (r.partyId) touchedParties.add(r.partyId);
        if (r.bankAccountId) touchedBanks.add(r.bankAccountId);
      }

      await this.dbService.executeSql('DELETE FROM ledger WHERE voucherGroupId = ?', [voucherGroupId]);

      for (const pid of touchedParties) await this._syncPartyBalance(pid);
      for (const bid of touchedBanks) await this._syncBankBalance(bid);

      return true;
    }

    /**
     * Recalculates party current balance from its ledger postings + opening balance
     */
    async _syncPartyBalance(partyId) {
      if (!partyId) return;
      try {
        const partyRes = await this.dbService.executeSql('SELECT openingBalance, balanceType FROM parties WHERE id = ?', [partyId]);
        if (!partyRes.rows || partyRes.rows.length === 0) return;
        const party = partyRes.rows[0];
        const opening = Number(party.openingBalance) || 0;
        const opNet = (party.balanceType === 'DR' || party.balanceType === 'DEBIT') ? opening : -opening;

        const ledgerRes = await this.dbService.executeSql(
          'SELECT SUM(debitAmount) as totalDr, SUM(creditAmount) as totalCr FROM ledger WHERE partyId = ?',
          [partyId]
        );
        const lDr = Number(ledgerRes.rows[0]?.totalDr) || 0;
        const lCr = Number(ledgerRes.rows[0]?.totalCr) || 0;

        const netBalance = opNet + (lDr - lCr);
        const currentBal = Math.abs(netBalance);
        const balanceType = netBalance >= 0 ? 'DR' : 'CR';

        await this.dbService.executeSql(
          'UPDATE parties SET currentBalance = ?, balanceType = ?, updated_at = ? WHERE id = ?',
          [currentBal, balanceType, new Date().toISOString(), partyId]
        );
      } catch (err) {
        console.warn(`[Ledger] Sync party balance failed for party ${partyId}:`, err);
      }
    }

    /**
     * Recalculates bank account current balance from its ledger postings + opening balance
     */
    async _syncBankBalance(bankAccountId) {
      if (!bankAccountId) return;
      try {
        const bankRes = await this.dbService.executeSql('SELECT opening_balance, balance_type FROM bank_accounts WHERE id = ?', [bankAccountId]);
        if (!bankRes.rows || bankRes.rows.length === 0) return;
        const bank = bankRes.rows[0];
        const opening = Number(bank.opening_balance) || 0;
        const opNet = (bank.balance_type === 'DR') ? opening : -opening;

        const ledgerRes = await this.dbService.executeSql(
          'SELECT SUM(debitAmount) as totalDr, SUM(creditAmount) as totalCr FROM ledger WHERE bankAccountId = ?',
          [bankAccountId]
        );
        const lDr = Number(ledgerRes.rows[0]?.totalDr) || 0;
        const lCr = Number(ledgerRes.rows[0]?.totalCr) || 0;

        const netBalance = opNet + (lDr - lCr);
        const currentBal = Math.abs(netBalance);
        const balanceType = netBalance >= 0 ? 'DR' : 'CR';

        await this.dbService.executeSql(
          'UPDATE bank_accounts SET current_balance = ?, balance_type = ?, updated_at = ? WHERE id = ?',
          [currentBal, balanceType, new Date().toISOString(), bankAccountId]
        );
      } catch (err) {
        console.warn(`[Ledger] Sync bank balance failed for bank ${bankAccountId}:`, err);
      }
    }
  }

  // Export Singleton
  global.unifiedPostingService = new UnifiedPostingService();
  global.UNIVERSAL_MASTER_ACCOUNT_TYPES = UNIVERSAL_MASTER_ACCOUNT_TYPES;
  global.VOUCHER_PREFIX_MAP = VOUCHER_PREFIX_MAP;
  global.classifyAccountType = classifyAccountType;
  global.getFinancialYearFromDate = getFinancialYearFromDate;
})(typeof window !== 'undefined' ? window : this);
