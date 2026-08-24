<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { Chart, registerables } from 'chart.js';
import { useWorkTracker } from '~/composables/useWorkTracker';
import { WorkTrackerExcelExporter } from '~/utils/work-tracker-excel';

Chart.register(...registerables);

const state = useWorkTracker();

const monthlyChartRef = ref<HTMLCanvasElement | null>(null);
const trendChartRef = ref<HTMLCanvasElement | null>(null);
const outstandingChartRef = ref<HTMLCanvasElement | null>(null);

let monthlyChart: Chart | null = null;
let trendChart: Chart | null = null;
let outstandingChart: Chart | null = null;

const monthlyBreakdown = computed(() => {
  const map: { [month: string]: { income: number; expense: number } } = {};

  for (const p of state.payments.value) {
    const m = (p.date || '').substring(0, 7) || 'Unknown';
    if (!map[m]) map[m] = { income: 0, expense: 0 };
    map[m].income += Number(p.amount || 0);
  }

  for (const r of state.receipts.value) {
    const m = (r.date || '').substring(0, 7) || 'Unknown';
    if (!map[m]) map[m] = { income: 0, expense: 0 };
    map[m].income += Number(r.amount || 0);
  }

  for (const e of state.expenses.value) {
    const m = (e.date || '').substring(0, 7) || 'Unknown';
    if (!map[m]) map[m] = { income: 0, expense: 0 };
    map[m].expense += Number(e.amount || 0);
  }

  const months = Object.keys(map).sort();
  if (months.length === 0) {
    const curr = new Date().toISOString().substring(0, 7);
    months.push(curr);
    map[curr] = { income: 0, expense: 0 };
  }

  return months.map(m => {
    const item = map[m] || { income: 0, expense: 0 };
    const inc = item.income;
    const exp = item.expense;
    const net = inc - exp;
    const margin = inc > 0 ? Math.round((net / inc) * 100) : 0;
    return { month: m, income: inc, expense: exp, net, margin };
  });

});

const renderCharts = () => {
  if (monthlyChart) monthlyChart.destroy();
  if (trendChart) trendChart.destroy();
  if (outstandingChart) outstandingChart.destroy();

  const data = monthlyBreakdown.value;

  if (monthlyChartRef.value) {
    monthlyChart = new Chart(monthlyChartRef.value, {
      type: 'bar',
      data: {
        labels: data.map(d => d.month),
        datasets: [
          {
            label: 'Income (₹)',
            data: data.map(d => d.income),
            backgroundColor: '#10b981',
            borderRadius: 4
          },
          {
            label: 'Expense (₹)',
            data: data.map(d => d.expense),
            backgroundColor: '#ef4444',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 10 } } }
        }
      }
    });
  }

  if (trendChartRef.value) {
    trendChart = new Chart(trendChartRef.value, {
      type: 'line',
      data: {
        labels: data.map(d => d.month),
        datasets: [
          {
            label: 'Net Margin (₹)',
            data: data.map(d => d.net),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 10 } } }
        }
      }
    });
  }

  if (outstandingChartRef.value) {
    const clientsWithDues = state.clients.value
      .map(c => ({ name: c.name, dues: state.getClientSummary(c.id).outstanding }))
      .filter(c => c.dues > 0);

    outstandingChart = new Chart(outstandingChartRef.value, {
      type: 'bar',
      data: {
        labels: clientsWithDues.map(c => c.name),
        datasets: [
          {
            label: 'Pending Dues (₹)',
            data: clientsWithDues.map(c => c.dues),
            backgroundColor: '#f59e0b',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 10 } } }
        }
      }
    });
  }
};

onMounted(() => {
  nextTick(() => {
    renderCharts();
  });
});

watch([() => state.payments.value, () => state.expenses.value, () => state.receipts.value], () => {
  nextTick(() => {
    renderCharts();
  });
});

onUnmounted(() => {
  if (monthlyChart) monthlyChart.destroy();
  if (trendChart) trendChart.destroy();
  if (outstandingChart) outstandingChart.destroy();
});

const exportAuditExcel = () => {
  WorkTrackerExcelExporter.exportPerformanceReport(
    monthlyBreakdown.value,
    state.clients.value,
    id => state.getClientSummary(id)
  );
};
</script>

<template>
  <div class="space-y-3 font-sans text-xs">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
      <div>
        <h2 class="text-xs font-black uppercase tracking-tight text-gray-800">Financial Audit & Performance</h2>
        <p class="text-[9px] text-gray-400 font-bold">Revenue stream charts and monthly breakdown analysis</p>
      </div>
      <button
        @click="exportAuditExcel"
        class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-lg transition border-0 cursor-pointer shadow-xs"
      >
        📥 Export Audit Report (.xlsx)
      </button>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <!-- Monthly Inflow vs Outflow -->
      <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex flex-col">
        <h3 class="text-xs font-black uppercase tracking-wider text-gray-800 mb-2">Monthly Inflow vs Outflow</h3>
        <div class="h-56 relative w-full">
          <canvas ref="monthlyChartRef"></canvas>
        </div>
      </div>

      <!-- Profit Trajectory -->
      <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex flex-col">
        <h3 class="text-xs font-black uppercase tracking-wider text-gray-800 mb-2">Net Profit Trajectory</h3>
        <div class="h-56 relative w-full">
          <canvas ref="trendChartRef"></canvas>
        </div>
      </div>

      <!-- Outstanding Dues Per Client -->
      <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex flex-col lg:col-span-2">
        <h3 class="text-xs font-black uppercase tracking-wider text-gray-800 mb-2">Outstanding Dues by Client (₹)</h3>
        <div class="h-56 relative w-full">
          <canvas ref="outstandingChartRef"></canvas>
        </div>
      </div>
    </div>

    <!-- Monthly Summary Table -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
      <div class="p-2.5 border-b border-gray-100 bg-gray-50">
        <h3 class="text-xs font-black uppercase tracking-wider text-gray-800">Historical Monthly Performance</h3>
      </div>
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-gray-50 text-[9px] font-black uppercase text-gray-500">
          <tr>
            <th class="p-2.5">Month</th>
            <th class="p-2.5 text-right">Income Inflows ₹</th>
            <th class="p-2.5 text-right">Expense Outflows ₹</th>
            <th class="p-2.5 text-right">Net Margin ₹</th>
            <th class="p-2.5 text-right">Margin %</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 font-bold font-mono">
          <tr v-for="m in monthlyBreakdown" :key="m.month" class="hover:bg-gray-50/80 transition">
            <td class="p-2.5 text-gray-800 font-sans">{{ m.month }}</td>
            <td class="p-2.5 text-right text-emerald-600">₹{{ m.income.toLocaleString('en-IN') }}</td>
            <td class="p-2.5 text-right text-rose-600">₹{{ m.expense.toLocaleString('en-IN') }}</td>
            <td class="p-2.5 text-right" :class="m.net >= 0 ? 'text-blue-600' : 'text-rose-600'">
              ₹{{ m.net.toLocaleString('en-IN') }}
            </td>
            <td class="p-2.5 text-right text-gray-700">{{ m.margin }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
