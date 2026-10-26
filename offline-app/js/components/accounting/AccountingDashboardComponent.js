// js/components/accounting/AccountingDashboardComponent.js
(function (global) {
  'use strict';

  const { ref, computed, onMounted, onBeforeUnmount, nextTick } = Vue;

  const AccountingDashboardComponent = {
    name: 'AccountingDashboardComponent',
    emits: ['open-voucher', 'navigate-tab'],
    setup(props, { emit }) {
      const loading = ref(true);
      const toDate = ref(new Date().toISOString().split('T')[0]);
      const activeTab = ref('heads'); // 'heads' | 'types'
      const searchQuery = ref('');

      // Modals
      const showSlglModal = ref(false);
      const showYearEndModal = ref(false);
      const showPeriodLockModal = ref(false);
      const selectedAccountForDrill = ref(null);
      const showDrillModal = ref(false);
      const drillStatement = ref(null);
      const drillLoading = ref(false);

      // Data States
      const trialBalance = ref([]);
      const tbSummary = ref({ totalDebit: 0, totalCredit: 0, isBalanced: true });
      const accountTypeSummaries = ref([]);
      const vouchersSummary = ref({});
      const journalSummary = ref({});

      // Chart.js Instances
      let typeChartInstance = null;
      let exposureChartInstance = null;

      const destroyCharts = () => {
        if (typeChartInstance) {
          typeChartInstance.destroy();
          typeChartInstance = null;
        }
        if (exposureChartInstance) {
          exposureChartInstance.destroy();
          exposureChartInstance = null;
        }
      };

      const renderCharts = () => {
        if (!global.Chart) return;
        destroyCharts();

        // 1. Account Type Mix Bar Chart
        const typeEl = document.getElementById('accountingTypeChart');
        if (typeEl && accountTypeSummaries.value.length > 0) {
          const categories = accountTypeSummaries.value.slice(0, 7);
          const labels = categories.map((c) => (c.account_type || '').replace(/_/g, ' '));
          const debits = categories.map((c) => Number(c.total_debit) || 0);
          const credits = categories.map((c) => Number(c.total_credit) || 0);

          typeChartInstance = new global.Chart(typeEl, {
            type: 'bar',
            data: {
              labels,
              datasets: [
                {
                  label: 'Total Debit (Dr)',
                  data: debits,
                  backgroundColor: 'rgba(16, 185, 129, 0.85)',
                  borderColor: 'rgb(16, 185, 129)',
                  borderWidth: 1,
                  borderRadius: 6,
                  maxBarThickness: 32
                },
                {
                  label: 'Total Credit (Cr)',
                  data: credits,
                  backgroundColor: 'rgba(244, 63, 94, 0.85)',
                  borderColor: 'rgb(244, 63, 94)',
                  borderWidth: 1,
                  borderRadius: 6,
                  maxBarThickness: 32
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top',
                  labels: {
                    boxWidth: 10,
                    boxHeight: 10,
                    font: { size: 10, weight: 'bold' }
                  }
                },
                tooltip: {
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  titleColor: '#f8fafc',
                  bodyColor: '#e2e8f0',
                  padding: 10,
                  callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
                  }
                }
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { font: { size: 9, weight: 'bold' } }
                },
                y: {
                  grid: { color: 'rgba(148, 163, 184, 0.12)' },
                  ticks: {
                    font: { family: 'monospace', size: 9 },
                    callback: (val) => {
                      const n = Number(val);
                      if (Math.abs(n) >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
                      if (Math.abs(n) >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
                      if (Math.abs(n) >= 1000) return '₹' + (n / 1000).toFixed(0) + 'k';
                      return '₹' + n;
                    }
                  }
                }
              }
            }
          });
        }

        // 2. Top Account Exposure Horizontal Bar Chart
        const expEl = document.getElementById('accountingExposureChart');
        if (expEl && topExposureAccounts.value.length > 0) {
          const accounts = topExposureAccounts.value.slice(0, 6);
          const labels = accounts.map((a) => a.accountHead);
          const balances = accounts.map((a) => a.balance);
          const bgColors = accounts.map((a) => a.balanceType === 'DR' ? 'rgba(37, 99, 235, 0.85)' : 'rgba(244, 63, 94, 0.85)');
          const borderColors = accounts.map((a) => a.balanceType === 'DR' ? 'rgb(37, 99, 235)' : 'rgb(244, 63, 94)');

          exposureChartInstance = new global.Chart(expEl, {
            type: 'bar',
            data: {
              labels,
              datasets: [{
                label: 'Exposure Balance',
                data: balances,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 22
              }]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  titleColor: '#f8fafc',
                  bodyColor: '#e2e8f0',
                  padding: 10,
                  callbacks: {
                    label: (ctx) => {
                      const acc = accounts[ctx.dataIndex];
                      const typeStr = acc ? acc.balanceType : 'DR';
                      return ` Balance (${typeStr}): ${formatCurrency(ctx.raw)}`;
                    }
                  }
                }
              },
              scales: {
                x: {
                  grid: { color: 'rgba(148, 163, 184, 0.12)' },
                  ticks: {
                    font: { family: 'monospace', size: 9 },
                    callback: (val) => {
                      const n = Number(val);
                      if (Math.abs(n) >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
                      if (Math.abs(n) >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
                      if (Math.abs(n) >= 1000) return '₹' + (n / 1000).toFixed(0) + 'k';
                      return '₹' + n;
                    }
                  }
                },
                y: {
                  grid: { display: false },
                  ticks: { font: { size: 9, weight: 'bold' } }
                }
              },
              onClick: (evt, elements) => {
                if (elements && elements.length > 0) {
                  const idx = elements[0].index;
                  const acc = accounts[idx];
                  if (acc && acc.accountHead) {
                    handleDrillAccount(acc.accountHead);
                  }
                }
              }
            }
          });
        }
      };

      const loadDashboardData = async () => {
        loading.value = true;
        try {
          if (!global.ledgerService) return;

          const [tbRes, typeRes, vRes, jRes] = await Promise.all([
            global.ledgerService.getTrialBalance('', toDate.value),
            global.ledgerService.getAccountTypeSummaries(toDate.value),
            global.ledgerService.getVouchersSummary(),
            global.ledgerService.getJournalSummary()
          ]);

          trialBalance.value = tbRes.rows || [];
          tbSummary.value = tbRes.summary || { totalDebit: 0, totalCredit: 0, isBalanced: true };
          accountTypeSummaries.value = typeRes || [];
          vouchersSummary.value = vRes || {};
          journalSummary.value = jRes || {};
        } catch (err) {
          console.error('Failed to load accounting dashboard data:', err);
        } finally {
          loading.value = false;
          nextTick(() => {
            renderCharts();
          });
        }
      };

      onMounted(() => {
        loadDashboardData();
      });

      onBeforeUnmount(() => {
        destroyCharts();
      });

      // Filtered Heads
      const filteredHeads = computed(() => {
        if (!searchQuery.value) return trialBalance.value;
        const q = searchQuery.value.toLowerCase().trim();
        return trialBalance.value.filter(
          (h) => h.accountHead.toLowerCase().includes(q) || (h.accountType && h.accountType.toLowerCase().includes(q))
        );
      });

      // KPI Ticker Metrics
      const compactStats = computed(() => {
        let assets = 0;
        let liabilities = 0;
        let income = 0;
        let expense = 0;

        for (const r of trialBalance.value) {
          const type = (r.accountType || '').toUpperCase();
          if (['ASSET', 'CURRENT_ASSET', 'FIXED_ASSET', 'BANK', 'CASH', 'CUSTOMER', 'SUNDRY_DEBTORS'].includes(type)) {
            assets += r.balanceType === 'DR' ? r.balance : -r.balance;
          } else if (['LIABILITY', 'CURRENT_LIABILITY', 'LONG_TERM_LIABILITY', 'VENDOR', 'SUNDRY_CREDITORS', 'DUTIES_AND_TAXES'].includes(type)) {
            liabilities += r.balanceType === 'CR' ? r.balance : -r.balance;
          } else if (['INCOME', 'DIRECT_INCOME', 'INDIRECT_INCOME'].includes(type)) {
            income += r.balance;
          } else if (['EXPENSE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'COGS'].includes(type)) {
            expense += r.balance;
          }
        }

        const netProfit = income - expense;

        return [
          {
            label: 'Total Assets (DR)',
            value: formatCurrency(Math.max(0, assets)),
            meta: 'Current & Fixed Assets',
            borderColor: 'border-l-blue-500',
            textColor: 'text-blue-600 dark:text-blue-400'
          },
          {
            label: 'Total Liabilities (CR)',
            value: formatCurrency(Math.max(0, liabilities)),
            meta: 'Creditors & Debt',
            borderColor: 'border-l-rose-500',
            textColor: 'text-rose-600 dark:text-rose-400'
          },
          {
            label: 'Operating Income',
            value: formatCurrency(income),
            meta: 'Sales & Incomes',
            borderColor: 'border-l-emerald-500',
            textColor: 'text-emerald-600 dark:text-emerald-400'
          },
          {
            label: 'Operating Expenses',
            value: formatCurrency(expense),
            meta: 'COGS & Opex',
            borderColor: 'border-l-amber-500',
            textColor: 'text-amber-600 dark:text-amber-400'
          },
          {
            label: 'Net Financial Margin',
            value: formatCurrency(netProfit),
            meta: netProfit >= 0 ? 'Surplus (Profit)' : 'Deficit (Loss)',
            borderColor: 'border-l-violet-500',
            textColor: netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }
        ];
      });

      // Top Exposure Accounts
      const topExposureAccounts = computed(() => {
        return [...trialBalance.value]
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 6);
      });

      const maxExposureBalance = computed(() => {
        if (!topExposureAccounts.value.length) return 1;
        return Math.max(...topExposureAccounts.value.map((a) => a.balance), 1);
      });

      // Drill Down Handler
      const handleDrillAccount = async (accountHead) => {
        selectedAccountForDrill.value = accountHead;
        showDrillModal.value = true;
        drillLoading.value = true;
        try {
          drillStatement.value = await global.ledgerService.getAccountLedgerStatement(accountHead, '', toDate.value);
        } catch (err) {
          console.error('Failed to load drilldown:', err);
        } finally {
          drillLoading.value = false;
        }
      };

      const formatCurrency = (val) => {
        const n = Number(val) || 0;
        return '₹ ' + new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(n);
      };

      return {
        loading,
        toDate,
        activeTab,
        searchQuery,
        trialBalance,
        tbSummary,
        accountTypeSummaries,
        vouchersSummary,
        journalSummary,
        filteredHeads,
        compactStats,
        topExposureAccounts,
        maxExposureBalance,
        showSlglModal,
        showYearEndModal,
        showPeriodLockModal,
        selectedAccountForDrill,
        showDrillModal,
        drillStatement,
        drillLoading,
        loadDashboardData,
        handleDrillAccount,
        formatCurrency
      };
    },
    template: `
      <div class="p-4 py-3 w-full space-y-4">
        <!-- Header Strip -->
        <div class="flex flex-wrap justify-between items-center gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold shadow-md">
              <span>💳</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">
                  Accounting & Financial Ledger Hub
                </h1>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase" :class="tbSummary.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'">
                  {{ tbSummary.isBalanced ? 'Parity Balanced (0.00)' : 'Dr/Cr Mismatch' }}
                </span>
              </div>
              <p class="text-xs text-slate-500 font-bold mt-1">
                Real-time double-entry trial balance, liquidity pulse, and statutory financial compliance
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <div class="hidden sm:flex items-center gap-3 mr-3 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700">
              <div class="text-right">
                <span class="text-[9px] font-bold text-slate-400 uppercase">Total Debit</span>
                <p class="text-xs font-mono font-bold text-emerald-600 leading-tight">{{ formatCurrency(tbSummary.totalDebit) }}</p>
              </div>
              <div class="w-px h-6 bg-slate-200 dark:bg-zinc-700"></div>
              <div class="text-right">
                <span class="text-[9px] font-bold text-slate-400 uppercase">Total Credit</span>
                <p class="text-xs font-mono font-bold text-rose-600 leading-tight">{{ formatCurrency(tbSummary.totalCredit) }}</p>
              </div>
            </div>

            <!-- Audit & Controls Actions -->
            <button 
              @click="showSlglModal = true" 
              class="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Sub-Ledger vs General Ledger Reconciliation"
            >
              <span>🛡️</span>
              <span class="hidden md:inline">SL-GL Audit</span>
            </button>

            <button 
              @click="showYearEndModal = true" 
              class="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Fiscal Year-End Closing Wizard"
            >
              <span>🔒</span>
              <span class="hidden md:inline">Year-End Close</span>
            </button>

            <button 
              @click="showPeriodLockModal = true" 
              class="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Period Lock Registry"
            >
              <span>📅</span>
              <span class="hidden md:inline">Period Lock</span>
            </button>

            <button 
              @click="loadDashboardData" 
              class="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              title="Refresh"
            >
              🔄
            </button>

            <button 
              @click="$emit('open-voucher')" 
              class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>➕</span>
              <span>New Voucher</span>
            </button>
          </div>
        </div>

        <!-- Loader -->
        <div v-if="loading" class="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200">
          <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-3">Synthesizing double-entry ledger analytics...</p>
        </div>

        <template v-else>
          <!-- KPI Ticker Strip -->
          <div class="flex divide-x divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-slate-200 dark:border-zinc-800 overflow-x-auto">
            <div 
              v-for="stat in compactStats" 
              :key="stat.label" 
              class="flex-1 min-w-[180px] p-3.5 py-3 hover:bg-slate-50/60 transition border-l-4"
              :class="stat.borderColor"
            >
              <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{{ stat.label }}</p>
              <div class="text-lg font-black font-mono leading-none tracking-tight" :class="stat.textColor">{{ stat.value }}</div>
              <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{{ stat.meta }}</p>
            </div>
          </div>

          <!-- Charts Row -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- Chart 1: Account Type Mix -->
            <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Account Type Mix (Debit vs Credit)</h3>
                  <p class="text-[10px] text-slate-400">Total transaction debit & credit volume distributed across ledger categories</p>
                </div>
                <div class="flex items-center gap-3 text-[10px] font-bold">
                  <span class="flex items-center gap-1 text-emerald-600"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Dr (Inflow)</span>
                  <span class="flex items-center gap-1 text-rose-600"><span class="w-2 h-2 rounded-full bg-rose-500"></span> Cr (Outflow)</span>
                </div>
              </div>

              <!-- Interactive Chart.js Canvas -->
              <div class="h-56 relative w-full pt-1">
                <canvas id="accountingTypeChart"></canvas>
              </div>
            </div>

            <!-- Chart 2: Top Account Exposure -->
            <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Top Account Balance Exposure</h3>
                  <p class="text-[10px] text-slate-400">Highest volume account heads ranked by net exposure (click bar to drill)</p>
                </div>
                <span class="text-[10px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-zinc-800 px-2 py-0.5 rounded">Interactive</span>
              </div>

              <!-- Interactive Chart.js Canvas -->
              <div class="h-56 relative w-full pt-1">
                <canvas id="accountingExposureChart"></canvas>
              </div>
            </div>
          </div>

          <!-- Main Content Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <!-- Left Column: Voucher Pulse & Quick Workflows -->
            <div class="space-y-4">
              <!-- Voucher Pulse Cards -->
              <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Voucher Pulse & Signals</h3>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                    Net: {{ formatCurrency(vouchersSummary.net_position || 0) }}
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div class="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span class="text-[9px] font-bold text-emerald-600 uppercase">Receipts (In)</span>
                    <p class="text-sm font-mono font-bold text-emerald-800 mt-0.5">{{ formatCurrency(vouchersSummary.total_receipts || 0) }}</p>
                  </div>
                  <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                    <span class="text-[9px] font-bold text-rose-600 uppercase">Payments (Out)</span>
                    <p class="text-sm font-mono font-bold text-rose-800 mt-0.5">{{ formatCurrency(vouchersSummary.total_payments || 0) }}</p>
                  </div>
                  <div class="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                    <span class="text-[9px] font-bold text-blue-600 uppercase">Vouchers (30d)</span>
                    <p class="text-sm font-mono font-bold text-blue-800 mt-0.5">{{ vouchersSummary.recent_transactions_count || 0 }}</p>
                  </div>
                  <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                    <span class="text-[9px] font-bold text-amber-600 uppercase">Journals (Total)</span>
                    <p class="text-sm font-mono font-bold text-amber-800 mt-0.5">{{ journalSummary.recent_journal_entries_count || 0 }}</p>
                  </div>
                </div>
              </div>

              <!-- Quick Workflows -->
              <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs space-y-2">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-2">Quick Navigation</h3>
                <div class="space-y-1.5">
                  <button 
                    @click="$emit('navigate-tab', 'statements')" 
                    class="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    <span class="flex items-center gap-2"><span>📖</span> Day Book & Statements</span>
                    <span>➔</span>
                  </button>
                  <button 
                    @click="$emit('navigate-tab', 'banking')" 
                    class="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    <span class="flex items-center gap-2"><span>🏦</span> Banking & Treasury Hub</span>
                    <span>➔</span>
                  </button>
                  <button 
                    @click="$emit('navigate-tab', 'parties')" 
                    class="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    <span class="flex items-center gap-2"><span>👥</span> Parties & Sub-Ledger</span>
                    <span>➔</span>
                  </button>
                  <button 
                    @click="$emit('open-voucher')" 
                    class="w-full p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 flex items-center justify-between text-xs font-bold text-blue-700 transition cursor-pointer"
                  >
                    <span class="flex items-center gap-2"><span>➕</span> Create New Voucher</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Right 2 Columns: Account Head & Type Registers -->
            <div class="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
              <!-- Toolbar -->
              <div class="p-4 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <div class="bg-slate-100 p-1 rounded-xl flex gap-1">
                    <button 
                      @click="activeTab = 'heads'" 
                      :class="activeTab === 'heads' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'"
                      class="px-3 py-1 rounded-lg text-xs font-bold uppercase cursor-pointer transition"
                    >
                      Account Heads ({{ trialBalance.length }})
                    </button>
                    <button 
                      @click="activeTab = 'types'" 
                      :class="activeTab === 'types' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'"
                      class="px-3 py-1 rounded-lg text-xs font-bold uppercase cursor-pointer transition"
                    >
                      Account Types ({{ accountTypeSummaries.length }})
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto">
                  <input 
                    type="text" 
                    v-model="searchQuery" 
                    placeholder="Search account head..." 
                    class="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold w-full sm:w-48"
                  />
                  <input 
                    type="date" 
                    v-model="toDate" 
                    @change="loadDashboardData" 
                    class="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>
              </div>

              <!-- Heads Table -->
              <div v-if="activeTab === 'heads'" class="overflow-x-auto flex-1 max-h-[460px]">
                <table class="w-full text-left text-xs border-collapse">
                  <thead class="bg-slate-50 dark:bg-zinc-800 sticky top-0 text-[10px] font-black uppercase text-slate-500">
                    <tr>
                      <th class="p-3">Account Head</th>
                      <th class="p-3">Category</th>
                      <th class="p-3 text-right">Debit (Dr)</th>
                      <th class="p-3 text-right">Credit (Cr)</th>
                      <th class="p-3 text-right">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
                    <tr 
                      v-for="row in filteredHeads" 
                      :key="row.accountHead" 
                      @click="handleDrillAccount(row.accountHead)"
                      class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 cursor-pointer group transition"
                    >
                      <td class="p-3 font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition flex items-center gap-2">
                        <span>{{ row.accountHead }}</span>
                        <span class="text-[9px] text-slate-400 group-hover:inline hidden">🔍</span>
                      </td>
                      <td class="p-3 text-slate-500 font-semibold text-[10px] uppercase">
                        {{ row.accountType?.replace(/_/g, ' ') }}
                      </td>
                      <td class="p-3 text-right font-mono font-medium text-slate-600 dark:text-zinc-400">{{ formatCurrency(row.totalDebit) }}</td>
                      <td class="p-3 text-right font-mono font-medium text-slate-600 dark:text-zinc-400">{{ formatCurrency(row.totalCredit) }}</td>
                      <td class="p-3 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          <span class="font-mono font-bold" :class="row.balanceType === 'DR' ? 'text-emerald-600' : 'text-rose-600'">
                            {{ formatCurrency(row.balance) }}
                          </span>
                          <span class="px-1.5 py-0.5 rounded text-[8px] font-bold" :class="row.balanceType === 'DR' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'">
                            {{ row.balanceType }}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Types Table -->
              <div v-else class="overflow-x-auto flex-1 max-h-[460px]">
                <table class="w-full text-left text-xs border-collapse">
                  <thead class="bg-slate-50 dark:bg-zinc-800 sticky top-0 text-[10px] font-black uppercase text-slate-500">
                    <tr>
                      <th class="p-3">Account Category</th>
                      <th class="p-3 text-right">Heads Count</th>
                      <th class="p-3 text-right">Total Debit</th>
                      <th class="p-3 text-right">Total Credit</th>
                      <th class="p-3 text-right">Net Position</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
                    <tr v-for="t in accountTypeSummaries" :key="t.account_type" class="hover:bg-slate-50/80 transition">
                      <td class="p-3 font-bold uppercase text-slate-800 dark:text-white">{{ t.account_type?.replace(/_/g, ' ') }}</td>
                      <td class="p-3 text-right font-mono font-bold text-slate-500">{{ t.account_count }}</td>
                      <td class="p-3 text-right font-mono font-medium text-slate-600">{{ formatCurrency(t.total_debit) }}</td>
                      <td class="p-3 text-right font-mono font-medium text-slate-600">{{ formatCurrency(t.total_credit) }}</td>
                      <td class="p-3 text-right">
                        <span class="font-mono font-bold" :class="t.total_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                          {{ formatCurrency(Math.abs(t.total_balance)) }} ({{ t.total_balance >= 0 ? 'DR' : 'CR' }})
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </template>

        <!-- Sub-Ledger Drilldown Statement Modal -->
        <div v-if="showDrillModal" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-800 animate-scale-in">
            <div class="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 class="text-base font-black uppercase tracking-wider">{{ selectedAccountForDrill }} — Statement</h3>
                <p class="text-xs text-slate-300">Chronological transaction flow & running balance drilldown</p>
              </div>
              <button @click="showDrillModal = false" class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div class="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div v-if="drillLoading" class="py-12 text-center text-slate-400">Loading account statement...</div>
              <template v-else-if="drillStatement">
                <div class="grid grid-cols-4 gap-3">
                  <div class="p-3 rounded-xl bg-slate-50 border">
                    <span class="text-[9px] font-bold text-slate-400 uppercase">Opening Balance</span>
                    <p class="text-sm font-mono font-bold mt-0.5">{{ formatCurrency(drillStatement.openingBalance) }} ({{ drillStatement.openingType }})</p>
                  </div>
                  <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span class="text-[9px] font-bold text-emerald-600 uppercase">Total Debit (Dr)</span>
                    <p class="text-sm font-mono font-bold text-emerald-800 mt-0.5">{{ formatCurrency(drillStatement.totalDebit) }}</p>
                  </div>
                  <div class="p-3 rounded-xl bg-rose-50 border border-rose-100">
                    <span class="text-[9px] font-bold text-rose-600 uppercase">Total Credit (Cr)</span>
                    <p class="text-sm font-mono font-bold text-rose-800 mt-0.5">{{ formatCurrency(drillStatement.totalCredit) }}</p>
                  </div>
                  <div class="p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <span class="text-[9px] font-bold text-blue-600 uppercase">Closing Balance</span>
                    <p class="text-sm font-mono font-bold text-blue-800 mt-0.5">{{ formatCurrency(drillStatement.closingBalance) }} ({{ drillStatement.closingType }})</p>
                  </div>
                </div>

                <div class="border rounded-xl overflow-hidden">
                  <table class="w-full text-left">
                    <thead class="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th class="p-2.5">Date</th>
                        <th class="p-2.5">Voucher</th>
                        <th class="p-2.5">Narration</th>
                        <th class="p-2.5 text-right">Debit</th>
                        <th class="p-2.5 text-right">Credit</th>
                        <th class="p-2.5 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <tr v-for="e in drillStatement.entries" :key="e.id">
                        <td class="p-2.5 font-mono text-[11px]">{{ e.transactionDate }}</td>
                        <td class="p-2.5 font-bold font-mono">{{ e.voucherNo }}</td>
                        <td class="p-2.5 text-slate-600">{{ e.narration }}</td>
                        <td class="p-2.5 text-right font-mono text-emerald-600">{{ e.debitAmount > 0 ? formatCurrency(e.debitAmount) : '-' }}</td>
                        <td class="p-2.5 text-right font-mono text-rose-600">{{ e.creditAmount > 0 ? formatCurrency(e.creditAmount) : '-' }}</td>
                        <td class="p-2.5 text-right font-mono font-bold">{{ formatCurrency(e.runningBalance) }} {{ e.runningBalanceType }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Modals Components -->
        <SLGLAuditModalComponent v-model="showSlglModal" />
        <YearEndClosingModalComponent v-model="showYearEndModal" @closed="loadDashboardData" />
        <PeriodLockModalComponent v-model="showPeriodLockModal" @lock-updated="loadDashboardData" />
      </div>
    `
  };

  global.AccountingDashboardComponent = AccountingDashboardComponent;
})(typeof window !== 'undefined' ? window : this);
