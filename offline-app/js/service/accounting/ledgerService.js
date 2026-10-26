// service/accounting/ledgerService.js - Financial Statements, Ledger Analytics & Banking Service (100% Nuxt 4 Parity)
(function (global) {
  'use strict';

  class LedgerService {
    constructor() {
      this.dbService = global.webSqlService;
    }

    /**
     * TRIAL BALANCE
     * Returns all account balances with mathematical double-entry parity assertion
     */
    async getTrialBalance(fromDate, toDate) {
      // 1. Build Date Filter
      let dateWhere = '';
      const params = [];
      if (fromDate && toDate) {
        dateWhere = 'WHERE transactionDate >= ? AND transactionDate <= ?';
        params.push(fromDate, toDate);
      } else if (fromDate) {
        dateWhere = 'WHERE transactionDate >= ?';
        params.push(fromDate);
      } else if (toDate) {
        dateWhere = 'WHERE transactionDate <= ?';
        params.push(toDate);
      }

      // 2. Fetch Chart of Accounts canonical definitions
      const coaRes = await this.dbService.executeSql('SELECT account_name, account_type, bs_classification FROM chart_of_accounts');
      const coaMap = new Map();
      for (const c of coaRes.rows || []) {
        coaMap.set(c.account_name.toLowerCase().trim(), {
          accountType: c.account_type,
          bsClassification: c.bs_classification
        });
      }

      // 3. Aggregate Ledger entries by accountHead
      const sql = `
        SELECT 
          accountHead,
          accountType,
          SUM(debitAmount) as totalDebit,
          SUM(creditAmount) as totalCredit
        FROM ledger
        ${dateWhere}
        GROUP BY accountHead
        ORDER BY accountHead ASC
      `;
      const res = await this.dbService.executeSql(sql, params);

      let sumDebits = 0;
      let sumCredits = 0;

      const rows = (res.rows || []).map((row) => {
        const dr = Math.round((Number(row.totalDebit) || 0) * 100) / 100;
        const cr = Math.round((Number(row.totalCredit) || 0) * 100) / 100;
        const net = dr - cr;
        const balance = Math.abs(net);
        const balanceType = net >= 0 ? 'DR' : 'CR';

        const canonical = coaMap.get(row.accountHead.toLowerCase().trim());
        const accountType = canonical ? canonical.accountType : (row.accountType || 'GENERAL');
        const bsClassification = canonical ? canonical.bsClassification : global.classifyAccountType(accountType);

        if (balanceType === 'DR') sumDebits += balance;
        else sumCredits += balance;

        return {
          accountHead: row.accountHead,
          accountType,
          bsClassification,
          totalDebit: dr,
          totalCredit: cr,
          balance,
          balanceType
        };
      });

      sumDebits = Math.round(sumDebits * 100) / 100;
      sumCredits = Math.round(sumCredits * 100) / 100;
      const difference = Math.round(Math.abs(sumDebits - sumCredits) * 100) / 100;
      const isBalanced = difference <= 0.01;

      return {
        rows,
        summary: {
          totalDebit: sumDebits,
          totalCredit: sumCredits,
          difference,
          isBalanced,
          accountCount: rows.length
        }
      };
    }

    /**
     * PROFIT AND LOSS STATEMENT
     * Complete P&L model with Revenue, COGS, Operating Expenses, GP & NP margins
     */
    async getProfitAndLoss(fromDate, toDate) {
      const tb = await this.getTrialBalance(fromDate, toDate);
      const isIncomeType = (t) => ['INCOME', 'DIRECT_INCOME', 'INDIRECT_INCOME'].includes((t || '').toUpperCase());
      const isExpenseType = (t) => ['EXPENSE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'COGS', 'CASUAL_LABOR'].includes((t || '').toUpperCase());
      const isCOGSAccount = (head, type) => {
        const h = head.toLowerCase().trim();
        return (
          type === 'COGS' ||
          type === 'DIRECT_EXPENSE' ||
          h.includes('cogs') ||
          h === 'purchases' ||
          h.includes('cost of goods') ||
          h.includes('freight')
        );
      };

      const plAccounts = tb.rows.filter((a) => a.bsClassification === 'PNL' || isIncomeType(a.accountType) || isExpenseType(a.accountType) || a.accountType === 'GENERAL');

      const incomeList = [];
      const cogsList = [];
      const opexList = [];

      let totalRevenue = 0;
      let totalCOGS = 0;
      let totalOpex = 0;

      for (const acc of plAccounts) {
        if (isIncomeType(acc.accountType)) {
          // Income accounts normally have Credit balance
          const netIncome = acc.totalCredit - acc.totalDebit;
          incomeList.push({
            head: acc.accountHead,
            type: acc.accountType,
            amount: netIncome,
            isContra: netIncome < 0
          });
          totalRevenue += netIncome;
        } else if (isCOGSAccount(acc.accountHead, acc.accountType)) {
          const netExpense = acc.totalDebit - acc.totalCredit;
          cogsList.push({
            head: acc.accountHead,
            type: acc.accountType,
            amount: netExpense
          });
          totalCOGS += netExpense;
        } else {
          // Operating expenses
          const netExpense = acc.totalDebit - acc.totalCredit;
          opexList.push({
            head: acc.accountHead,
            type: acc.accountType,
            amount: netExpense
          });
          totalOpex += netExpense;
        }
      }

      const grossProfit = Math.round((totalRevenue - totalCOGS) * 100) / 100;
      const netProfit = Math.round((grossProfit - totalOpex) * 100) / 100;
      const gpMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const npMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return {
        incomeList,
        cogsList,
        opexList,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCOGS: Math.round(totalCOGS * 100) / 100,
        grossProfit,
        gpMargin: Math.round(gpMargin * 10) / 10,
        totalOpex: Math.round(totalOpex * 100) / 100,
        netProfit,
        npMargin: Math.round(npMargin * 10) / 10
      };
    }

    /**
     * BALANCE SHEET
     * Assets = Liabilities + Capital + Current Year Net Profit
     */
    async getBalanceSheet(asOfDate) {
      const tb = await this.getTrialBalance(undefined, asOfDate);
      const pl = await this.getProfitAndLoss(undefined, asOfDate);

      const bsAccounts = tb.rows.filter((a) => a.bsClassification === 'BALANCE_SHEET');

      const fixedAssets = [];
      const currentAssets = [];
      const capitalAccounts = [];
      const currentLiabilities = [];

      let totalFixedAssets = 0;
      let totalCurrentAssets = 0;
      let totalCapital = 0;
      let totalLiabilities = 0;

      const isAssetGroup = (t) => ['ASSET', 'FIXED_ASSETS', 'CASH', 'BANK', 'BANK_ACCOUNT', 'SUNDRY_DEBTORS', 'DEBTOR', 'RECEIVABLE', 'DUTIES_AND_TAXES'].includes(t);
      const isLiabilityGroup = (t) => ['LIABILITY', 'PAYABLE', 'CREDITOR', 'SUNDRY_CREDITORS', 'TRANSPORTER', 'STAFF', 'LOANS_BORROWINGS'].includes(t);

      for (const a of bsAccounts) {
        if (a.accountType === 'FIXED_ASSETS') {
          fixedAssets.push(a);
          totalFixedAssets += a.balanceType === 'DR' ? a.balance : -a.balance;
        } else if (a.accountType === 'CAPITAL') {
          capitalAccounts.push(a);
          totalCapital += a.balanceType === 'CR' ? a.balance : -a.balance;
        } else if (isAssetGroup(a.accountType)) {
          currentAssets.push(a);
          totalCurrentAssets += a.balanceType === 'DR' ? a.balance : -a.balance;
        } else if (isLiabilityGroup(a.accountType)) {
          currentLiabilities.push(a);
          totalLiabilities += a.balanceType === 'CR' ? a.balance : -a.balance;
        } else {
          // Default asset/liability routing by balance type
          if (a.balanceType === 'DR') {
            currentAssets.push(a);
            totalCurrentAssets += a.balance;
          } else {
            currentLiabilities.push(a);
            totalLiabilities += a.balance;
          }
        }
      }

      const totalAssets = Math.round((totalFixedAssets + totalCurrentAssets) * 100) / 100;
      const totalEquities = Math.round((totalCapital + pl.netProfit + totalLiabilities) * 100) / 100;
      const difference = Math.round(Math.abs(totalAssets - totalEquities) * 100) / 100;
      const isBalanced = difference <= 0.05;

      // Financial Ratios
      const workingCapital = Math.round((totalCurrentAssets - totalLiabilities) * 100) / 100;
      const currentRatio = totalLiabilities > 0 ? totalCurrentAssets / totalLiabilities : (totalCurrentAssets > 0 ? 99 : 0);
      const stockAsset = currentAssets.find((a) => a.accountHead.toLowerCase().includes('inventory') || a.accountHead.toLowerCase().includes('stock'));
      const stockVal = stockAsset ? stockAsset.balance : 0;
      const quickAssets = totalCurrentAssets - stockVal;
      const quickRatio = totalLiabilities > 0 ? quickAssets / totalLiabilities : (quickAssets > 0 ? 99 : 0);

      return {
        fixedAssets,
        currentAssets,
        capitalAccounts,
        currentLiabilities,
        totalFixedAssets: Math.round(totalFixedAssets * 100) / 100,
        totalCurrentAssets: Math.round(totalCurrentAssets * 100) / 100,
        totalAssets,
        totalCapital: Math.round(totalCapital * 100) / 100,
        netProfitCurrentYear: pl.netProfit,
        totalLiabilities: Math.round(totalLiabilities * 100) / 100,
        totalEquities,
        difference,
        isBalanced,
        workingCapital,
        currentRatio: Math.round(currentRatio * 100) / 100,
        quickRatio: Math.round(quickRatio * 100) / 100
      };
    }

    /**
     * DAY BOOK
     * Chronological multi-leg vouchers viewer with searching and filtering
     */
    async getDayBook(filters = {}) {
      let conditions = [];
      const params = [];

      if (filters.date) {
        conditions.push('transactionDate = ?');
        params.push(filters.date);
      } else {
        if (filters.fromDate) {
          conditions.push('transactionDate >= ?');
          params.push(filters.fromDate);
        }
        if (filters.toDate) {
          conditions.push('transactionDate <= ?');
          params.push(filters.toDate);
        }
      }

      if (filters.voucherType) {
        conditions.push('voucherType = ?');
        params.push(filters.voucherType.toUpperCase());
      }

      if (filters.accountHead) {
        conditions.push('accountHead = ?');
        params.push(filters.accountHead);
      }

      if (filters.partyId) {
        conditions.push('partyId = ?');
        params.push(filters.partyId);
      }

      if (filters.search) {
        conditions.push('(narration LIKE ? OR voucherNo LIKE ? OR accountHead LIKE ?)');
        const s = `%${filters.search}%`;
        params.push(s, s, s);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filters.limit || 500;
      const offset = filters.offset || 0;

      const sql = `
        SELECT * FROM ledger
        ${whereClause}
        ORDER BY transactionDate DESC, id DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const res = await this.dbService.executeSql(sql, params);

      // Group rows by voucherGroupId into full voucher objects
      const voucherMap = new Map();
      let totalDebit = 0;
      let totalCredit = 0;

      for (const row of res.rows || []) {
        totalDebit += row.debitAmount;
        totalCredit += row.creditAmount;

        if (!voucherMap.has(row.voucherGroupId)) {
          voucherMap.set(row.voucherGroupId, {
            voucherGroupId: row.voucherGroupId,
            voucherNo: row.voucherNo,
            voucherType: row.voucherType,
            transactionDate: row.transactionDate,
            narration: row.narration,
            refType: row.refType,
            refId: row.refId,
            createdBy: row.createdBy,
            legs: [],
            totalAmount: 0
          });
        }

        const v = voucherMap.get(row.voucherGroupId);
        v.legs.push(row);
        if (row.debitAmount > 0) {
          v.totalAmount += row.debitAmount;
        }
      }

      const vouchers = Array.from(voucherMap.values());

      return {
        vouchers,
        summary: {
          totalVouchers: vouchers.length,
          totalEntries: res.rows.length,
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100
        }
      };
    }

    /**
     * ACCOUNT LEDGER STATEMENT
     * Statement drill-down with Opening Balance, transactions, and running balances
     */
    async getAccountLedgerStatement(accountHead, fromDate, toDate) {
      if (!accountHead) throw new Error('accountHead is required');

      // 1. Opening balance before fromDate
      let openingDebit = 0;
      let openingCredit = 0;

      if (fromDate) {
        const opSql = `
          SELECT SUM(debitAmount) as dr, SUM(creditAmount) as cr 
          FROM ledger 
          WHERE LOWER(accountHead) = LOWER(?) AND transactionDate < ?
        `;
        const opRes = await this.dbService.executeSql(opSql, [accountHead, fromDate]);
        openingDebit = Number(opRes.rows[0]?.dr) || 0;
        openingCredit = Number(opRes.rows[0]?.cr) || 0;
      }

      const netOpening = openingDebit - openingCredit;
      const openingBalance = Math.abs(netOpening);
      const openingBalanceType = netOpening >= 0 ? 'DR' : 'CR';

      // 2. Transactions in period
      let dateCond = '';
      const params = [accountHead];

      if (fromDate && toDate) {
        dateCond = 'AND transactionDate >= ? AND transactionDate <= ?';
        params.push(fromDate, toDate);
      } else if (fromDate) {
        dateCond = 'AND transactionDate >= ?';
        params.push(fromDate);
      } else if (toDate) {
        dateCond = 'AND transactionDate <= ?';
        params.push(toDate);
      }

      const txSql = `
        SELECT * FROM ledger
        WHERE LOWER(accountHead) = LOWER(?)
        ${dateCond}
        ORDER BY transactionDate ASC, id ASC
      `;
      const txRes = await this.dbService.executeSql(txSql, params);

      let runningNet = netOpening;
      let totalDebits = 0;
      let totalCredits = 0;

      const entries = (txRes.rows || []).map((row) => {
        const dr = Number(row.debitAmount) || 0;
        const cr = Number(row.creditAmount) || 0;
        totalDebits += dr;
        totalCredits += cr;

        runningNet += (dr - cr);
        const currentBal = Math.abs(runningNet);
        const currentBalType = runningNet >= 0 ? 'DR' : 'CR';

        return {
          id: row.id,
          date: row.transactionDate,
          voucherNo: row.voucherNo,
          voucherType: row.voucherType,
          voucherGroupId: row.voucherGroupId,
          narration: row.narration,
          debit: dr,
          credit: cr,
          balance: currentBal,
          balanceType: currentBalType
        };
      });

      const finalNet = runningNet;
      const finalBalance = Math.abs(finalNet);
      const finalBalanceType = finalNet >= 0 ? 'DR' : 'CR';

      return {
        accountHead,
        openingBalance,
        openingBalanceType,
        entries,
        totalDebits: Math.round(totalDebits * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        finalBalance: Math.round(finalBalance * 100) / 100,
        finalBalanceType
      };
    }

    /**
     * BANK ACCOUNTS WITH GL BALANCES
     * Returns all bank accounts with computed balances directly from the double-entry ledger
     */
    async getBankAccountsWithBalances() {
      const res = await this.dbService.executeSql('SELECT * FROM bank_accounts ORDER BY is_default DESC, id ASC');
      const accounts = res.rows || [];

      const result = [];
      for (const acc of accounts) {
        const opening = Number(acc.opening_balance) || 0;
        const opNet = acc.balance_type === 'DR' ? opening : -opening;

        const glRes = await this.dbService.executeSql(
          'SELECT SUM(debitAmount) as dr, SUM(creditAmount) as cr FROM ledger WHERE bankAccountId = ?',
          [acc.id]
        );
        const dr = Number(glRes.rows[0]?.dr) || 0;
        const cr = Number(glRes.rows[0]?.cr) || 0;

        const currentNet = opNet + (dr - cr);
        const currentBal = Math.abs(currentNet);
        const balanceType = currentNet >= 0 ? 'DR' : 'CR';

        result.push({
          ...acc,
          glDebit: dr,
          glCredit: cr,
          current_balance: Math.round(currentBal * 100) / 100,
          balanceType
        });
      }

      return result;
    }

    /**
     * BANK ACCOUNT TRANSACTION HISTORY
     */
    async getBankAccountHistory(bankAccountId, limit = 20) {
      if (!bankAccountId) return [];
      const res = await this.dbService.executeSql(
        `SELECT * FROM ledger 
         WHERE bankAccountId = ? 
         ORDER BY transactionDate DESC, id DESC 
         LIMIT ?`,
        [bankAccountId, limit]
      );
      return res.rows || [];
    }

    /**
     * VOUCHERS SUMMARY & PULSE
     */
    async getVouchersSummary() {
      const rRes = await this.dbService.executeSql("SELECT SUM(debitAmount) as total FROM ledger WHERE voucherType = 'RECEIPT'");
      const pRes = await this.dbService.executeSql("SELECT SUM(creditAmount) as total FROM ledger WHERE voucherType = 'PAYMENT'");
      const countRes = await this.dbService.executeSql("SELECT COUNT(DISTINCT voucherGroupId) as count FROM ledger");
      const recentRes = await this.dbService.executeSql("SELECT COUNT(DISTINCT voucherGroupId) as count FROM ledger WHERE date(transactionDate) >= date('now', '-30 days')");

      const totalReceipts = Number(rRes.rows[0]?.total) || 0;
      const totalPayments = Number(pRes.rows[0]?.total) || 0;
      const totalVouchers = Number(countRes.rows[0]?.count) || 0;
      const recentCount = Number(recentRes.rows[0]?.count) || 0;

      return {
        total_receipts: Math.round(totalReceipts * 100) / 100,
        total_payments: Math.round(totalPayments * 100) / 100,
        net_position: Math.round((totalReceipts - totalPayments) * 100) / 100,
        total_vouchers: totalVouchers,
        recent_transactions_count: recentCount
      };
    }

    /**
     * JOURNAL SUMMARY
     */
    async getJournalSummary() {
      const jRes = await this.dbService.executeSql("SELECT COUNT(DISTINCT voucherGroupId) as count FROM ledger WHERE voucherType = 'JOURNAL'");
      const count = Number(jRes.rows[0]?.count) || 0;
      return {
        recent_journal_entries_count: count
      };
    }

    /**
     * ACCOUNT TYPE SUMMARIES
     * Aggregates ledger by account type for charts and dashboard cards
     */
    async getAccountTypeSummaries(toDate = '') {
      let where = '';
      const params = [];
      if (toDate) {
        where = 'WHERE transactionDate <= ?';
        params.push(toDate);
      }

      const sql = `
        SELECT 
          accountType as account_type,
          COUNT(DISTINCT accountHead) as account_count,
          SUM(debitAmount) as total_debit,
          SUM(creditAmount) as total_credit
        FROM ledger
        ${where}
        GROUP BY accountType
        ORDER BY total_debit DESC
      `;
      const res = await this.dbService.executeSql(sql, params);
      return (res.rows || []).map((row) => {
        const dr = Math.round((Number(row.total_debit) || 0) * 100) / 100;
        const cr = Math.round((Number(row.total_credit) || 0) * 100) / 100;
        return {
          account_type: row.account_type || 'GENERAL',
          account_count: Number(row.account_count) || 0,
          total_debit: dr,
          total_credit: cr,
          total_balance: Math.round((dr - cr) * 100) / 100
        };
      });
    }

    /**
     * SUB-LEDGER TO GENERAL LEDGER (SL-GL) RECONCILIATION
     * Compares Sub-Ledger (Parties, Banks) with General Ledger control accounts
     */
    async runSLGLReconciliation(toDate = '') {
      const cutoffDate = toDate || new Date().toISOString().split('T')[0];

      // 1. AR Reconciliation (Customers: Sundry Debtors)
      const glArRes = await this.dbService.executeSql(
        `SELECT SUM(debitAmount) as dr, SUM(creditAmount) as cr FROM ledger 
         WHERE (accountType = 'CUSTOMER' OR accountType = 'SUNDRY_DEBTORS') 
           AND transactionDate <= ?`,
        [cutoffDate]
      );
      const glArDr = Number(glArRes.rows[0]?.dr) || 0;
      const glArCr = Number(glArRes.rows[0]?.cr) || 0;
      const glArNet = Math.round((glArDr - glArCr) * 100) / 100;

      const slArRes = await this.dbService.executeSql(
        "SELECT SUM(currentBalance) as total FROM parties WHERE type = 'CUSTOMER'"
      );
      const slArTotal = Math.round((Number(slArRes.rows[0]?.total) || 0) * 100) / 100;
      const arVariance = Math.round(Math.abs(glArNet - slArTotal) * 100) / 100;

      // 2. AP Reconciliation (Vendors: Sundry Creditors)
      const glApRes = await this.dbService.executeSql(
        `SELECT SUM(debitAmount) as dr, SUM(creditAmount) as cr FROM ledger 
         WHERE (accountType = 'VENDOR' OR accountType = 'SUNDRY_CREDITORS') 
           AND transactionDate <= ?`,
        [cutoffDate]
      );
      const glApDr = Number(glApRes.rows[0]?.dr) || 0;
      const glApCr = Number(glApRes.rows[0]?.cr) || 0;
      const glApNet = Math.round((glApCr - glApDr) * 100) / 100; // Net Creditors is CR

      const slApRes = await this.dbService.executeSql(
        "SELECT SUM(currentBalance) as total FROM parties WHERE type = 'SUPPLIER'"
      );
      const slApTotal = Math.round((Number(slApRes.rows[0]?.total) || 0) * 100) / 100;
      const apVariance = Math.round(Math.abs(glApNet - slApTotal) * 100) / 100;

      // 3. Bank Accounts Reconciliation
      const bankAccounts = await this.getBankAccountsWithBalances();
      let glBankTotal = 0;
      let slBankTotal = 0;
      const bankVariances = [];

      for (const b of bankAccounts) {
        const opening = Number(b.opening_balance) || 0;
        const opNet = b.balance_type === 'DR' ? opening : -opening;
        const glRes = await this.dbService.executeSql(
          'SELECT SUM(debitAmount) as dr, SUM(creditAmount) as cr FROM ledger WHERE bankAccountId = ? AND transactionDate <= ?',
          [b.id, cutoffDate]
        );
        const dr = Number(glRes.rows[0]?.dr) || 0;
        const cr = Number(glRes.rows[0]?.cr) || 0;
        const glBal = opNet + (dr - cr);

        glBankTotal += glBal;
        slBankTotal += Number(b.current_balance) || 0;

        const diff = Math.round(Math.abs(glBal - (Number(b.current_balance) || 0)) * 100) / 100;
        if (diff > 0.05) {
          bankVariances.push({
            category: 'BANK',
            entityName: b.account_name,
            entityId: b.id,
            glBalance: glBal,
            slBalance: b.current_balance,
            variance: diff,
            status: diff > 100 ? 'CRITICAL' : 'WARNING'
          });
        }
      }
      const bankVariance = Math.round(Math.abs(glBankTotal - slBankTotal) * 100) / 100;

      // 4. Untagged Vouchers Check
      const untaggedRes = await this.dbService.executeSql(
        `SELECT COUNT(*) as count FROM ledger 
         WHERE (accountType = 'CUSTOMER' OR accountType = 'VENDOR') 
           AND (partyId IS NULL OR partyId = 0)
           AND transactionDate <= ?`,
        [cutoffDate]
      );
      const untaggedCount = Number(untaggedRes.rows[0]?.count) || 0;

      // 5. Variances Collection
      const variances = [...bankVariances];
      if (arVariance > 0.05) {
        variances.push({
          category: 'AR',
          entityName: 'Accounts Receivable (Customers)',
          glBalance: glArNet,
          slBalance: slArTotal,
          variance: arVariance,
          status: arVariance > 500 ? 'CRITICAL' : 'WARNING'
        });
      }
      if (apVariance > 0.05) {
        variances.push({
          category: 'AP',
          entityName: 'Accounts Payable (Suppliers)',
          glBalance: glApNet,
          slBalance: slApTotal,
          variance: apVariance,
          status: apVariance > 500 ? 'CRITICAL' : 'WARNING'
        });
      }

      const hasCritical = variances.some((v) => v.status === 'CRITICAL') || untaggedCount > 0;
      const hasWarning = variances.some((v) => v.status === 'WARNING');
      const overallStatus = hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'HEALTHY';

      return {
        timestamp: new Date().toISOString(),
        cutoffDate,
        overallStatus,
        arSummary: {
          glTotal: glArNet,
          slTotal: slArTotal,
          variance: arVariance,
          status: arVariance <= 0.05 ? 'HEALTHY' : 'WARNING'
        },
        apSummary: {
          glTotal: glApNet,
          slTotal: slApTotal,
          variance: apVariance,
          status: apVariance <= 0.05 ? 'HEALTHY' : 'WARNING'
        },
        bankSummary: {
          glTotal: Math.round(glBankTotal * 100) / 100,
          slTotal: Math.round(slBankTotal * 100) / 100,
          variance: bankVariance,
          status: bankVariance <= 0.05 ? 'HEALTHY' : 'WARNING'
        },
        variances,
        untaggedVoucherCount: untaggedCount
      };
    }

    /**
     * PERIOD LOCK MANAGEMENT
     */
    async getPeriodLocks() {
      const res = await this.dbService.executeSql('SELECT * FROM period_locks ORDER BY lockDate DESC');
      return res.rows || [];
    }

    async setPeriodLock(lockDate, financialYear = '', reason = 'Statutory Audit Freeze', lockedBy = 'Admin') {
      const now = new Date().toISOString();
      const fy = financialYear || global.unifiedPostingService.getFinancialYear(lockDate);

      // Check if lock for this date already exists
      const existing = await this.dbService.executeSql('SELECT id FROM period_locks WHERE lockDate = ?', [lockDate]);
      if (existing.rows && existing.rows.length > 0) {
        await this.dbService.executeSql(
          'UPDATE period_locks SET financialYear = ?, reason = ?, lockedBy = ?, isActive = 1, updated_at = ? WHERE id = ?',
          [fy, reason, lockedBy, now, existing.rows[0].id]
        );
      } else {
        await this.dbService.executeSql(
          `INSERT INTO period_locks (lockDate, financialYear, reason, lockedBy, isActive, closingStatus, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, 'LOCKED', ?, ?)`,
          [lockDate, fy, reason, lockedBy, now, now]
        );
      }
      return { success: true, lockDate, financialYear: fy };
    }

    async removePeriodLock(id) {
      await this.dbService.executeSql('DELETE FROM period_locks WHERE id = ?', [id]);
      return { success: true };
    }

    /**
     * FISCAL YEAR-END CLOSING
     */
    async previewYearEndClose(financialYear) {
      // 1. Determine FY dates
      const parts = financialYear.split('-');
      const startYear = parseInt(parts[0], 10);
      const fyStartDate = `${startYear}-04-01`;
      const fyEndDate = `${startYear + 1}-03-31`;

      // 2. Check if already closed
      const lockRes = await this.dbService.executeSql(
        "SELECT * FROM period_locks WHERE financialYear = ? AND closingStatus = 'CLOSED'",
        [financialYear]
      );
      if (lockRes.rows && lockRes.rows.length > 0) {
        return {
          canClose: false,
          blockingReasons: [`Fiscal Year ${financialYear} has already been closed and locked.`]
        };
      }

      // 3. Get Trial Balance for FY
      const tb = await this.getTrialBalance(fyStartDate, fyEndDate);
      const blockingReasons = [];
      if (!tb.summary.isBalanced) {
        blockingReasons.push(
          `Trial Balance is not balanced! Total Dr: ₹${tb.summary.totalDebit} vs Total Cr: ₹${tb.summary.totalCredit} (Diff: ₹${tb.summary.difference})`
        );
      }

      // 4. Calculate P&L summary
      const pnl = await this.getProfitAndLoss(fyStartDate, fyEndDate);
      const netProfit = pnl.netProfit;
      const profitType = netProfit >= 0 ? 'PROFIT' : 'LOSS';

      const pnlAccounts = tb.rows.filter((r) => r.bsClassification === 'PNL');
      const bsAccounts = tb.rows.filter((r) => r.bsClassification === 'BALANCE_SHEET');

      return {
        financialYear,
        fyStartDate,
        fyEndDate,
        trialBalanceParity: tb.summary.isBalanced,
        totalIncome: pnl.totalRevenue,
        totalExpense: pnl.totalExpenses,
        netProfit,
        profitType,
        balanceSheetAccountCount: bsAccounts.length,
        pnlAccountCount: pnlAccounts.length,
        canClose: blockingReasons.length === 0,
        blockingReasons,
        pnlAccounts,
        bsAccounts
      };
    }

    async executeYearEndClose(financialYear, closedBy = 'Admin') {
      const preview = await this.previewYearEndClose(financialYear);
      if (!preview.canClose) {
        throw new Error(preview.blockingReasons.join('; '));
      }

      const now = new Date().toISOString();
      const nextParts = financialYear.split('-');
      const nextStartYear = parseInt(nextParts[0], 10) + 1;
      const nextFY = `${nextStartYear}-${String(nextStartYear + 1).slice(-2)}`;
      const nextFYStartDate = `${nextStartYear}-04-01`;

      // 1. Post Closing Voucher (CL) to zero all P&L accounts to Reserves & Surplus
      const clLegs = [];
      for (const p of preview.pnlAccounts) {
        if (p.balanceType === 'CR') {
          // Credit balance account (e.g. Income) is debited to zero it out
          clLegs.push({
            accountHead: p.accountHead,
            accountType: p.accountType,
            debitAmount: p.balance,
            creditAmount: 0,
            narration: `Year-end closing zero-out: ${financialYear}`
          });
        } else {
          // Debit balance account (e.g. Expense) is credited to zero it out
          clLegs.push({
            accountHead: p.accountHead,
            accountType: p.accountType,
            debitAmount: 0,
            creditAmount: p.balance,
            narration: `Year-end closing zero-out: ${financialYear}`
          });
        }
      }

      // Net to Reserves & Surplus
      if (preview.netProfit > 0) {
        // Net Profit credits Reserves & Surplus (Equity)
        clLegs.push({
          accountHead: 'Reserves & Surplus',
          accountType: 'EQUITY',
          debitAmount: 0,
          creditAmount: preview.netProfit,
          narration: `Net Profit transfer for FY ${financialYear}`
        });
      } else if (preview.netProfit < 0) {
        // Net Loss debits Reserves & Surplus
        clLegs.push({
          accountHead: 'Reserves & Surplus',
          accountType: 'EQUITY',
          debitAmount: Math.abs(preview.netProfit),
          creditAmount: 0,
          narration: `Net Loss transfer for FY ${financialYear}`
        });
      }

      let closingVoucherNo = '';
      if (clLegs.length > 0) {
        const clRes = await global.unifiedPostingService.postVoucher({
          voucherType: 'CLOSING',
          transactionDate: preview.fyEndDate,
          narration: `Fiscal Year ${financialYear} Official Book Closing Entry`,
          legs: clLegs,
          createdBy: closedBy,
          refType: 'YEAR_END_CLOSE'
        });
        closingVoucherNo = clRes.voucherNo;
      }

      // 2. Generate Roll-Forward Opening Balances (OB) for next FY
      const obLegs = [];
      for (const b of preview.bsAccounts) {
        if (b.balance > 0) {
          obLegs.push({
            accountHead: b.accountHead,
            accountType: b.accountType,
            debitAmount: b.balanceType === 'DR' ? b.balance : 0,
            creditAmount: b.balanceType === 'CR' ? b.balance : 0,
            narration: `Roll-forward Opening Balance from FY ${financialYear}`
          });
        }
      }

      // Include Reserves & Surplus accumulated net profit in the next year's opening balance
      if (preview.netProfit !== 0) {
        obLegs.push({
          accountHead: 'Reserves & Surplus',
          accountType: 'EQUITY',
          debitAmount: preview.netProfit < 0 ? Math.abs(preview.netProfit) : 0,
          creditAmount: preview.netProfit > 0 ? preview.netProfit : 0,
          narration: `Accumulated Reserves & Surplus from FY ${financialYear}`
        });
      }

      if (obLegs.length > 0) {
        await global.unifiedPostingService.postVoucher({
          voucherType: 'OPENING_BALANCE',
          transactionDate: nextFYStartDate,
          narration: `Opening Balances brought forward from FY ${financialYear}`,
          legs: obLegs,
          createdBy: closedBy,
          refType: 'OPENING_ROLLOVER'
        });
      }

      // 3. Set Hard Period Lock for closed FY
      await this.setPeriodLock(preview.fyEndDate, financialYear, `Fiscal Year ${financialYear} Closed & Audited`, closedBy);
      await this.dbService.executeSql(
        "UPDATE period_locks SET closingStatus = 'CLOSED' WHERE financialYear = ?",
        [financialYear]
      );

      return {
        success: true,
        financialYear,
        closingVoucherNo,
        netProfit: preview.netProfit,
        profitType: preview.profitType,
        openingBalancesGenerated: obLegs.length,
        lockDate: preview.fyEndDate
      };
    }

    /**
     * BULK PAYMENT BATCH POSTING
     */
    async postBulkPaymentBatch({ bankAccountId, paymentDate, paymentMode, chequeNo, narration, beneficiaries }) {
      if (!bankAccountId) throw new Error('Source Bank Account is required');
      if (!beneficiaries || !beneficiaries.length) throw new Error('At least one beneficiary is required');

      // Fetch source bank
      const bankRes = await this.dbService.executeSql('SELECT * FROM bank_accounts WHERE id = ?', [bankAccountId]);
      const bank = bankRes.rows && bankRes.rows[0];
      if (!bank) throw new Error('Selected Bank Account not found');

      const legs = [];
      let totalDisbursed = 0;

      for (const b of beneficiaries) {
        const amt = Number(b.amount) || 0;
        if (amt <= 0) continue;
        legs.push({
          accountHead: b.partyName || b.accountHead,
          accountType: b.accountType || 'VENDOR',
          partyId: b.partyId || null,
          debitAmount: amt,
          creditAmount: 0,
          narration: b.narration || narration || `Bulk payout via ${paymentMode}`
        });
        totalDisbursed += amt;
      }

      if (totalDisbursed <= 0) throw new Error('Total payout amount must be greater than zero');

      // Credit source bank
      legs.push({
        accountHead: bank.account_name,
        accountType: 'BANK',
        bankAccountId: bank.id,
        debitAmount: 0,
        creditAmount: totalDisbursed,
        narration: `Bulk payment disbursement: Cheque #${chequeNo || 'N/A'}`
      });

      const res = await global.unifiedPostingService.postVoucher({
        voucherType: 'PAYMENT',
        transactionDate: paymentDate || new Date().toISOString().split('T')[0],
        narration: narration || `Bulk Payout: ${beneficiaries.length} recipients via ${bank.account_name}`,
        paymentMode: paymentMode || 'NEFT',
        legs,
        createdBy: 'Admin',
        refType: 'BULK_PAYOUT'
      });

      return {
        success: true,
        voucherNo: res.voucherNo,
        totalDisbursed,
        recipientCount: beneficiaries.length
      };
    }
  }

  // Export Singleton
  global.ledgerService = new LedgerService();
})(typeof window !== 'undefined' ? window : this);
