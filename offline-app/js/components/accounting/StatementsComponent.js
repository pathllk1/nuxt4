// components/accounting/StatementsComponent.js - 100% Replication of Nuxt 4 Financial Statements & Daybook
(function (global) {
  'use strict';

  global.StatementsComponent = {
    name: 'StatementsComponent',
    emits: ['open-voucher'],
    setup(props, { emit }) {
      const { ref, computed, onMounted } = Vue;

      const activeTab = ref('daybook'); // daybook, trialbalance, profitloss, balancesheet, ledger, coa
      const loading = ref(false);

      // Filters
      const datePreset = ref('THIS_MONTH');
      const fromDate = ref('');
      const toDate = ref('');
      const selectedVtype = ref('ALL');
      const searchQuery = ref('');

      // Data Containers
      const dayBookData = ref({ vouchers: [], summary: {} });
      const trialBalanceData = ref({ rows: [], summary: {} });
      const profitLossData = ref(null);
      const balanceSheetData = ref(null);
      const accountLedgerData = ref(null);
      const selectedAccountHead = ref('Sales');
      const coaList = ref([]);
      const selectedVoucherDetails = ref(null);

      // Modals
      const showCoaModal = ref(false);
      const showSlglModal = ref(false);
      const showYearEndModal = ref(false);
      const showPeriodLockModal = ref(false);
      const newCoa = ref({
        account_name: '',
        account_type: 'EXPENSE',
        description: ''
      });

      const applyDatePreset = (preset) => {
        datePreset.value = preset;
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');

        if (preset === 'TODAY') {
          fromDate.value = `${y}-${m}-${d}`;
          toDate.value = `${y}-${m}-${d}`;
        } else if (preset === 'THIS_MONTH') {
          fromDate.value = `${y}-${m}-01`;
          toDate.value = `${y}-${m}-${d}`;
        } else if (preset === 'FY') {
          const month = now.getMonth() + 1;
          const fyStart = month >= 4 ? y : y - 1;
          fromDate.value = `${fyStart}-04-01`;
          toDate.value = `${y}-${m}-${d}`;
        } else if (preset === 'ALL') {
          fromDate.value = '';
          toDate.value = '';
        }
        loadCurrentTab();
      };

      const loadDayBook = async () => {
        loading.value = true;
        try {
          dayBookData.value = await global.ledgerService.getDayBook({
            fromDate: fromDate.value,
            toDate: toDate.value,
            voucherType: selectedVtype.value === 'ALL' ? undefined : selectedVtype.value,
            search: searchQuery.value
          });
        } catch (err) {
          console.error('Failed to load Day Book:', err);
        } finally {
          loading.value = false;
        }
      };

      const loadTrialBalance = async () => {
        loading.value = true;
        try {
          trialBalanceData.value = await global.ledgerService.getTrialBalance(fromDate.value, toDate.value);
        } catch (err) {
          console.error('Failed to load Trial Balance:', err);
        } finally {
          loading.value = false;
        }
      };

      const loadProfitLoss = async () => {
        loading.value = true;
        try {
          profitLossData.value = await global.ledgerService.getProfitAndLoss(fromDate.value, toDate.value);
        } catch (err) {
          console.error('Failed to load P&L:', err);
        } finally {
          loading.value = false;
        }
      };

      const loadBalanceSheet = async () => {
        loading.value = true;
        try {
          balanceSheetData.value = await global.ledgerService.getBalanceSheet(toDate.value || undefined);
        } catch (err) {
          console.error('Failed to load Balance Sheet:', err);
        } finally {
          loading.value = false;
        }
      };

      const loadAccountLedger = async () => {
        if (!selectedAccountHead.value) return;
        loading.value = true;
        try {
          accountLedgerData.value = await global.ledgerService.getAccountLedgerStatement(
            selectedAccountHead.value,
            fromDate.value,
            toDate.value
          );
        } catch (err) {
          console.error('Failed to load Account Ledger:', err);
        } finally {
          loading.value = false;
        }
      };

      const loadCoa = async () => {
        try {
          const res = await global.WebSqlService.executeSql('SELECT * FROM chart_of_accounts ORDER BY account_type ASC, account_name ASC');
          coaList.value = res.rows || [];
        } catch (err) {
          console.error('Failed to load COA:', err);
        }
      };

      const loadCurrentTab = () => {
        if (activeTab.value === 'daybook') loadDayBook();
        else if (activeTab.value === 'trialbalance') loadTrialBalance();
        else if (activeTab.value === 'profitloss') loadProfitLoss();
        else if (activeTab.value === 'balancesheet') loadBalanceSheet();
        else if (activeTab.value === 'ledger') loadAccountLedger();
        else if (activeTab.value === 'coa') loadCoa();
      };

      const drillDownToAccount = (head) => {
        selectedAccountHead.value = head;
        activeTab.value = 'ledger';
        loadAccountLedger();
      };

      const reverseVoucher = async (v) => {
        if (confirm(`Do you want to create an audit reversal voucher for ${v.voucherNo}?`)) {
          try {
            await global.unifiedPostingService.reverseVoucher(v.voucherGroupId, 'User requested audit reversal');
            alert(`Reversal voucher posted for ${v.voucherNo}`);
            loadDayBook();
          } catch (err) {
            alert('Reversal failed: ' + err.message);
          }
        }
      };

      const deleteVoucher = async (v) => {
        if (confirm(`Are you sure you want to permanently delete voucher ${v.voucherNo}?`)) {
          try {
            await global.unifiedPostingService.deleteVoucher(v.voucherGroupId);
            alert(`Voucher ${v.voucherNo} deleted`);
            loadDayBook();
          } catch (err) {
            alert('Delete failed: ' + err.message);
          }
        }
      };

      const saveNewCoa = async () => {
        if (!newCoa.value.account_name) {
          alert('Account name is required');
          return;
        }
        try {
          await global.unifiedPostingService.resolveAccountInCOA(newCoa.value.account_name, newCoa.value.account_type);
          showCoaModal.value = false;
          newCoa.value.account_name = '';
          newCoa.value.description = '';
          loadCoa();
        } catch (err) {
          alert('Failed to save account: ' + err.message);
        }
      };

      // Export Helper via ExcelJS
      const exportTableToExcel = async (title, headers, rows) => {
        if (typeof ExcelJS === 'undefined') {
          alert('ExcelJS library missing');
          return;
        }
        try {
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet(title.slice(0, 30));
          sheet.addRow(headers);
          for (const r of rows) {
            sheet.addRow(r);
          }
          const buf = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
          a.click();
          URL.revokeObjectURL(a);
        } catch (err) {
          alert('Export failed: ' + err.message);
        }
      };

      const exportDayBookExcel = () => {
        const rows = (dayBookData.value.vouchers || []).map((v) => [
          v.transactionDate,
          v.voucherNo,
          v.voucherType,
          v.narration,
          v.legs.map((l) => `${l.accountHead} (${l.debitAmount > 0 ? 'Dr ' + l.debitAmount : 'Cr ' + l.creditAmount})`).join('; '),
          v.totalAmount
        ]);
        exportTableToExcel('DayBook', ['Date', 'Voucher No', 'Type', 'Narration', 'Particulars', 'Amount (INR)'], rows);
      };

      const exportTrialBalanceExcel = () => {
        const rows = (trialBalanceData.value.rows || []).map((r) => [
          r.accountHead,
          r.accountType,
          r.bsClassification,
          r.totalDebit,
          r.totalCredit,
          r.balance,
          r.balanceType
        ]);
        exportTableToExcel('Trial_Balance', ['Account Head', 'Account Type', 'Classification', 'Total Debit', 'Total Credit', 'Net Balance', 'Side'], rows);
      };

      onMounted(() => {
        applyDatePreset('THIS_MONTH');
        loadCoa();
      });

      return {
        activeTab,
        loading,
        datePreset,
        fromDate,
        toDate,
        selectedVtype,
        searchQuery,
        dayBookData,
        trialBalanceData,
        profitLossData,
        balanceSheetData,
        accountLedgerData,
        selectedAccountHead,
        coaList,
        selectedVoucherDetails,
        showCoaModal,
        showSlglModal,
        showYearEndModal,
        showPeriodLockModal,
        newCoa,
        applyDatePreset,
        loadCurrentTab,
        loadDayBook,
        loadTrialBalance,
        loadProfitLoss,
        loadBalanceSheet,
        loadAccountLedger,
        drillDownToAccount,
        reverseVoucher,
        deleteVoucher,
        saveNewCoa,
        exportDayBookExcel,
        exportTrialBalanceExcel
      };
    },
    template: `
      <div class="p-4 py-3 w-full space-y-4">
        <!-- Header -->
        <div class="flex flex-wrap justify-between items-end gap-3">
          <div>
            <div class="flex items-center gap-2 mb-0.5">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">Financial Statements</span>
            </div>
            <h1 class="text-xl font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">Accounting & Statements</h1>
            <p class="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">Audit-compliant Day Book, Trial Balance, Profit & Loss, Balance Sheet, and Account Drill-Down</p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button 
              @click="showSlglModal = true" 
              class="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Sub-Ledger vs General Ledger Reconciliation"
            >
              <span>🛡️</span>
              <span>SL-GL Audit</span>
            </button>

            <button 
              @click="showYearEndModal = true" 
              class="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Fiscal Year-End Closing Wizard"
            >
              <span>🔒</span>
              <span>Year-End Close</span>
            </button>

            <button 
              @click="showPeriodLockModal = true" 
              class="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Period Lock Registry"
            >
              <span>📅</span>
              <span>Period Lock</span>
            </button>

            <button
              @click="$emit('open-voucher')"
              class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>➕ New Voucher</span>
            </button>
          </div>
        </div>

        <!-- Statements Navigation Tabs -->
        <div class="bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl flex gap-1 flex-wrap border border-slate-200 dark:border-zinc-700 w-fit">
          <button
            type="button"
            @click="activeTab = 'daybook'; loadDayBook()"
            :class="activeTab === 'daybook' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'"
            class="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            📖 Day Book
          </button>
          <button
            type="button"
            @click="activeTab = 'trialbalance'; loadTrialBalance()"
            :class="activeTab === 'trialbalance' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'"
            class="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            ⚖️ Trial Balance
          </button>
          <button
            type="button"
            @click="activeTab = 'profitloss'; loadProfitLoss()"
            :class="activeTab === 'profitloss' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'"
            class="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            📈 Profit & Loss
          </button>
          <button
            type="button"
            @click="activeTab = 'balancesheet'; loadBalanceSheet()"
            :class="activeTab === 'balancesheet' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'"
            class="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            🏛️ Balance Sheet
          </button>
          <button
            type="button"
            @click="activeTab = 'ledger'; loadAccountLedger()"
            :class="activeTab === 'ledger' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'"
            class="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            🔍 Account Ledger
          </button>
          <button
            type="button"
            @click="activeTab = 'coa'; loadCoa()"
            :class="activeTab === 'coa' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'"
            class="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            🌳 Chart of Accounts
          </button>
        </div>

        <!-- Global Date & Filter Bar -->
        <div v-if="activeTab !== 'coa'" class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Period:</span>
            <button
              v-for="p in ['TODAY', 'THIS_MONTH', 'FY', 'ALL']"
              :key="p"
              @click="applyDatePreset(p)"
              :class="datePreset === p ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'"
              class="px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer"
            >
              {{ p.replace('_', ' ') }}
            </button>

            <div class="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-zinc-700">
              <input v-model="fromDate" @change="datePreset = 'CUSTOM'; loadCurrentTab()" type="date" class="px-2 py-1 text-xs font-semibold rounded border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
              <span class="text-xs text-slate-400 font-bold">to</span>
              <input v-model="toDate" @change="datePreset = 'CUSTOM'; loadCurrentTab()" type="date" class="px-2 py-1 text-xs font-semibold rounded border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
            </div>
          </div>

          <!-- Tab-specific filter options -->
          <div v-if="activeTab === 'daybook'" class="flex items-center gap-2">
            <select v-model="selectedVtype" @change="loadDayBook" class="px-2.5 py-1 text-xs font-bold rounded border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
              <option value="ALL">All Types</option>
              <option value="PAYMENT">Payment (PV)</option>
              <option value="RECEIPT">Receipt (RV)</option>
              <option value="CONTRA">Contra (CV)</option>
              <option value="JOURNAL">Journal (JV)</option>
              <option value="SALES">Sales (SI)</option>
              <option value="PURCHASE">Purchase (PI)</option>
            </select>
            <button @click="exportDayBookExcel" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs cursor-pointer">
              📥 Excel
            </button>
          </div>

          <div v-if="activeTab === 'trialbalance'" class="flex items-center gap-2">
            <button @click="exportTrialBalanceExcel" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs cursor-pointer">
              📥 Excel
            </button>
          </div>

          <div v-if="activeTab === 'ledger'" class="flex items-center gap-2">
            <select v-model="selectedAccountHead" @change="loadAccountLedger" class="px-3 py-1 text-xs font-bold rounded border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white max-w-xs">
              <option v-for="c in coaList" :key="c.account_name" :value="c.account_name">
                {{ c.account_name }} ({{ c.account_type }})
              </option>
            </select>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- VIEW 1: DAY BOOK                               -->
        <!-- ============================================== -->
        <template v-if="activeTab === 'daybook'">
          <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
            <div class="p-3 bg-slate-50 dark:bg-zinc-850 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center text-xs font-bold">
              <span class="uppercase tracking-wider text-slate-500">Day Book Vouchers ({{ dayBookData.summary.totalVouchers || 0 }})</span>
              <div class="flex items-center gap-4 font-mono text-[11px]">
                <span class="text-emerald-600 font-bold">Total Debits: ₹{{ (dayBookData.summary.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                <span class="text-rose-600 font-bold">Total Credits: ₹{{ (dayBookData.summary.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs font-semibold border-collapse">
                <thead>
                  <tr class="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th class="p-2.5 w-24">Date</th>
                    <th class="p-2.5 w-32">Voucher No</th>
                    <th class="p-2.5 w-24 text-center">Type</th>
                    <th class="p-2.5">Particulars / Narration</th>
                    <th class="p-2.5 w-32 text-right">Amount (₹)</th>
                    <th class="p-2.5 w-28 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-mono text-[11px]">
                  <tr v-for="v in dayBookData.vouchers" :key="v.voucherGroupId" class="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                    <td class="p-2.5 text-slate-500 font-bold">{{ v.transactionDate }}</td>
                    <td class="p-2.5 text-blue-600 font-bold">{{ v.voucherNo }}</td>
                    <td class="p-2.5 text-center">
                      <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider" :class="v.voucherType === 'SALES' ? 'bg-emerald-100 text-emerald-800' : v.voucherType === 'PURCHASE' ? 'bg-amber-100 text-amber-800' : v.voucherType === 'PAYMENT' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'">
                        {{ v.voucherType }}
                      </span>
                    </td>
                    <td class="p-2.5 font-sans">
                      <div class="font-bold text-slate-900 dark:text-white line-clamp-1">{{ v.narration || 'General Voucher' }}</div>
                      <div class="text-[10px] text-slate-400 mt-0.5 font-mono">
                        <span v-for="(leg, lIdx) in v.legs.slice(0, 3)" :key="lIdx" class="mr-2">
                          {{ leg.accountHead }}: ₹{{ leg.debitAmount || leg.creditAmount }}
                        </span>
                        <span v-if="v.legs.length > 3">...+{{ v.legs.length - 3 }} more</span>
                      </div>
                    </td>
                    <td class="p-2.5 text-right font-black text-slate-900 dark:text-white">
                      ₹{{ v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                    </td>
                    <td class="p-2.5 text-center">
                      <div class="flex items-center justify-center gap-1">
                        <button
                          @click="selectedVoucherDetails = v"
                          title="Inspect Legs"
                          class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-[10px] font-bold cursor-pointer"
                        >
                          👁️
                        </button>
                        <button
                          v-if="v.refType !== 'BILL'"
                          @click="reverseVoucher(v)"
                          title="Reverse Voucher"
                          class="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold cursor-pointer"
                        >
                          🔄
                        </button>
                        <button
                          v-if="v.refType !== 'BILL'"
                          @click="deleteVoucher(v)"
                          title="Delete Voucher"
                          class="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold cursor-pointer"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!loading && dayBookData.vouchers.length === 0">
                    <td colspan="6" class="p-8 text-center text-xs text-slate-400 font-sans italic">
                      No vouchers found for this date range or filter.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- ============================================== -->
        <!-- VIEW 2: TRIAL BALANCE                          -->
        <!-- ============================================== -->
        <template v-else-if="activeTab === 'trialbalance'">
          <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
            <!-- Parity Header -->
            <div class="p-3 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center text-xs font-bold" :class="trialBalanceData.summary.isBalanced ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800'">
              <div class="flex items-center gap-2">
                <span v-if="trialBalanceData.summary.isBalanced">✅ Mathematical Parity: Trial Balance is 100% Balanced</span>
                <span v-else>⚠️ Imbalance Detected: Difference of ₹{{ trialBalanceData.summary.difference }}</span>
              </div>
              <div class="flex items-center gap-4 font-mono text-[11px]">
                <span>Total Debit: ₹{{ (trialBalanceData.summary.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                <span>Total Credit: ₹{{ (trialBalanceData.summary.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs font-semibold border-collapse">
                <thead>
                  <tr class="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th class="p-2.5">Account Head</th>
                    <th class="p-2.5 w-32">Classification</th>
                    <th class="p-2.5 w-32 text-right">Debit (Dr)</th>
                    <th class="p-2.5 w-32 text-right">Credit (Cr)</th>
                    <th class="p-2.5 w-36 text-right">Net Balance</th>
                    <th class="p-2.5 w-16 text-center">Side</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-mono text-[11px]">
                  <tr v-for="r in trialBalanceData.rows" :key="r.accountHead" class="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                    <td class="p-2.5 font-sans">
                      <button @click="drillDownToAccount(r.accountHead)" class="text-blue-600 hover:underline font-bold text-left cursor-pointer">
                        {{ r.accountHead }}
                      </button>
                    </td>
                    <td class="p-2.5 text-[10px] text-slate-500 font-bold uppercase">{{ r.accountType }}</td>
                    <td class="p-2.5 text-right font-bold text-slate-700 dark:text-zinc-300">
                      {{ r.totalDebit > 0 ? '₹' + r.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-' }}
                    </td>
                    <td class="p-2.5 text-right font-bold text-slate-700 dark:text-zinc-300">
                      {{ r.totalCredit > 0 ? '₹' + r.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-' }}
                    </td>
                    <td class="p-2.5 text-right font-black" :class="r.balanceType === 'DR' ? 'text-emerald-600' : 'text-rose-600'">
                      ₹{{ r.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                    </td>
                    <td class="p-2.5 text-center font-bold" :class="r.balanceType === 'DR' ? 'text-emerald-600' : 'text-rose-600'">
                      {{ r.balanceType }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- ============================================== -->
        <!-- VIEW 3: PROFIT & LOSS                          -->
        <!-- ============================================== -->
        <template v-else-if="activeTab === 'profitloss'">
          <div v-if="profitLossData" class="space-y-4">
            <!-- P&L KPI Strip -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <p class="text-[9px] font-black uppercase text-slate-400">Total Revenue</p>
                <div class="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">₹{{ profitLossData.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</div>
              </div>
              <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <p class="text-[9px] font-black uppercase text-slate-400">Total COGS</p>
                <div class="text-lg font-black font-mono text-amber-600 mt-0.5">₹{{ profitLossData.totalCOGS.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</div>
              </div>
              <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <p class="text-[9px] font-black uppercase text-slate-400">Gross Profit (GP {{ profitLossData.gpMargin }}%)</p>
                <div class="text-lg font-black font-mono text-blue-600 mt-0.5">₹{{ profitLossData.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</div>
              </div>
              <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <p class="text-[9px] font-black uppercase text-slate-400">Net Profit (NP {{ profitLossData.npMargin }}%)</p>
                <div class="text-lg font-black font-mono mt-0.5" :class="profitLossData.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                  ₹{{ profitLossData.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                </div>
              </div>
            </div>

            <!-- T-Shape P&L Report -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Expenditure Side -->
              <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
                <h3 class="text-xs font-black uppercase tracking-wider text-rose-600 border-b pb-2">Expenses & COGS</h3>
                <div class="space-y-2">
                  <div class="text-[10px] font-black text-slate-400 uppercase">Cost of Goods Sold (Direct)</div>
                  <div v-for="c in profitLossData.cogsList" :key="c.head" class="flex justify-between text-xs font-semibold">
                    <span @click="drillDownToAccount(c.head)" class="cursor-pointer hover:underline text-slate-800 dark:text-zinc-200">{{ c.head }}</span>
                    <span class="font-mono">₹{{ c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                  </div>

                  <div class="text-[10px] font-black text-slate-400 uppercase pt-2">Operating Expenses (Indirect)</div>
                  <div v-for="o in profitLossData.opexList" :key="o.head" class="flex justify-between text-xs font-semibold">
                    <span @click="drillDownToAccount(o.head)" class="cursor-pointer hover:underline text-slate-800 dark:text-zinc-200">{{ o.head }}</span>
                    <span class="font-mono">₹{{ o.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                  </div>
                </div>
              </div>

              <!-- Income Side -->
              <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
                <h3 class="text-xs font-black uppercase tracking-wider text-emerald-600 border-b pb-2">Revenue & Income</h3>
                <div class="space-y-2">
                  <div v-for="i in profitLossData.incomeList" :key="i.head" class="flex justify-between text-xs font-semibold">
                    <span @click="drillDownToAccount(i.head)" class="cursor-pointer hover:underline text-slate-800 dark:text-zinc-200">{{ i.head }}</span>
                    <span class="font-mono">₹{{ i.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ============================================== -->
        <!-- VIEW 4: BALANCE SHEET                          -->
        <!-- ============================================== -->
        <template v-else-if="activeTab === 'balancesheet'">
          <div v-if="balanceSheetData" class="space-y-4">
            <!-- Balance Verification Badge -->
            <div class="p-3 rounded-xl border flex justify-between items-center text-xs font-bold" :class="balanceSheetData.isBalanced ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'">
              <span>{{ balanceSheetData.isBalanced ? '✅ Balance Sheet Equilibrium: Assets == Liabilities + Equity' : '⚠️ Difference of ₹' + balanceSheetData.difference }}</span>
              <div class="flex gap-4 font-mono text-[11px]">
                <span>Assets: ₹{{ balanceSheetData.totalAssets.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                <span>Equities: ₹{{ balanceSheetData.totalEquities.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
              </div>
            </div>

            <!-- Financial Ratios -->
            <div class="grid grid-cols-3 gap-3">
              <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <p class="text-[9px] font-black uppercase text-slate-400">Working Capital</p>
                <div class="text-base font-black font-mono text-slate-900 dark:text-white mt-0.5">₹{{ balanceSheetData.workingCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</div>
              </div>
              <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <p class="text-[9px] font-black uppercase text-slate-400">Current Ratio</p>
                <div class="text-base font-black font-mono text-blue-600 mt-0.5">{{ balanceSheetData.currentRatio }}:1</div>
              </div>
              <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <p class="text-[9px] font-black uppercase text-slate-400">Quick Ratio</p>
                <div class="text-base font-black font-mono text-indigo-600 mt-0.5">{{ balanceSheetData.quickRatio }}:1</div>
              </div>
            </div>

            <!-- T-Shape Balance Sheet -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Liabilities & Equities -->
              <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2">Liabilities & Capital</h3>
                <div class="space-y-2">
                  <div class="text-[10px] font-black text-slate-400 uppercase">Capital & Reserves</div>
                  <div v-for="c in balanceSheetData.capitalAccounts" :key="c.accountHead" class="flex justify-between text-xs font-semibold">
                    <span>{{ c.accountHead }}</span>
                    <span class="font-mono">₹{{ c.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                  </div>
                  <div class="flex justify-between text-xs font-semibold text-emerald-600">
                    <span>Current Year Net Profit (P&L)</span>
                    <span class="font-mono font-bold">₹{{ balanceSheetData.netProfitCurrentYear.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                  </div>

                  <div class="text-[10px] font-black text-slate-400 uppercase pt-2">Current Liabilities & Payables</div>
                  <div v-for="l in balanceSheetData.currentLiabilities" :key="l.accountHead" class="flex justify-between text-xs font-semibold">
                    <span>{{ l.accountHead }}</span>
                    <span class="font-mono">₹{{ l.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                  </div>
                </div>
              </div>

              <!-- Assets -->
              <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2">Assets</h3>
                <div class="space-y-2">
                  <div v-if="balanceSheetData.fixedAssets.length" class="text-[10px] font-black text-slate-400 uppercase">Fixed Assets</div>
                  <div v-for="f in balanceSheetData.fixedAssets" :key="f.accountHead" class="flex justify-between text-xs font-semibold">
                    <span>{{ f.accountHead }}</span>
                    <span class="font-mono">₹{{ f.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                  </div>

                  <div class="text-[10px] font-black text-slate-400 uppercase pt-2">Current Assets & Treasury</div>
                  <div v-for="a in balanceSheetData.currentAssets" :key="a.accountHead" class="flex justify-between text-xs font-semibold">
                    <span @click="drillDownToAccount(a.accountHead)" class="cursor-pointer hover:underline text-blue-600">{{ a.accountHead }}</span>
                    <span class="font-mono">₹{{ a.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ============================================== -->
        <!-- VIEW 5: ACCOUNT LEDGER DRILL-DOWN              -->
        <!-- ============================================== -->
        <template v-else-if="activeTab === 'ledger'">
          <div v-if="accountLedgerData" class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
            <div class="p-4 bg-slate-50 dark:bg-zinc-850 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase">{{ accountLedgerData.accountHead }}</h2>
                <p class="text-xs text-slate-400 font-mono">
                  Opening Balance: ₹{{ accountLedgerData.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }} {{ accountLedgerData.openingBalanceType }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-[9px] font-black text-slate-400 uppercase">Closing Balance</p>
                <div class="text-base font-black font-mono" :class="accountLedgerData.finalBalanceType === 'DR' ? 'text-emerald-600' : 'text-rose-600'">
                  ₹{{ accountLedgerData.finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }} {{ accountLedgerData.finalBalanceType }}
                </div>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs font-semibold border-collapse">
                <thead>
                  <tr class="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th class="p-2.5 w-24">Date</th>
                    <th class="p-2.5 w-32">Voucher No</th>
                    <th class="p-2.5">Narration</th>
                    <th class="p-2.5 w-28 text-right">Debit (Dr)</th>
                    <th class="p-2.5 w-28 text-right">Credit (Cr)</th>
                    <th class="p-2.5 w-32 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-mono text-[11px]">
                  <tr v-for="e in accountLedgerData.entries" :key="e.id" class="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                    <td class="p-2.5 text-slate-500">{{ e.date }}</td>
                    <td class="p-2.5 text-blue-600 font-bold">{{ e.voucherNo }}</td>
                    <td class="p-2.5 font-sans font-medium text-slate-800 dark:text-zinc-200">{{ e.narration }}</td>
                    <td class="p-2.5 text-right font-bold text-emerald-600">{{ e.debit > 0 ? '₹' + e.debit.toFixed(2) : '-' }}</td>
                    <td class="p-2.5 text-right font-bold text-rose-600">{{ e.credit > 0 ? '₹' + e.credit.toFixed(2) : '-' }}</td>
                    <td class="p-2.5 text-right font-black">₹{{ e.balance.toFixed(2) }} {{ e.balanceType }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- ============================================== -->
        <!-- VIEW 6: CHART OF ACCOUNTS (COA)                -->
        <!-- ============================================== -->
        <template v-else-if="activeTab === 'coa'">
          <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
            <div class="p-4 bg-slate-50 dark:bg-zinc-850 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Chart of Accounts Master Registry</h3>
                <p class="text-[10px] text-slate-400">Total Registered Heads: {{ coaList.length }}</p>
              </div>
              <button @click="showCoaModal = true" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">
                + Add Account Head
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs font-semibold border-collapse">
                <thead>
                  <tr class="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th class="p-2.5">Account Name</th>
                    <th class="p-2.5 w-40">Account Type</th>
                    <th class="p-2.5 w-36">Classification</th>
                    <th class="p-2.5 w-24 text-center">System Head</th>
                    <th class="p-2.5 w-20 text-center">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 text-[11px]">
                  <tr v-for="c in coaList" :key="c.id" class="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                    <td class="p-2.5 font-bold text-slate-900 dark:text-white">{{ c.account_name }}</td>
                    <td class="p-2.5 font-mono text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">{{ c.account_type }}</td>
                    <td class="p-2.5 text-[10px] font-bold">{{ c.bs_classification || 'BALANCE_SHEET' }}</td>
                    <td class="p-2.5 text-center">
                      <span v-if="c.is_system" class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 dark:bg-zinc-800 text-slate-600">SYSTEM</span>
                      <span v-else class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-blue-50 text-blue-600">CUSTOM</span>
                    </td>
                    <td class="p-2.5 text-center">
                      <button @click="drillDownToAccount(c.account_name)" class="text-blue-600 hover:underline font-bold text-xs cursor-pointer">
                        Ledger
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- INSPECT VOUCHER LEGS MODAL -->
        <div v-if="selectedVoucherDetails" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div class="px-5 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 class="text-sm font-black uppercase font-mono">{{ selectedVoucherDetails.voucherNo }}</h3>
                <p class="text-[10px] text-slate-400 font-sans">{{ selectedVoucherDetails.transactionDate }} · {{ selectedVoucherDetails.voucherType }}</p>
              </div>
              <button @click="selectedVoucherDetails = null" class="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>
            <div class="p-4 space-y-3">
              <p class="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                <span class="font-bold text-slate-900 dark:text-white">Narration:</span> {{ selectedVoucherDetails.narration }}
              </p>
              <div class="border rounded-xl overflow-hidden text-xs">
                <table class="w-full text-left">
                  <thead class="bg-slate-100 dark:bg-zinc-800 text-[10px] uppercase font-black">
                    <tr>
                      <th class="p-2">Account Head</th>
                      <th class="p-2 text-right">Debit (Dr)</th>
                      <th class="p-2 text-right">Credit (Cr)</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y font-mono text-[11px]">
                    <tr v-for="(leg, idx) in selectedVoucherDetails.legs" :key="idx">
                      <td class="p-2 font-sans font-bold">{{ leg.accountHead }}</td>
                      <td class="p-2 text-right text-emerald-600">{{ leg.debitAmount > 0 ? '₹' + leg.debitAmount.toFixed(2) : '-' }}</td>
                      <td class="p-2 text-right text-rose-600">{{ leg.creditAmount > 0 ? '₹' + leg.creditAmount.toFixed(2) : '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="px-5 py-3 bg-slate-50 dark:bg-zinc-850 flex justify-end">
              <button @click="selectedVoucherDetails = null" class="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-zinc-800 text-xs font-bold cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>

        <!-- ADD COA HEAD MODAL -->
        <div v-if="showCoaModal" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div class="px-5 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 class="text-xs font-black uppercase">Add Custom Chart of Accounts Head</h3>
              <button @click="showCoaModal = false" class="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>
            <div class="p-5 space-y-3">
              <div>
                <label class="block text-[10px] font-black uppercase text-slate-400 mb-1">Account Head Name *</label>
                <input v-model="newCoa.account_name" type="text" placeholder="e.g. Workshop Equipment Maintenance" class="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase text-slate-400 mb-1">Account Type *</label>
                <select v-model="newCoa.account_type" class="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                  <option value="EXPENSE">EXPENSE (Indirect)</option>
                  <option value="DIRECT_EXPENSE">DIRECT_EXPENSE</option>
                  <option value="INCOME">INCOME (Indirect)</option>
                  <option value="DIRECT_INCOME">DIRECT_INCOME</option>
                  <option value="FIXED_ASSETS">FIXED_ASSETS</option>
                  <option value="LOANS_BORROWINGS">LOANS_BORROWINGS</option>
                  <option value="LOANS_ADVANCES">LOANS_ADVANCES</option>
                  <option value="DUTIES_AND_TAXES">DUTIES_AND_TAXES</option>
                  <option value="CAPITAL">CAPITAL</option>
                </select>
              </div>
            </div>
            <div class="px-5 py-3 bg-slate-50 dark:bg-zinc-850 flex justify-end gap-2">
              <button @click="showCoaModal = false" class="px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
              <button @click="saveNewCoa" class="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer">Save Head</button>
            </div>
          </div>
        </div>

        <!-- Audit & Closing Modals -->
        <SLGLAuditModalComponent v-model="showSlglModal" />
        <YearEndClosingModalComponent v-model="showYearEndModal" @closed="loadCurrentTab" />
        <PeriodLockModalComponent v-model="showPeriodLockModal" @lock-updated="loadCurrentTab" />
      </div>
    `
  };
})(typeof window !== 'undefined' ? window : this);
