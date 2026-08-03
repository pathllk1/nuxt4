<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAccounting } from '@/composables/useAccounting';

const router = useRouter();
const { trialBalance, fetchTrialBalance, exportProfitLossPdf, exportBalanceSheetPdf, exportProfitLossExcel, exportBalanceSheetExcel, loading, error } = useAccounting();

const exportLoading = ref(false);
const onExportPDF = async () => {
  exportLoading.value = true;
  try {
    const params: { fromDate?: string; toDate?: string } = {};
    if (fromDate.value) params.fromDate = fromDate.value;
    if (toDate.value) params.toDate = toDate.value;
    
    if (activeTab.value === 'pl') {
      await exportProfitLossPdf(params);
    } else {
      await exportBalanceSheetPdf(params);
    }
  } catch (err: any) {
    console.error('Failed to export PDF:', err);
  } finally {
    exportLoading.value = false;
  }
};

const onExportExcel = async () => {
  exportLoading.value = true;
  try {
    const params: { fromDate?: string; toDate?: string } = {};
    if (fromDate.value) params.fromDate = fromDate.value;
    if (toDate.value) params.toDate = toDate.value;
    
    if (activeTab.value === 'pl') {
      await exportProfitLossExcel(params);
    } else {
      await exportBalanceSheetExcel(params);
    }
  } catch (err: any) {
    console.error('Failed to export Excel:', err);
  } finally {
    exportLoading.value = false;
  }
};

const activeTab = ref('pl');
const fromDate = ref('');
const toDate = ref(new Date().toISOString().split('T')[0]);

const loadData = async () => {
  const params: { fromDate?: string; toDate?: string } = {};
  if (fromDate.value) params.fromDate = fromDate.value;
  if (toDate.value) params.toDate = toDate.value;
  await fetchTrialBalance(params);
};

const clearFilters = async () => {
  fromDate.value = '';
  toDate.value = new Date().toISOString().split('T')[0];
  await loadData();
};

const formatINR = (n: number) => {
  const frac = Math.abs(n) >= 100000 ? 0 : 2;
  return '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac
  }).format(n);
};

const formatPercent = (v: number) => {
  return `${(Number.isFinite(v) ? Math.abs(v) : 0).toFixed(1)}%`;
};

const isCOGS = (head: string, type: string) => {
  if (type === 'COGS') return true;
  const h = head.toLowerCase();
  return ['cogs', 'cost of goods', 'purchase', 'inventory'].some(k => h.includes(k)) && (type === 'EXPENSE' || type === 'COGS');
};

const isStock = (head: string) => {
  const h = head.toLowerCase();
  return ['inventory', 'stock'].some(k => h.includes(k));
};

const isGSTRec = (head: string) => {
  const h = head.toLowerCase();
  return ['gst', 'cgst', 'sgst', 'igst', 'tax receivable', 'input credit', 'input tax'].some(k => h.includes(k));
};

const plModel = computed(() => {
  const plAccounts = trialBalance.value.filter(a => 
    ['INCOME', 'EXPENSE', 'COGS', 'GENERAL'].includes(a.accountType)
  ).map(a => {
    const netDr = a.totalDebit - a.totalCredit;
    const netCr = a.totalCredit - a.totalDebit;
    return {
      head: a.accountHead,
      type: a.accountType,
      netDr,
      netCr
    };
  });

  const income = plAccounts.filter(a => a.type === 'INCOME');
  const expense = plAccounts.filter(a => a.type === 'EXPENSE' || a.type === 'COGS');
  const general = plAccounts.filter(a => a.type === 'GENERAL');

  const cogs = expense.filter(a => isCOGS(a.head, a.type));
  const opex = expense.filter(a => !isCOGS(a.head, a.type));

  const crIncome = income.filter(a => a.netCr >= 0);
  const drContraIncome = income.filter(a => a.netCr < 0);
  const drCOGS = cogs.filter(a => a.netCr <= 0);
  const crCOGS = cogs.filter(a => a.netCr > 0);
  const drOpex = opex.filter(a => a.netCr <= 0);
  const crOpex = opex.filter(a => a.netCr > 0);
  const crGeneral = general.filter(a => a.netCr >= 0);
  const drGeneral = general.filter(a => a.netCr < 0);

  const totalRevenueCr = crIncome.reduce((s, a) => s + a.netCr, 0);
  const totalContraInc = drContraIncome.reduce((s, a) => s + Math.abs(a.netCr), 0);
  const totalCOGS = drCOGS.reduce((s, a) => s + Math.abs(a.netCr), 0) - crCOGS.reduce((s, a) => s + a.netCr, 0);
  const totalOpex = drOpex.reduce((s, a) => s + Math.abs(a.netCr), 0) - crOpex.reduce((s, a) => s + a.netCr, 0);
  const totalGeneralNet = general.reduce((s, a) => s + a.netCr, 0);

  const effectiveRevenue = totalRevenueCr - totalContraInc;
  const grossProfit = effectiveRevenue - totalCOGS;
  const netProfit = grossProfit - totalOpex + totalGeneralNet;
  const gpMargin = effectiveRevenue ? (grossProfit / effectiveRevenue) * 100 : 0;
  const npMargin = effectiveRevenue ? (netProfit / effectiveRevenue) * 100 : 0;

  const drItems = totalCOGS + totalContraInc + totalOpex + 
                  drGeneral.reduce((s, a) => s + Math.abs(a.netCr), 0) - 
                  crCOGS.reduce((s, a) => s + a.netCr, 0) - 
                  crOpex.reduce((s, a) => s + a.netCr, 0);
  const crItems = totalRevenueCr + 
                  crGeneral.reduce((s, a) => s + a.netCr, 0) + 
                  crCOGS.reduce((s, a) => s + a.netCr, 0) + 
                  crOpex.reduce((s, a) => s + a.netCr, 0);
  const drGrand = drItems + Math.max(netProfit, 0);
  const crGrand = crItems + Math.max(-netProfit, 0);

  return {
    crIncome, drContraIncome, drCOGS, crCOGS, drOpex, crOpex, crGeneral, drGeneral,
    totalRevenueCr, totalContraInc, effectiveRevenue,
    totalCOGS, totalOpex, totalGeneralNet,
    grossProfit, netProfit, gpMargin, npMargin,
    drGrand, crGrand,
    isEmpty: plAccounts.length === 0
  };
});

