<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGst } from '../../composables/useGst';

useHead({
  title: 'GST Tax Returns Workspace - GSTR-1 & GSTR-3B',
});

const { currentGSTR1, currentGSTR3B, fetchGSTR1, fetchGSTR3B, exportGSTR1JSON, loading } = useGst();

const activeTab = ref('GSTR1');
const startDate = ref<string>(`${new Date().getFullYear()}-01-01`);
const endDate = ref<string>(new Date().toISOString().split('T')[0] || '');

const loadGstReports = async () => {
  await Promise.all([
    fetchGSTR1({ startDate: startDate.value, endDate: endDate.value }),
    fetchGSTR3B({ startDate: startDate.value, endDate: endDate.value }),
  ]);
};

onMounted(() => {
  loadGstReports();
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      <div>
        <span class="px-3 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full text-xs font-bold border border-amber-500/30">
          GST Regulation Compliant Engine
        </span>
        <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white mt-1">GST Tax Returns Workspace</h1>
      </div>

      <div class="flex items-center gap-2 text-xs">
        <input type="date" v-model="startDate" @change="loadGstReports" class="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border rounded-xl font-bold" />
        <span class="text-slate-400 font-bold">to</span>
        <input type="date" v-model="endDate" @change="loadGstReports" class="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border rounded-xl font-bold" />
        <button v-if="activeTab === 'GSTR1'" @click="exportGSTR1JSON({ startDate: startDate, endDate: endDate })" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors shadow-sm">
          Export GSTR-1 JSON
        </button>
      </div>
    </header>

    <div class="flex gap-2 border-b border-slate-200 dark:border-zinc-800 text-xs font-bold">
      <button @click="activeTab = 'GSTR1'" class="py-3 px-6 border-b-2 transition-colors" :class="activeTab === 'GSTR1' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500'">
        GSTR-1 Outward Supplies
      </button>
      <button @click="activeTab = 'GSTR3B'" class="py-3 px-6 border-b-2 transition-colors" :class="activeTab === 'GSTR3B' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-500'">
        GSTR-3B Summary Return
      </button>
    </div>

    <!-- GSTR-1 View -->
    <div v-if="activeTab === 'GSTR1' && currentGSTR1" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <p class="text-[10px] font-black text-slate-400 uppercase">B2B Registered Invoices</p>
          <h3 class="text-xl font-mono font-bold text-slate-900 dark:text-white mt-1">{{ currentGSTR1.totals?.b2bCount || 0 }} Invoices</h3>
          <p class="text-xs font-mono text-emerald-600 mt-1">Taxable: ₹{{ (currentGSTR1.totals?.b2bTaxable || 0).toLocaleString('en-IN') }}</p>
        </div>
        <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <p class="text-[10px] font-black text-slate-400 uppercase">B2C Unregistered Supplies</p>
          <h3 class="text-xl font-mono font-bold text-slate-900 dark:text-white mt-1">₹{{ (currentGSTR1.totals?.b2cTaxable || 0).toLocaleString('en-IN') }}</h3>
          <p class="text-xs font-mono text-amber-500 mt-1">Tax: ₹{{ (currentGSTR1.totals?.b2cTax || 0).toLocaleString('en-IN') }}</p>
        </div>
        <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <p class="text-[10px] font-black text-slate-400 uppercase">Credit / Debit Notes</p>
          <h3 class="text-xl font-mono font-bold text-slate-900 dark:text-white mt-1">{{ currentGSTR1.totals?.cdnCount || 0 }} Notes</h3>
          <p class="text-xs font-mono text-indigo-600 mt-1">Tax: ₹{{ (currentGSTR1.totals?.cdnTax || 0).toLocaleString('en-IN') }}</p>
        </div>
      </div>
    </div>

    <!-- GSTR-3B View -->
    <div v-if="activeTab === 'GSTR3B' && currentGSTR3B" class="space-y-6">
      <div class="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h3 class="font-bold text-sm text-slate-900 dark:text-white">Table 3.1 Outward Taxable Supplies Summary</h3>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
          <div class="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl">
            <span class="text-[10px] text-slate-400 uppercase block font-sans">Outward Taxable Value</span>
            <span class="font-bold text-sm text-slate-900 dark:text-white">₹{{ (currentGSTR3B.table31?.a?.taxable_value || 0).toLocaleString('en-IN') }}</span>
          </div>
          <div class="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl">
            <span class="text-[10px] text-slate-400 uppercase block font-sans">Integrated Tax (IGST)</span>
            <span class="font-bold text-sm text-emerald-600">₹{{ (currentGSTR3B.table31?.a?.igst || 0).toLocaleString('en-IN') }}</span>
          </div>
          <div class="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl">
            <span class="text-[10px] text-slate-400 uppercase block font-sans">Central Tax (CGST)</span>
            <span class="font-bold text-sm text-emerald-600">₹{{ (currentGSTR3B.table31?.a?.cgst || 0).toLocaleString('en-IN') }}</span>
          </div>
          <div class="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl">
            <span class="text-[10px] text-slate-400 uppercase block font-sans">State Tax (SGST)</span>
            <span class="font-bold text-sm text-emerald-600">₹{{ (currentGSTR3B.table31?.a?.sgst || 0).toLocaleString('en-IN') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
