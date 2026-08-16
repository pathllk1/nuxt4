<template>
  <div class="p-4 py-3 w-full mx-auto space-y-3">
    <!-- Header Section -->
    <div class="flex justify-between items-center mb-2">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <UIcon name="i-heroicons-credit-card" class="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Ledger & Financials</h1>
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Monitoring {{ trialBalance.length }} account heads</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="hidden lg:flex items-center gap-3 mr-2">
          <div class="text-right">
            <p class="text-[8px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Total Debit</p>
            <p class="text-xs font-black text-emerald-600 font-mono leading-none mt-0.5">₹{{ totalDebit.toLocaleString() }}</p>
          </div>
          <div class="w-px h-6 bg-gray-200 dark:bg-zinc-800"></div>
          <div class="text-right">
            <p class="text-[8px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Total Credit</p>
            <p class="text-xs font-black text-rose-600 font-mono leading-none mt-0.5">₹{{ totalCredit.toLocaleString() }}</p>
          </div>
        </div>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-arrow-path"
          size="sm"
          class="h-8 w-8 flex items-center justify-center p-0"
          @click="refreshData"
          title="Refresh Data"
        />
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          label="Account Heads"
          class="font-semibold text-xs h-8"
          @click="$router.push('/accounting/coa')"
        />
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          size="sm"
          label="New Voucher"
          class="font-semibold text-xs h-8"
          @click="showVoucherModal = true"
        />
      </div>
    </div>

    <!-- Loader -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
      <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-primary" />
      <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Loading ledger summaries...</p>
    </div>

    <template v-else>
      <!-- KPI Ticker Strip -->
      <div class="flex divide-x divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden overflow-x-auto">
         <div v-for="stat in compactStats" :key="stat.label" class="flex-1 min-w-[180px] p-3 py-2.5 hover:bg-gray-50/50 dark:hover:bg-zinc-850/50 transition-all border-l-4" :class="stat.borderColor">
            <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">{{ stat.label }}</p>
            <div class="text-lg font-black text-gray-900 dark:text-white tracking-tight font-mono leading-none" :class="stat.textColor">{{ stat.value }}</div>
            <p class="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mt-1 leading-none">{{ stat.meta }}</p>
         </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
         <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-4' }">
            <div class="flex items-center justify-between mb-4">
               <div>
                  <h2 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Account Type Mix</h2>
                  <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Debit & Credit by Type</p>
               </div>
               <div class="flex items-center gap-3">
                 <span class="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> DR</span>
                 <span class="flex items-center gap-1.5 text-[9px] font-black text-rose-600 dark:text-rose-400"><span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span> CR</span>
               </div>
            </div>
            <div class="h-[240px] relative">
               <canvas id="typeChart"></canvas>
            </div>
         </UCard>

         <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-4' }">
            <div class="mb-4">
               <h2 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Top Account Exposure</h2>
               <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Balance leaders</p>
            </div>
            <div class="h-[240px] relative">
               <canvas id="exposureChart"></canvas>
            </div>
         </UCard>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
         <!-- Voucher Pulse & Signals -->
         <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-4 space-y-4' }">
            <div class="flex items-center justify-between">
               <div>
                  <h2 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Voucher Pulse</h2>
                  <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Transaction signals</p>
               </div>
               <div class="px-2.5 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded-lg text-right leading-none">
                  <p class="text-[8px] font-black text-gray-400 dark:text-zinc-500 uppercase leading-none">Net</p>
                  <p class="text-xs font-black font-mono mt-0.5 leading-tight text-gray-950 dark:text-white">₹{{ (vouchersSummary.net_position || 0).toLocaleString() }}</p>
               </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
               <div class="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/55 dark:border-emerald-900/30">
                  <p class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 leading-none">Receipts</p>
                  <p class="text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono leading-none">₹{{ (vouchersSummary.total_receipts || 0).toLocaleString() }}</p>
                  <p class="text-[8px] font-bold text-emerald-500 mt-1 uppercase leading-none">Total In</p>
               </div>
               <div class="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/55 dark:border-rose-900/30">
                  <p class="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1 leading-none">Payments</p>
                  <p class="text-xs font-black text-rose-700 dark:text-rose-300 font-mono leading-none">₹{{ (vouchersSummary.total_payments || 0).toLocaleString() }}</p>
                  <p class="text-[8px] font-bold text-rose-500 mt-1 uppercase leading-none">Total Out</p>
               </div>
               <div class="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/55 dark:border-blue-900/30">
                  <p class="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 leading-none">Vouchers</p>
                  <p class="text-xs font-black text-blue-700 dark:text-blue-300 font-mono leading-none">{{ vouchersSummary.recent_transactions_count || 0 }}</p>
                  <p class="text-[8px] font-bold text-blue-500 mt-1 uppercase leading-none">Last 30 Days</p>
               </div>
               <div class="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/55 dark:border-amber-900/30">
                  <p class="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 leading-none">Journals</p>
                  <p class="text-xs font-black text-amber-700 dark:text-amber-300 font-mono leading-none">{{ journalSummary.recent_journal_entries_count || 0 }}</p>
                  <p class="text-[8px] font-bold text-amber-500 mt-1 uppercase leading-none">Last 30 Days</p>
               </div>
            </div>
            
            <div class="space-y-2">
               <h3 class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-1 leading-none">Quick Workflows</h3>
               <button @click="$router.push('/accounting/sales/service')" class="w-full p-2 px-3 flex items-center gap-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 transition-all border border-emerald-200/60 dark:border-emerald-800/40 group">
                  <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                     <UIcon name="i-heroicons-document-currency-rupee" class="w-4.5 h-4.5" />
                  </div>
                  <div class="text-left min-w-0">
                     <h4 class="text-xs font-bold text-gray-900 dark:text-white leading-none flex items-center gap-1.5">
                       Service Sales Invoice
                       <span class="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">New</span>
                     </h4>
                     <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">Book revenue without inventory</p>
                  </div>
               </button>
               <button @click="$router.push('/accounting/purchases/service')" class="w-full p-2 px-3 flex items-center gap-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 transition-all border border-rose-200/60 dark:border-rose-800/40 group">
                  <div class="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                     <UIcon name="i-heroicons-receipt-percent" class="w-4.5 h-4.5" />
                  </div>
                  <div class="text-left min-w-0">
                     <h4 class="text-xs font-bold text-gray-900 dark:text-white leading-none flex items-center gap-1.5">
                       Service Purchase Bill
                       <span class="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">New</span>
                     </h4>
                     <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">Book expenses & vendor bills</p>
                  </div>
               </button>
               <button @click="$router.push('/accounting/coa')" class="w-full p-2 px-3 flex items-center gap-3 rounded-xl bg-gray-50/60 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-850/60 transition-all border border-gray-100/50 dark:border-zinc-800/50 group">
                  <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                     <UIcon name="i-heroicons-clipboard-document-list" class="w-4.5 h-4.5" />
                  </div>
                  <div class="text-left min-w-0">
                     <h4 class="text-xs font-bold text-gray-900 dark:text-white leading-none">Chart of Accounts</h4>
                     <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">Manage Account Heads</p>
                  </div>
               </button>
               <button @click="$router.push('/accounting/parties')" class="w-full p-2 px-3 flex items-center gap-3 rounded-xl bg-gray-50/60 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-850/60 transition-all border border-gray-100/50 dark:border-zinc-800/50 group">
                  <div class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                     <UIcon name="i-heroicons-user-group" class="w-4.5 h-4.5" />
                  </div>
                  <div class="text-left min-w-0">
                     <h4 class="text-xs font-bold text-gray-900 dark:text-white leading-none">Parties Hub</h4>
                     <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">Customer & Supplier Masters</p>
                  </div>
               </button>
               <button @click="$router.push('/accounting/ledger-view')" class="w-full p-2 px-3 flex items-center gap-3 rounded-xl bg-gray-50/60 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-850/60 transition-all border border-gray-100/50 dark:border-zinc-800/50 group">
                  <div class="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                     <UIcon name="i-heroicons-document-chart-bar" class="w-4.5 h-4.5" />
                  </div>
                  <div class="text-left min-w-0">
                     <h4 class="text-xs font-bold text-gray-900 dark:text-white leading-none">General Ledger</h4>
                     <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">Full account reporting</p>
                  </div>
               </button>
               <button @click="$router.push('/accounting/banking')" class="w-full p-2 px-3 flex items-center gap-3 rounded-xl bg-gray-50/60 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-850/60 transition-all border border-gray-100/50 dark:border-zinc-800/50 group">
                  <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                     <UIcon name="i-heroicons-credit-card" class="w-4.5 h-4.5" />
                  </div>
                  <div class="text-left min-w-0">
                     <h4 class="text-xs font-bold text-gray-900 dark:text-white leading-none">Banking Hub</h4>
                     <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">Manage Treasury & Bank A/Cs</p>
                  </div>
               </button>
               <button @click="$router.push('/accounting/trial-balance')" class="w-full p-2 px-3 flex items-center gap-3 rounded-xl bg-gray-50/60 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-850/60 transition-all border border-gray-100/50 dark:border-zinc-800/50 group">
                  <div class="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                     <UIcon name="i-heroicons-calculator" class="w-4.5 h-4.5" />
                  </div>
                  <div class="text-left min-w-0">
                     <h4 class="text-xs font-bold text-gray-900 dark:text-white leading-none">Trial Balance</h4>
                     <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">Verify debits & credits balance</p>
                  </div>
               </button>
               <button @click="$router.push('/accounting/statements')" class="w-full p-2 px-3 flex items-center gap-3 rounded-xl bg-gray-50/60 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-850/60 transition-all border border-gray-100/50 dark:border-zinc-800/50 group">
                  <div class="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                     <UIcon name="i-heroicons-document-text" class="w-4.5 h-4.5" />
                  </div>
                  <div class="text-left min-w-0">
                     <h4 class="text-xs font-bold text-gray-900 dark:text-white leading-none">Financial Statements</h4>
                     <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase mt-0.5 leading-none">Profit & Loss and Balance Sheet</p>
                  </div>
               </button>
            </div>
         </UCard>

         <!-- Table Tabs -->
         <div class="lg:col-span-2">
            <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-0 overflow-hidden' }">
               <div class="p-4 py-3 border-b border-gray-50 dark:border-zinc-800 flex items-center justify-between gap-4">
                  <div>
                    <h2 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">{{ activeTab === 'heads' ? 'Account Head Register' : 'Account Type Summaries' }}</h2>
                    <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">{{ activeTab === 'heads' ? 'Trial balance and net exposure' : 'Net balance per category' }}</p>
                  </div>
                  <div class="flex items-center gap-3">
                     <div class="inline-flex rounded-xl bg-gray-100 dark:bg-zinc-800 p-0.5">
                        <button @click="activeTab = 'types'" :class="activeTab === 'types' ? 'bg-zinc-900 text-white dark:bg-zinc-950 shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'" class="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all leading-none">Types</button>
                        <button @click="activeTab = 'heads'" :class="activeTab === 'heads' ? 'bg-zinc-900 text-white dark:bg-zinc-950 shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'" class="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all leading-none">Heads</button>
                     </div>
                     <div class="w-36">
                        <UInput type="date" v-model="toDate" size="sm" class="w-full" @change="refreshData" />
                     </div>
                  </div>
               </div>
               
               <!-- Account Heads Table -->
               <div v-if="activeTab === 'heads'" class="overflow-x-auto">
                  <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
                     <thead>
                        <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-800/80">
                           <th class="py-2.5 px-4">Account Head</th>
                           <th class="py-2.5 px-4">Category</th>
                           <th class="py-2.5 px-4 text-right">Debit</th>
                           <th class="py-2.5 px-4 text-right">Credit</th>
                           <th class="py-2.5 px-4 text-right">Net Balance</th>
                        </tr>
                     </thead>
                     <tbody class="divide-y divide-gray-100 dark:divide-zinc-800">
                        <tr v-for="row in trialBalance" :key="row.accountHead" class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group" @click="viewLedger(row.accountHead)">
                           <td class="py-2 px-4">
                              <div class="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{{ row.accountHead }}</div>
                           </td>
                           <td class="py-2 px-4">
                              <UBadge size="sm" variant="subtle" color="neutral" class="text-[8px] px-1.5 py-0 font-bold uppercase tracking-wider rounded-md">
                                 {{ row.accountType?.replace(/_/g, ' ') || 'GENERAL' }}
                              </UBadge>
                           </td>
                           <td class="py-2 px-4 text-right font-medium text-gray-600 dark:text-zinc-400 font-mono">₹{{ row.totalDebit.toLocaleString() }}</td>
                           <td class="py-2 px-4 text-right font-medium text-gray-600 dark:text-zinc-400 font-mono">₹{{ row.totalCredit.toLocaleString() }}</td>
                           <td class="py-2 px-4 text-right">
                              <div class="flex items-center justify-end gap-1.5">
                                 <span :class="row.balanceType === 'DR' ? 'text-emerald-600' : 'text-rose-600'" class="font-bold font-mono">
                                    ₹{{ row.balance.toLocaleString() }}
                                 </span>
                                 <UBadge size="sm" variant="subtle" :color="row.balanceType === 'DR' ? 'success' : 'error'" class="text-[8px] px-1.5 py-0 font-bold rounded-md">
                                    {{ row.balanceType }}
                                 </UBadge>
                              </div>
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>

               <!-- Account Types Table -->
               <div v-else class="overflow-x-auto">
                  <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
                     <thead>
                        <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-800/80">
                           <th class="py-2.5 px-4">Account Type</th>
                           <th class="py-2.5 px-4 text-right">Accounts</th>
                           <th class="py-2.5 px-4 text-right">Total Debit</th>
                           <th class="py-2.5 px-4 text-right">Total Credit</th>
                           <th class="py-2.5 px-4 text-right">Net Balance</th>
                        </tr>
                     </thead>
                     <tbody class="divide-y divide-gray-100 dark:divide-zinc-800">
                        <tr v-for="type in accountTypeSummaries" :key="type.account_type" class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group" @click="drillDownType(type.account_type)">
                           <td class="py-2 px-4">
                              <div class="font-bold text-gray-900 dark:text-white group-hover:text-violet-600 transition-colors uppercase tracking-tight">{{ type.account_type?.replace(/_/g, ' ') }}</div>
                           </td>
                           <td class="py-2 px-4 text-right font-medium text-gray-500 dark:text-zinc-500 font-mono">{{ type.account_count }}</td>
                           <td class="py-2 px-4 text-right font-medium text-gray-600 dark:text-zinc-400 font-mono">₹{{ type.total_debit.toLocaleString() }}</td>
                           <td class="py-2 px-4 text-right font-medium text-gray-600 dark:text-zinc-400 font-mono">₹{{ type.total_credit.toLocaleString() }}</td>
                           <td class="py-2 px-4 text-right">
                              <div class="flex items-center justify-end gap-1.5">
                                 <span :class="type.total_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'" class="font-bold font-mono">
                                    ₹{{ Math.abs(type.total_balance).toLocaleString() }}
                                 </span>
                                 <UBadge size="sm" variant="subtle" :color="type.total_balance >= 0 ? 'success' : 'error'" class="text-[8px] px-1.5 py-0 font-bold rounded-md">
                                    {{ type.total_balance >= 0 ? 'DR' : 'CR' }}
                                 </UBadge>
                              </div>
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>
            </UCard>
         </div>
      </div>
    </template>

    <!-- Sub-Ledger Drill-Down Modal -->
    <DrillDownModal 
      v-model="showDrillModal" 
      :drill-type="drillType" 
      :initial-to-date="toDate" 
    />

    <VoucherModal v-model="showVoucherModal" @saved="refreshData" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAccounting } from '@/composables/useAccounting';
