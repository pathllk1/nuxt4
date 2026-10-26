// js/components/accounting/SLGLAuditModalComponent.js
(function (global) {
  'use strict';

  const { ref, watch, onMounted, onUnmounted } = Vue;

  const SLGLAuditModalComponent = {
    name: 'SLGLAuditModalComponent',
    props: {
      modelValue: { type: Boolean, default: false }
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      const loading = ref(false);
      const report = ref(null);

      const fetchReport = async () => {
        loading.value = true;
        try {
          if (global.ledgerService) {
            report.value = await global.ledgerService.runSLGLReconciliation();
          }
        } catch (err) {
          console.error('Failed to run SL-GL audit:', err);
        } finally {
          loading.value = false;
        }
      };

      watch(() => props.modelValue, (newVal) => {
        if (newVal) {
          fetchReport();
        }
      });

      const handleKeydown = (e) => {
        if (e.key === 'Escape' && props.modelValue) {
          emit('update:modelValue', false);
        }
      };

      onMounted(() => window.addEventListener('keydown', handleKeydown));
      onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

      const formatINR = (val) => {
        const n = Number(val) || 0;
        return '₹ ' + new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(n);
      };

      return {
        loading,
        report,
        fetchReport,
        formatINR
      };
    },
    template: `
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
        <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-800 animate-scale-in">
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900 shrink-0">
            <div class="flex items-center gap-3">
              <div 
                class="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-xs border"
                :class="report?.overallStatus === 'HEALTHY' 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' 
                  : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'"
              >
                <span>{{ report?.overallStatus === 'HEALTHY' ? '🛡️' : '⚠️' }}</span>
              </div>
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Sub-Ledger vs General Ledger (SL-GL) Diagnostic
                </h3>
                <p class="text-xs text-slate-500 dark:text-zinc-400">
                  Real-time mathematical audit of Party Sub-Ledger & Bank balances against GL Control Accounts
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button 
                @click="fetchReport" 
                class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer transition flex items-center gap-1.5"
                title="Refresh Audit"
              >
                <span>🔄</span>
                <span>Refresh</span>
              </button>
              <button 
                @click="$emit('update:modelValue', false)" 
                class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition font-bold"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Modal Body -->
          <div class="p-6 overflow-y-auto space-y-5 flex-1">
            <div v-if="loading" class="flex flex-col items-center justify-center py-12 gap-3">
              <div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Auditing ledger control accounts...</p>
            </div>

            <template v-else-if="report">
              <!-- Overall Banner -->
              <div 
                class="p-4 rounded-xl border flex items-center justify-between"
                :class="report.overallStatus === 'HEALTHY' 
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300' 
                  : 'bg-amber-50/80 border-amber-300 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'"
              >
                <div class="flex items-center gap-3">
                  <span class="text-2xl">{{ report.overallStatus === 'HEALTHY' ? '✅' : '⚠️' }}</span>
                  <div>
                    <h4 class="text-sm font-black uppercase tracking-wider">
                      {{ report.overallStatus === 'HEALTHY' ? 'General Ledger Integrity Perfect' : 'Variance Detected in Sub-Ledgers' }}
                    </h4>
                    <p class="text-xs opacity-90 mt-0.5">
                      {{ report.overallStatus === 'HEALTHY' 
                        ? 'All customer receivables, supplier payables, and bank registers align 100% with the double-entry GL.' 
                        : 'Differences were detected between party master balances and General Ledger postings.' }}
                    </p>
                  </div>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/80 shadow-xs">
                  {{ report.overallStatus }}
                </span>
              </div>

              <!-- 3 Pillar Summary Cards -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <!-- AR Card -->
                <div class="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 shadow-xs space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Accounts Receivable (Debtors)</span>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase" :class="report.arSummary.status === 'HEALTHY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'">
                      {{ report.arSummary.status }}
                    </span>
                  </div>
                  <div class="flex justify-between items-baseline pt-1">
                    <div>
                      <p class="text-[9px] text-slate-400 uppercase font-bold">GL Total</p>
                      <p class="text-sm font-mono font-black text-slate-800 dark:text-white">{{ formatINR(report.arSummary.glTotal) }}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-[9px] text-slate-400 uppercase font-bold">Party Sub-Ledger</p>
                      <p class="text-sm font-mono font-black text-slate-800 dark:text-white">{{ formatINR(report.arSummary.slTotal) }}</p>
                    </div>
                  </div>
                  <div class="pt-1.5 border-t border-slate-100 dark:border-zinc-700/60 flex justify-between text-xs">
                    <span class="text-slate-500 font-bold">Variance:</span>
                    <span class="font-mono font-black" :class="report.arSummary.variance > 0.05 ? 'text-rose-600' : 'text-emerald-600'">
                      {{ formatINR(report.arSummary.variance) }}
                    </span>
                  </div>
                </div>

                <!-- AP Card -->
                <div class="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 shadow-xs space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Accounts Payable (Creditors)</span>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase" :class="report.apSummary.status === 'HEALTHY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'">
                      {{ report.apSummary.status }}
                    </span>
                  </div>
                  <div class="flex justify-between items-baseline pt-1">
                    <div>
                      <p class="text-[9px] text-slate-400 uppercase font-bold">GL Total</p>
                      <p class="text-sm font-mono font-black text-slate-800 dark:text-white">{{ formatINR(report.apSummary.glTotal) }}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-[9px] text-slate-400 uppercase font-bold">Party Sub-Ledger</p>
                      <p class="text-sm font-mono font-black text-slate-800 dark:text-white">{{ formatINR(report.apSummary.slTotal) }}</p>
                    </div>
                  </div>
                  <div class="pt-1.5 border-t border-slate-100 dark:border-zinc-700/60 flex justify-between text-xs">
                    <span class="text-slate-500 font-bold">Variance:</span>
                    <span class="font-mono font-black" :class="report.apSummary.variance > 0.05 ? 'text-rose-600' : 'text-emerald-600'">
                      {{ formatINR(report.apSummary.variance) }}
                    </span>
                  </div>
                </div>

                <!-- Bank Card -->
                <div class="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 shadow-xs space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Bank & Cash Liquidity</span>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase" :class="report.bankSummary.status === 'HEALTHY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'">
                      {{ report.bankSummary.status }}
                    </span>
                  </div>
                  <div class="flex justify-between items-baseline pt-1">
                    <div>
                      <p class="text-[9px] text-slate-400 uppercase font-bold">GL Total</p>
                      <p class="text-sm font-mono font-black text-slate-800 dark:text-white">{{ formatINR(report.bankSummary.glTotal) }}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-[9px] text-slate-400 uppercase font-bold">Bank Master Total</p>
                      <p class="text-sm font-mono font-black text-slate-800 dark:text-white">{{ formatINR(report.bankSummary.slTotal) }}</p>
                    </div>
                  </div>
                  <div class="pt-1.5 border-t border-slate-100 dark:border-zinc-700/60 flex justify-between text-xs">
                    <span class="text-slate-500 font-bold">Variance:</span>
                    <span class="font-mono font-black" :class="report.bankSummary.variance > 0.05 ? 'text-rose-600' : 'text-emerald-600'">
                      {{ formatINR(report.bankSummary.variance) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Untagged Vouchers Notice -->
              <div v-if="report.untaggedVoucherCount > 0" class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span>⚠️</span>
                  <span><strong>{{ report.untaggedVoucherCount }} untagged voucher legs</strong> were found (missing partyId tag). These bypass the Party Sub-Ledger.</span>
                </div>
              </div>

              <!-- Variances List -->
              <div v-if="report.variances.length > 0" class="space-y-2">
                <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">Detailed Entity Variances</h4>
                <div class="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-500">
                      <tr>
                        <th class="p-2.5">Category</th>
                        <th class="p-2.5">Entity / Account</th>
                        <th class="p-2.5 text-right">GL Balance</th>
                        <th class="p-2.5 text-right">Sub-Ledger</th>
                        <th class="p-2.5 text-right">Variance</th>
                        <th class="p-2.5 text-center">Severity</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
                      <tr v-for="(v, i) in report.variances" :key="i" class="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td class="p-2.5 font-bold uppercase text-[10px] text-slate-500">{{ v.category }}</td>
                        <td class="p-2.5 font-bold text-slate-800 dark:text-white">{{ v.entityName }}</td>
                        <td class="p-2.5 text-right font-mono font-bold">{{ formatINR(v.glBalance) }}</td>
                        <td class="p-2.5 text-right font-mono font-bold">{{ formatINR(v.slBalance) }}</td>
                        <td class="p-2.5 text-right font-mono font-bold text-rose-600">{{ formatINR(v.variance) }}</td>
                        <td class="p-2.5 text-center">
                          <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase" :class="v.status === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'">
                            {{ v.status }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-else class="text-center py-6 text-slate-400 text-xs">
                <span>🎉 No variances detected. Sub-ledgers are in 100% mathematical harmony with the General Ledger.</span>
              </div>
            </template>
          </div>

          <!-- Modal Footer -->
          <div class="px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 flex justify-end gap-2 shrink-0">
            <button 
              @click="$emit('update:modelValue', false)" 
              class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition shadow-sm"
            >
              Close Diagnostic
            </button>
          </div>
        </div>
      </div>
    `
  };

  global.SLGLAuditModalComponent = SLGLAuditModalComponent;
})(typeof window !== 'undefined' ? window : this);