const bsModel = computed(() => {
  const bsAccounts = trialBalance.value.filter(a => 
    ['ASSET', 'LIABILITY', 'DEBTOR', 'CREDITOR', 'CASH', 'BANK', 'PAYABLE', 'CAPITAL', 'LABOR_LEADER'].includes(a.accountType)
  ).map(a => {
    const netDr = a.totalDebit - a.totalCredit;
    const netCr = a.totalCredit - a.totalDebit;
    return {
      head: a.accountHead,
      type: a.accountType,
      netDr,
      netCr
    };
  });

  const assetsRaw = bsAccounts.filter(a => ['ASSET', 'CASH', 'BANK', 'DEBTOR'].includes(a.type));
  const liabilitiesRaw = bsAccounts.filter(a => ['LIABILITY', 'PAYABLE', 'CREDITOR', 'LABOR_LEADER'].includes(a.type));

  const stockAssets = assetsRaw.filter(a => isStock(a.head) && a.netDr > 0);
  const gstAssets = assetsRaw.filter(a => !isStock(a.head) && isGSTRec(a.head) && a.netDr > 0);
  const otherAssets = assetsRaw.filter(a => !isStock(a.head) && !isGSTRec(a.head) && a.type === 'ASSET' && a.netDr > 0);
  const debtors = assetsRaw.filter(a => a.type === 'DEBTOR' && a.netDr > 0);
  const cashBank = assetsRaw.filter(a => ['CASH', 'BANK'].includes(a.type) && a.netDr > 0);
  const liabilityDebitBalances = liabilitiesRaw.filter(a => a.netDr > 0);

  const totalStock = stockAssets.reduce((s, a) => s + a.netDr, 0);
  const totalGST = gstAssets.reduce((s, a) => s + a.netDr, 0);
  const totalOtherA = otherAssets.reduce((s, a) => s + a.netDr, 0);
  const totalDebtors = debtors.reduce((s, a) => s + a.netDr, 0);
  const totalCashBank = cashBank.reduce((s, a) => s + a.netDr, 0);
  const totalLiabilityDebitBalances = liabilityDebitBalances.reduce((s, a) => s + a.netDr, 0);

  const totalAssets = totalStock + totalGST + totalOtherA + totalDebtors + totalCashBank + totalLiabilityDebitBalances;

  const liabilities = liabilitiesRaw.filter(a => ['LIABILITY', 'PAYABLE', 'LABOR_LEADER'].includes(a.type) && a.netCr > 0);
  const creditors = liabilitiesRaw.filter(a => a.type === 'CREDITOR' && a.netCr > 0);
  const assetCreditBalances = assetsRaw.filter(a => a.type === 'ASSET' && a.netCr > 0);
  const debtorCreditBalances = assetsRaw.filter(a => a.type === 'DEBTOR' && a.netCr > 0);
  const cashBankCreditBalances = assetsRaw.filter(a => ['CASH', 'BANK'].includes(a.type) && a.netCr > 0);

  const totalLiab = liabilities.reduce((s, a) => s + a.netCr, 0);
  const totalCred = creditors.reduce((s, a) => s + a.netCr, 0);
  const totalAssetCreditBalances = assetCreditBalances.reduce((s, a) => s + a.netCr, 0);
  const totalDebtorCreditBalances = debtorCreditBalances.reduce((s, a) => s + a.netCr, 0);
  const totalCashBankCreditBalances = cashBankCreditBalances.reduce((s, a) => s + a.netCr, 0);

  const totalExtLib = totalLiab + totalCred + totalAssetCreditBalances + totalDebtorCreditBalances + totalCashBankCreditBalances;

  const netProfit = plModel.value.netProfit;
  const capital = totalAssets - totalExtLib - netProfit;
  const totalLiabSide = totalExtLib + capital + netProfit;

  const balanced = Math.abs(totalAssets - totalLiabSide) < 0.02;

  const assetSideCount = stockAssets.length + gstAssets.length + otherAssets.length + debtors.length + cashBank.length + liabilityDebitBalances.length;
  const liabilitySideCount = liabilities.length + creditors.length + assetCreditBalances.length + debtorCreditBalances.length + cashBankCreditBalances.length;

  return {
    stockAssets, gstAssets, otherAssets, debtors, cashBank, liabilityDebitBalances,
    totalStock, totalGST, totalOtherA, totalDebtors, totalCashBank, totalLiabilityDebitBalances, totalAssets,
    liabilities, creditors, assetCreditBalances, debtorCreditBalances, cashBankCreditBalances,
    totalLiab, totalCred, totalAssetCreditBalances, totalDebtorCreditBalances, totalCashBankCreditBalances, totalExtLib,
    capital, netProfit,
    assetSideCount, liabilitySideCount,
    totalLiabSide, balanced,
    isEmpty: bsAccounts.length === 0
  };
});