import VoucherModal from '@/components/accounting/VoucherModal.vue';
import DrillDownModal from '@/components/accounting/DrillDownModal.vue';
import Chart from 'chart.js/auto';

const router = useRouter();
const { 
  trialBalance, fetchTrialBalance, 
  vouchersSummary, fetchVouchersSummary, 
  journalSummary, fetchJournalSummary,
  accountTypeSummaries, fetchAccountTypeSummaries,
  loading
} = useAccounting();

const toDate = ref(new Date().toISOString().split('T')[0]);
const showVoucherModal = ref(false);
const activeTab = ref('types');

const showDrillModal = ref(false);
const drillType = ref('');
const drillAccounts = computed(() => {
  return trialBalance.value.filter(a => a.accountType === drillType.value)
    .sort((a, b) => b.balance - a.balance);
});

let typeChart: Chart | null = null;
let exposureChart: Chart | null = null;

const renderCharts = async () => {
  await nextTick();
  
  // Type Chart
  const typeCtx = document.getElementById('typeChart') as HTMLCanvasElement;
  if (typeCtx) {
    if (typeChart) typeChart.destroy();
    typeChart = new Chart(typeCtx, {
      type: 'bar',
      data: {
        labels: accountTypeSummaries.value.map(t => t.account_type?.replace(/_/g, ' ')),
        datasets: [
          {
            label: 'Debit',
            data: accountTypeSummaries.value.map(t => t.total_debit),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderRadius: 8
          },
          {
            label: 'Credit',
            data: accountTypeSummaries.value.map(t => t.total_credit),
            backgroundColor: 'rgba(244, 63, 94, 0.8)',
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.3)' }, ticks: { font: { family: 'monospace', size: 10 } } },
          x: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 9 } } }
        }
      }
    });
  }

  // Exposure Chart
  const exposureCtx = document.getElementById('exposureChart') as HTMLCanvasElement;
  if (exposureCtx) {
    if (exposureChart) exposureChart.destroy();
    const sorted = [...trialBalance.value].sort((a, b) => b.balance - a.balance).slice(0, 8);
    exposureChart = new Chart(exposureCtx, {
      type: 'bar',
      data: {
        labels: sorted.map(a => a.accountHead),
        datasets: [{
          data: sorted.map(a => a.balance),
          backgroundColor: sorted.map(a => a.balanceType === 'DR' ? 'rgba(37, 99, 235, 0.8)' : 'rgba(219, 39, 119, 0.8)'),
          borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.3)' }, ticks: { font: { family: 'monospace', size: 10 } } },
          y: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 10 } } }
        }
      }
    });
  }
};