const triggerPrint = () => {
  window.print();
};

const viewLedger = (head: string) => {
  router.push({ path: '/accounting/ledger-view', query: { head } });
};

onMounted(loadData);
</script>

<template>
  <div class="p-4 py-3 max-w-[1600px] mx-auto space-y-3 print:p-0 print:space-y-2">
    <!-- Header -->
    <div class="flex justify-between items-end mb-1 print:hidden">
      <div>
        <div class="flex items-center gap-2 mb-0.5">
           <span class="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse"></span>
           <span class="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest leading-none">Accounting Reports</span>
        </div>
        <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Financial Statements</h1>
        <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mt-1">Profit &amp; Loss Statement and Balance Sheet</p>
      </div>
      
      <!-- Date Filters & Actions -->
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 mr-1">
          <span class="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 ml-1">From</span>
          <UInput type="date" v-model="fromDate" size="sm" class="w-36" />
          <span class="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 ml-1">To</span>
          <UInput type="date" v-model="toDate" size="sm" class="w-36" />
        </div>
        <UButton color="primary" label="Apply" size="sm" class="font-bold text-xs h-8" @click="loadData" />
        <UButton color="neutral" variant="ghost" label="Reset" size="sm" class="font-bold text-xs h-8" @click="clearFilters" />
        <UButton 
          color="success" 
          variant="outline" 
          icon="i-heroicons-arrow-down-tray"
          label="PDF"
          size="sm"
          class="font-bold text-xs h-8"
          :loading="exportLoading"
          @click="onExportPDF"
        />
        <UButton 
          color="success" 
          variant="outline" 
          icon="i-heroicons-arrow-down-tray"
          label="Excel"
          size="sm"
          class="font-bold text-xs h-8"
          :loading="exportLoading"
          @click="onExportExcel"
        />
        <UButton 
          color="primary" 
          variant="solid" 
          icon="i-heroicons-printer"
          label="Print"
          size="sm"
          class="font-bold text-xs h-8"
          @click="triggerPrint"
        />
        <UButton 
          color="neutral" 
          variant="outline" 
          icon="i-heroicons-arrow-left"
          label="Dashboard"
          size="sm"
          class="font-bold text-xs h-8"
          @click="router.push('/accounting')"
        />
      </div>
    </div>

    <!-- Print Header Information -->
    <div class="hidden print:block mb-4 space-y-1">
      <h1 class="text-xl font-black uppercase tracking-tight">Financial Statements</h1>
      <p class="text-[10px] text-slate-500 font-medium">Profit &amp; Loss Statement and Balance Sheet</p>
      <p v-if="fromDate || toDate" class="text-[10px] font-bold text-violet-600">
        Period: {{ fromDate ? fromDate : 'Beginning' }} to {{ toDate }}
      </p>
    </div>

    <!-- Tab Selection -->
    <div class="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm w-fit print:hidden">
      <UButton 
        :variant="activeTab === 'pl' ? 'solid' : 'ghost'"
        :color="activeTab === 'pl' ? 'primary' : 'neutral'"
        size="sm"
        class="font-black text-[10px] uppercase tracking-wider rounded-lg px-4"
        label="Profit & Loss"
        @click="activeTab = 'pl'"
      />
      <UButton 
        :variant="activeTab === 'bs' ? 'solid' : 'ghost'"
        :color="activeTab === 'bs' ? 'primary' : 'neutral'"
        size="sm"
        class="font-black text-[10px] uppercase tracking-wider rounded-lg px-4"
        label="Balance Sheet"
        @click="activeTab = 'bs'"
      />
    </div>

    <!-- Error State -->
    <div v-if="error" class="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex items-center justify-between print:hidden">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-rose-500" />
        <p class="text-xs font-bold">{{ error }}</p>
      </div>
      <UButton color="error" size="xs" label="Retry" @click="loadData" />
    </div>

    <!-- Loader -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-xl border border-gray-100 dark:border-zinc-800">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
      <p class="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">Loading statements...</p>
    </div>

    <!-- MAIN PANELS -->
    <div v-else-if="!loading" class="space-y-3">
      
      <!-- 1. PROFIT & LOSS TAB -->
      <div v-show="activeTab === 'pl'" class="space-y-3 print-tab-content">
        <!-- KPI Row -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-1">
          <UCard class="border-l-4 border-l-emerald-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
            <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Revenue</p>
            <div class="text-lg font-black text-slate-900 dark:text-white font-mono leading-tight">{{ formatINR(plModel.totalRevenueCr) }}</div>
            <p class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">{{ plModel.crIncome.length }} account(s)</p>
          </UCard>
          <UCard class="border-l-4 border-l-sky-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
            <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Gross Profit</p>
            <div class="text-lg font-black font-mono leading-tight" :class="plModel.grossProfit >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'">{{ formatINR(Math.abs(plModel.grossProfit)) }}</div>
            <p class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">{{ formatPercent(plModel.gpMargin) }} GP Margin</p>
          </UCard>
          <UCard class="border-l-4 border-l-amber-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
            <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Total OpEx</p>
            <div class="text-lg font-black text-slate-900 dark:text-white font-mono leading-tight">{{ formatINR(plModel.totalOpex) }}</div>
            <p class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">{{ plModel.drOpex.length }} account(s)</p>
          </UCard>
          <UCard class="border-l-4 border-l-violet-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
            <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Net Profit</p>
            <div class="text-lg font-black font-mono leading-tight" :class="plModel.netProfit >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'">{{ formatINR(Math.abs(plModel.netProfit)) }}</div>
            <p class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">{{ formatPercent(plModel.npMargin) }} NP Margin</p>
          </UCard>
        </div>

        <div v-if="plModel.isEmpty" class="bg-white dark:bg-zinc-900 p-16 rounded-xl border border-gray-100 dark:border-zinc-800 text-center text-slate-400 dark:text-zinc-500 italic">
          No Income/Expense transactions to generate Profit &amp; Loss.
        </div>

        <!-- Statement T-Table -->
        <UCard v-else class="w-full shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden" :ui="{ body: 'p-0' }">
          <div class="bg-slate-950 dark:bg-zinc-900 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 text-white">
            <div>
              <p class="text-[9px] font-black uppercase tracking-wider text-slate-400">Trading &amp; Profit &amp; Loss Statement</p>
              <p class="text-[8px] text-slate-300 font-bold">Point-in-time calculation</p>
            </div>
            <div class="flex items-center gap-4 text-[10px] font-mono font-bold">
              <div class="text-right">
                <span class="text-slate-400 uppercase mr-1.5">Dr:</span>
                <span class="text-rose-400">{{ formatINR(plModel.drGrand) }}</span>
              </div>
              <div class="h-4 w-px bg-slate-800"></div>
              <div class="text-right">
                <span class="text-slate-400 uppercase mr-1.5">Cr:</span>
                <span class="text-emerald-400">{{ formatINR(plModel.crGrand) }}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-zinc-800">
            <!-- DEBIT SIDE (EXPENSES) -->
            <div class="flex flex-col">
              <div class="py-2 px-4 bg-slate-50/50 dark:bg-zinc-800/20 border-b border-gray-100 dark:border-zinc-800 text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <span class="w-2 h-2 rounded-full bg-rose-500"></span> Debit Side (Dr)
              </div>
              
              <!-- COGS Segment -->
              <div>
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>To Cost of Goods Sold</span>
                  <span>{{ plModel.drCOGS.length }} A/Cs</span>
                </div>
                <div v-for="a in plModel.drCOGS" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(Math.abs(a.netCr)) }}</span>
                </div>
                <div v-if="plModel.drCOGS.length === 0" class="py-2 px-4 text-center text-[10px] text-slate-400 border-b border-gray-100 dark:border-zinc-800/40 italic">No COGS accounts</div>
                <div class="py-1.5 px-4 bg-amber-50/30 dark:bg-amber-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Cost of Sales</span>
                  <span class="font-mono text-amber-700 dark:text-amber-400 font-bold">{{ formatINR(plModel.totalCOGS) }}</span>
                </div>
              </div>

              <!-- Contra Income Segment -->
              <div v-if="plModel.drContraIncome.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>To Returns / Contra Income</span>
                  <span>{{ plModel.drContraIncome.length }} A/Cs</span>
                </div>
                <div v-for="a in plModel.drContraIncome" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(Math.abs(a.netCr)) }}</span>
                </div>
                <div class="py-1.5 px-4 bg-orange-50/30 dark:bg-orange-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Contra Income</span>
                  <span class="font-mono text-orange-700 dark:text-orange-400 font-bold">{{ formatINR(plModel.totalContraInc) }}</span>
                </div>
              </div>

              <!-- Operating Expenses Segment -->
              <div>
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>To Operating Expenses</span>
                  <span>{{ plModel.drOpex.length }} A/Cs</span>
                </div>
                <div v-for="a in plModel.drOpex" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(Math.abs(a.netCr)) }}</span>
                </div>
                <div v-if="plModel.drOpex.length === 0" class="py-2 px-4 text-center text-[10px] text-slate-400 border-b border-gray-100 dark:border-zinc-800/40 italic">No operating expenses</div>
                <div class="py-1.5 px-4 bg-rose-50/30 dark:bg-rose-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Operating Expenses</span>
                  <span class="font-mono text-rose-700 dark:text-rose-400 font-bold">{{ formatINR(plModel.totalOpex) }}</span>
                </div>
              </div>

              <!-- General net debit Segment -->
              <div v-if="plModel.drGeneral.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 leading-none">To Miscellaneous Expenses</div>
                <div v-for="a in plModel.drGeneral" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(Math.abs(a.netCr)) }}</span>
                </div>
              </div>

              <!-- Balancing figure Net Profit -->
              <div v-if="plModel.netProfit >= 0" class="py-3 px-4 mt-auto bg-violet-50/60 dark:bg-violet-950/20 border-t border-violet-100 dark:border-violet-850/40 flex justify-between text-xs font-black text-violet-800 dark:text-violet-400">
                <div>
                  <p class="uppercase tracking-wider font-black">To Net Profit</p>
                  <p class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5">Transferred to Capital</p>
                </div>
                <span class="font-mono text-sm font-black">{{ formatINR(plModel.netProfit) }}</span>
              </div>
            </div>

            <!-- CREDIT SIDE (REVENUES) -->
            <div class="flex flex-col">
              <div class="py-2 px-4 bg-slate-50/50 dark:bg-zinc-800/20 border-b border-gray-100 dark:border-zinc-800 text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Credit Side (Cr)
              </div>

              <!-- Revenue Sales Segment -->
              <div>
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>By Revenue / Sales</span>
                  <span>{{ plModel.crIncome.length }} A/Cs</span>
                </div>
                <div v-for="a in plModel.crIncome" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netCr) }}</span>
                </div>
                <div v-if="plModel.crIncome.length === 0" class="py-2 px-4 text-center text-[10px] text-slate-400 border-b border-gray-100 dark:border-zinc-800/40 italic">No income accounts</div>
                <div class="py-1.5 px-4 bg-emerald-50/30 dark:bg-emerald-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Revenue</span>
                  <span class="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{{ formatINR(plModel.totalRevenueCr) }}</span>
                </div>
              </div>

              <!-- General net credit Segment -->
              <div v-if="plModel.crGeneral.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>By Miscellaneous Income</span>
                  <span>{{ plModel.crGeneral.length }} A/Cs</span>
                </div>
                <div v-for="a in plModel.crGeneral" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netCr) }}</span>
                </div>
                <div class="py-1.5 px-4 bg-teal-50/30 dark:bg-teal-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Misc Income</span>
                  <span class="font-mono text-teal-700 dark:text-teal-400 font-bold">{{ formatINR(plModel.crGeneral.reduce((s,a)=>s+a.netCr,0)) }}</span>
                </div>
              </div>

              <!-- Contra Expense Segment -->
              <div v-if="plModel.crCOGS.length + plModel.crOpex.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 leading-none">By Contra Expense</div>
                <div v-for="a in [...plModel.crCOGS, ...plModel.crOpex]" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netCr) }}</span>
                </div>
              </div>

              <!-- Balancing figure Net Loss -->
              <div v-if="plModel.netProfit < 0" class="py-3 px-4 mt-auto bg-rose-50/60 dark:bg-rose-950/20 border-t border-rose-100 dark:border-rose-850/40 flex justify-between text-xs font-black text-rose-800 dark:text-rose-400">
                <div>
                  <p class="text-xs uppercase tracking-wider font-black">By Net Loss</p>
                  <p class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5">Transferred to Capital</p>
                </div>
                <span class="font-mono text-sm font-black">{{ formatINR(Math.abs(plModel.netProfit)) }}</span>
              </div>
              <div v-else class="flex-1 min-h-[36px]"></div>
            </div>
          </div>

          <!-- Statement Footer Totals -->
          <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 text-white font-black" :class="plModel.netProfit >= 0 ? 'bg-gradient-to-br from-violet-600 to-indigo-700' : 'bg-gradient-to-br from-rose-600 to-pink-800'">
            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">Dr Total</span>
              <span class="text-base font-black font-mono tabular-nums leading-none">{{ formatINR(plModel.drGrand) }}</span>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">Cr Total</span>
              <span class="text-base font-black font-mono tabular-nums leading-none">{{ formatINR(plModel.crGrand) }}</span>
            </div>
          </div>
        </UCard>
      </div>

      <!-- 2. BALANCE SHEET TAB -->
      <div v-show="activeTab === 'bs'" class="space-y-3 print-tab-content">
        <!-- BS KPI Row -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-1">
          <UCard class="border-l-4 border-l-sky-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
            <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Total Assets</p>
            <div class="text-lg font-black text-slate-900 dark:text-white font-mono leading-tight">{{ formatINR(bsModel.totalAssets) }}</div>
            <p class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">{{ bsModel.assetSideCount }} asset A/Cs</p>
          </UCard>
          <UCard class="border-l-4 border-l-rose-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
            <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">External Liabilities</p>
            <div class="text-lg font-black text-slate-900 dark:text-white font-mono leading-tight">{{ formatINR(bsModel.totalExtLib) }}</div>
            <p class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">{{ bsModel.liabilitySideCount }} liability A/Cs</p>
          </UCard>
          <UCard class="border-l-4 border-l-emerald-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
            <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Capital (Equity)</p>
            <div class="text-lg font-black font-mono leading-tight" :class="bsModel.capital >= 0 ? 'text-emerald-600' : 'text-rose-600'">{{ formatINR(Math.abs(bsModel.capital)) }}</div>
            <p class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">{{ bsModel.capital >= 0 ? 'Owner Equity' : 'Equity Deficit' }}</p>
          </UCard>
          <UCard class="border-l-4 border-l-violet-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
            <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Net Profit / (Loss)</p>
            <div class="text-lg font-black font-mono leading-tight" :class="bsModel.netProfit >= 0 ? 'text-violet-600' : 'text-rose-600'">{{ formatINR(Math.abs(bsModel.netProfit)) }}</div>
            <p class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">Period Income</p>
          </UCard>
        </div>

        <!-- Balance sheet warning/balanced tag -->
        <div class="flex items-center gap-2 print:hidden">
          <UBadge 
            :color="bsModel.balanced ? 'success' : 'error'" 
            variant="subtle" 
            size="sm" 
            class="font-black text-[9px] uppercase rounded-md"
          >
            <UIcon v-if="bsModel.balanced" name="i-heroicons-check-circle" class="w-3.5 h-3.5 mr-1" />
            <UIcon v-else name="i-heroicons-exclamation-triangle" class="w-3.5 h-3.5 mr-1" />
            {{ bsModel.balanced ? 'Balanced' : `Imbalanced — ${formatINR(Math.abs(bsModel.totalAssets - bsModel.totalLiabSide))} difference` }}
          </UBadge>
          <span class="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase">Capital is computed dynamically as: Total Assets - Liabilities - Net Profit</span>
        </div>

        <div v-if="bsModel.isEmpty" class="bg-white dark:bg-zinc-900 p-16 rounded-xl border border-gray-100 dark:border-zinc-800 text-center text-slate-400 dark:text-zinc-500 italic">
          No Asset/Liability transactions to generate Balance Sheet.
        </div>

        <!-- Balance Sheet T-Table -->
        <UCard v-else class="w-full shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden" :ui="{ body: 'p-0' }">
          <div class="bg-slate-950 dark:bg-zinc-900 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 text-white">
            <div>
              <p class="text-[9px] font-black uppercase tracking-wider text-slate-400">Balance Sheet</p>
              <p class="text-[8px] text-slate-300 font-bold">Double-entry balancing statement</p>
            </div>
            <div class="flex items-center gap-4 text-[10px] font-mono font-bold">
              <div class="text-right">
                <span class="text-slate-400 uppercase mr-1.5">Liabilities Total:</span>
                <span class="text-rose-300">{{ formatINR(bsModel.totalLiabSide) }}</span>
              </div>
              <div class="h-4 w-px bg-slate-800"></div>
              <div class="text-right">
                <span class="text-slate-400 uppercase mr-1.5">Assets Total:</span>
                <span class="text-emerald-400">{{ formatINR(bsModel.totalAssets) }}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-zinc-800">
            <!-- LIABILITIES & CAPITAL SIDE (L) -->
            <div class="flex flex-col">
              <div class="py-2 px-4 bg-slate-50/50 dark:bg-zinc-800/20 border-b border-gray-100 dark:border-zinc-800 text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <span class="w-2 h-2 rounded-full bg-rose-500"></span> Liabilities &amp; Capital
              </div>

              <!-- Capital account details -->
              <div class="border-b border-gray-100 dark:border-zinc-800/40">
                <div class="py-1 px-4 bg-emerald-50/30 dark:bg-emerald-950/10 text-[8px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex justify-between leading-none">
                  <span>Capital Account</span>
                  <span>Computed</span>
                </div>
                <div class="py-1.5 px-4 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300">
                  <div class="flex flex-col">
                    <span class="font-bold">Capital / Owner's Equity</span>
                    <span class="text-[8px] text-slate-400 dark:text-zinc-500 uppercase mt-0.5">Assets – Liabilities – Net Profit</span>
                  </div>
                  <span class="font-mono font-bold" :class="bsModel.capital >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">{{ formatINR(Math.abs(bsModel.capital)) }}</span>
                </div>
                <div class="py-1.5 px-4 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-t border-gray-100 dark:border-zinc-800/30">
                  <div class="flex flex-col">
                    <span class="font-bold">{{ bsModel.netProfit >= 0 ? 'Add: Net Profit' : 'Less: Net Loss' }}</span>
                    <span class="text-[8px] text-slate-400 dark:text-zinc-500 uppercase mt-0.5">From current period P&amp;L</span>
                  </div>
                  <span class="font-mono font-bold text-violet-700 dark:text-violet-400">{{ formatINR(Math.abs(bsModel.netProfit)) }}</span>
                </div>
                <div class="py-1.5 px-4 bg-slate-50/30 dark:bg-zinc-800/10 text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-t border-gray-100 dark:border-zinc-800/40 leading-none">
                  <span>Total Capital Pool</span>
                  <span class="font-mono text-slate-700 dark:text-zinc-300 font-black">{{ formatINR(bsModel.capital + bsModel.netProfit) }}</span>
                </div>
              </div>

              <!-- Loans & Liabilities -->
              <div v-if="bsModel.liabilities.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>Loans &amp; Liabilities</span>
                  <span>{{ bsModel.liabilities.length }} A/Cs</span>
                </div>
                <div v-for="a in bsModel.liabilities" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netCr) }}</span>
                </div>
                <div class="py-1.5 px-4 bg-rose-50/30 dark:bg-rose-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Liabilities</span>
                  <span class="font-mono text-rose-700 dark:text-rose-400 font-bold">{{ formatINR(bsModel.totalLiab) }}</span>
                </div>
              </div>

              <!-- Creditors -->
              <div v-if="bsModel.creditors.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>Sundry Creditors</span>
                  <span>{{ bsModel.creditors.length }} A/Cs</span>
                </div>
                <div v-for="a in bsModel.creditors" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netCr) }}</span>
                </div>
                <div class="py-1.5 px-4 bg-amber-50/30 dark:bg-amber-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Creditors</span>
                  <span class="font-mono text-amber-700 dark:text-amber-400 font-bold">{{ formatINR(bsModel.totalCred) }}</span>
                </div>
              </div>

              <!-- Debtor Credit Balances -->
              <div v-if="bsModel.debtorCreditBalances.length > 0" class="border-b border-gray-100 dark:border-zinc-800/40">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 leading-none">Debtor Accounts (Credit Balance)</div>
                <div v-for="a in bsModel.debtorCreditBalances" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netCr) }}</span>
                </div>
              </div>

              <!-- Cash & Bank Credit Balances -->
              <div v-if="bsModel.cashBankCreditBalances.length > 0" class="border-b border-gray-100 dark:border-zinc-800/40">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 leading-none">Cash &amp; Bank (Overdraft)</div>
                <div v-for="a in bsModel.cashBankCreditBalances" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netCr) }}</span>
                </div>
              </div>

              <!-- Asset Credit Balances -->
              <div v-if="bsModel.assetCreditBalances.length > 0" class="border-b border-gray-100 dark:border-zinc-800/40">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 leading-none">Asset Accounts (Credit Balance)</div>
                <div v-for="a in bsModel.assetCreditBalances" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netCr) }}</span>
                </div>
              </div>
            </div>

            <!-- ASSETS SIDE (A) -->
            <div class="flex flex-col">
              <div class="py-2 px-4 bg-slate-50/50 dark:bg-zinc-800/20 border-b border-gray-100 dark:border-zinc-800 text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Asset Side (As)
              </div>

              <!-- Fixed / Other Assets -->
              <div v-if="bsModel.otherAssets.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>Fixed &amp; Other Assets</span>
                  <span>{{ bsModel.otherAssets.length }} A/Cs</span>
                </div>
                <div v-for="a in bsModel.otherAssets" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netDr) }}</span>
                </div>
                <div class="py-1.5 px-4 bg-sky-50/30 dark:bg-sky-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Fixed Assets</span>
                  <span class="font-mono text-sky-700 dark:text-sky-400 font-bold">{{ formatINR(bsModel.totalOtherA) }}</span>
                </div>
              </div>

              <!-- Stock & Inventory -->
              <div v-if="bsModel.stockAssets.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>Stock &amp; Inventory</span>
                  <span>{{ bsModel.stockAssets.length }} A/Cs</span>
                </div>
                <div v-for="a in bsModel.stockAssets" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netDr) }}</span>
                </div>
                <div class="py-1.5 px-4 bg-teal-50/30 dark:bg-teal-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Stock Pool</span>
                  <span class="font-mono text-teal-700 dark:text-teal-400 font-bold">{{ formatINR(bsModel.totalStock) }}</span>
                </div>
              </div>

              <!-- Tax Receivables -->
              <div v-if="bsModel.gstAssets.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>Tax Receivables (GST Input Credit)</span>
                  <span>{{ bsModel.gstAssets.length }} A/Cs</span>
                </div>
                <div v-for="a in bsModel.gstAssets" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netDr) }}</span>
                </div>
                <div class="py-1.5 px-4 bg-violet-50/30 dark:bg-violet-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Tax Receivables</span>
                  <span class="font-mono text-violet-700 dark:text-violet-400 font-bold">{{ formatINR(bsModel.totalGST) }}</span>
                </div>
              </div>

              <!-- Sundry Debtors -->
              <div v-if="bsModel.debtors.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>Sundry Debtors</span>
                  <span>{{ bsModel.debtors.length }} A/Cs</span>
                </div>
                <div v-for="a in bsModel.debtors" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netDr) }}</span>
                </div>
                <div class="py-1.5 px-4 bg-blue-50/30 dark:bg-blue-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Debtors</span>
                  <span class="font-mono text-blue-700 dark:text-blue-400 font-bold">{{ formatINR(bsModel.totalDebtors) }}</span>
                </div>
              </div>

              <!-- Cash & Bank -->
              <div v-if="bsModel.cashBank.length > 0">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 flex justify-between leading-none">
                  <span>Cash &amp; Bank Balances</span>
                  <span>{{ bsModel.cashBank.length }} A/Cs</span>
                </div>
                <div v-for="a in bsModel.cashBank" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netDr) }}</span>
                </div>
                <div class="py-1.5 px-4 bg-emerald-50/30 dark:bg-emerald-950/10 text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex justify-between border-b border-gray-100 dark:border-zinc-800 leading-none">
                  <span>Total Cash &amp; Bank</span>
                  <span class="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{{ formatINR(bsModel.totalCashBank) }}</span>
                </div>
              </div>

              <!-- Liability Debit Balances -->
              <div v-if="bsModel.liabilityDebitBalances.length > 0" class="border-b border-gray-100 dark:border-zinc-800/40">
                <div class="py-1.5 px-4 bg-slate-50/20 dark:bg-zinc-800/10 text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-gray-100 dark:border-zinc-800 leading-none">Liability Accounts (Debit Balance)</div>
                <div v-for="a in bsModel.liabilityDebitBalances" :key="a.head" class="py-1.5 px-4 hover:bg-slate-50/50 dark:hover:bg-zinc-805/20 flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 border-b border-gray-100 dark:border-zinc-800/40">
                  <span @click="viewLedger(a.head)" class="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold">{{ a.head }}</span>
                  <span class="font-mono font-bold">{{ formatINR(a.netDr) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Statement Footer Totals -->
          <div class="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 text-white font-black" :class="bsModel.balanced ? 'bg-slate-800' : 'bg-gradient-to-br from-rose-600 to-pink-800'">
            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">Total Capital &amp; Liabilities</span>
              <span class="text-base font-black font-mono tabular-nums leading-none">{{ formatINR(bsModel.totalLiabSide) }}</span>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">Total Assets</span>
              <span class="text-base font-black font-mono tabular-nums leading-none">{{ formatINR(bsModel.totalAssets) }}</span>
            </div>
          </div>
        </UCard>
      </div>

    </div>
  </div>
</template>

<style scoped>
@media print {
  body {
    background: white !important;
    color: black !important;
  }
  .print\:hidden {
    display: none !important;
  }
  .print\:block {
    display: block !important;
  }
  .print\:shadow-none {
    box-shadow: none !important;
  }
  .print\:border-none {
    border: none !important;
  }
  .print\:p-0 {
    padding: 0 !important;
  }
  .print-tab-content {
    display: block !important;
    page-break-after: always;
  }
}
</style>