const refreshData = async () => {
  await Promise.all([
    fetchTrialBalance({ toDate: toDate.value }),
    fetchVouchersSummary(),
    fetchJournalSummary(),
    fetchAccountTypeSummaries(toDate.value)
  ]);
  renderCharts();
};

onMounted(refreshData);

onBeforeUnmount(() => {
  if (typeChart) typeChart.destroy();
  if (exposureChart) exposureChart.destroy();
});

const totalDebit = computed(() => trialBalance.value.reduce((sum, r) => sum + r.totalDebit, 0));
const totalCredit = computed(() => trialBalance.value.reduce((sum, r) => sum + r.totalCredit, 0));

const compactStats = computed(() => [
  { 
    label: 'Ledger Accounts', 
    value: trialBalance.value.length, 
    meta: `${accountTypeSummaries.value.length} account types`, 
    borderColor: 'border-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400'
  },
  { 
    label: 'Total Debit', 
    value: `₹${totalDebit.value.toLocaleString()}`, 
    meta: 'Total ledger exposure', 
    borderColor: 'border-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400'
  },
  { 
    label: 'Total Credit', 
    value: `₹${totalCredit.value.toLocaleString()}`, 
    meta: 'Total liability pool', 
    borderColor: 'border-rose-500',
    textColor: 'text-rose-600 dark:text-rose-400'
  },
  { 
    label: 'Net Position', 
    value: `₹${Math.abs(totalDebit.value - totalCredit.value).toLocaleString()} ${totalDebit.value >= totalCredit.value ? 'DR' : 'CR'}`, 
    meta: 'Ledger-wide exposure', 
    borderColor: 'border-violet-500',
    textColor: 'text-violet-600 dark:text-violet-400'
  },
  { 
    label: 'Receipts', 
    value: `₹${(vouchersSummary.value.total_receipts || 0).toLocaleString()}`, 
    meta: `${vouchersSummary.value.recent_transactions_count || 0} recent transactions`, 
    borderColor: 'border-teal-500',
    textColor: 'text-teal-600 dark:text-teal-400'
  },
  { 
    label: 'Journal Entries', 
    value: (journalSummary.value.total_journal_entries || 0).toLocaleString(), 
    meta: `${journalSummary.value.recent_journal_entries_count || 0} in last 30 days`, 
    borderColor: 'border-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400'
  }
]);

function drillDownType(type: string) {
  drillType.value = type;
  showDrillModal.value = true;
}

function viewLedger(head: string) {
  router.push({ path: '/accounting/ledger-view', query: { head } });
}
</script>
