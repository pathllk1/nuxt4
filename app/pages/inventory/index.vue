<template>
  <div class="relative min-h-[calc(100vh-6rem)] overflow-hidden rounded-[28px] border border-slate-200/70 dark:border-zinc-800 bg-[linear-gradient(160deg,_#f0f6ff_0%,_#f8faff_40%,_#eef4f9_100%)] dark:bg-[linear-gradient(160deg,_#09090b_0%,_#141416_40%,_#09090b_100%)] p-4 md:p-5 space-y-5">
    
    <!-- Background blur overlays -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute -left-32 -top-10 h-96 w-96 rounded-full bg-blue-400/10 dark:bg-blue-500/5 blur-3xl"></div>
      <div class="absolute right-0 top-0 h-80 w-80 rounded-full bg-emerald-400/10 dark:bg-emerald-500/5 blur-3xl"></div>
      <div class="absolute bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-300/10 dark:bg-violet-500/5 blur-3xl"></div>
    </div>

    <!-- Header Section -->
    <header class="relative overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 shadow-md backdrop-blur-sm">
      <div class="h-[3px] bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500"></div>
      <div class="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-sky-200 dark:border-sky-850 bg-sky-50 dark:bg-sky-950/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-400">
              <span class="h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_6px_2px_rgba(14,165,233,0.5)] animate-pulse"></span>
              Live
            </span>
            <span class="rounded-full border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 px-3 py-1 text-[10px] font-semibold text-slate-500 dark:text-zinc-400">{{ dateStr }}</span>
            <span class="rounded-full border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 px-3 py-1 text-[10px] font-semibold text-slate-500 dark:text-zinc-400">Updated {{ lastRefreshedAt }}</span>
          </div>
          <div>
            <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-none">Inventory Intelligence</h1>
            <p class="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">Stock health, bill flow, movement activity, and financial exposure at a glance.</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 lg:shrink-0">
          <div class="flex items-center gap-2 rounded-[18px] border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-850/80 p-1.5">
            <UButton
              color="success"
              variant="outline"
              size="sm"
              icon="i-heroicons-plus"
              label="New Purchase"
              class="font-bold text-xs h-8"
              @click="$router.push('/accounting/purchases/new')"
            />
            <UButton
              color="error"
              variant="outline"
              size="sm"
              icon="i-heroicons-plus"
              label="New Sale"
              class="font-bold text-xs h-8"
              @click="$router.push('/accounting/sales/new')"
            />
          </div>
          <UButton
            color="primary"
            icon="i-heroicons-plus"
            size="sm"
            label="New Stock"
            class="font-bold text-xs h-8"
            @click="showCreateModal = true"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-heroicons-arrow-path"
            size="sm"
            class="h-8 w-8 flex items-center justify-center p-0"
            @click="refreshAll"
            title="Refresh Dashboard"
          />
        </div>
      </div>
    </header>

    <!-- Loader -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
      <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-primary" />
      <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Loading dashboard...</p>
    </div>

    <template v-else>
      <!-- KPI Ticker Strip -->
      <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 relative z-10">
        <article
          v-for="stat in compactStats"
          :key="stat.label"
          class="group relative overflow-hidden rounded-[20px] border border-slate-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 shadow-sm hover:shadow-md transition hover:-translate-y-px"
        >
          <div class="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r" :class="stat.tone"></div>
          <div class="p-4 pt-5">
            <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500 leading-none">{{ stat.label }}</p>
            <div class="mt-2 text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none font-mono" :class="stat.textColor">{{ stat.value }}</div>
            <div class="mt-3.5 flex items-center gap-1.5 border-t border-slate-100 dark:border-zinc-800 pt-2">
              <span class="h-1.5 w-1.5 rounded-full bg-gradient-to-br" :class="stat.tone"></span>
              <span class="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 leading-none">{{ stat.meta }}</span>
            </div>
          </div>
        </article>
      </section>

      <!-- Main Content Grid -->
      <section class="grid gap-4 xl:grid-cols-[1.4fr_1fr] relative z-10">
        <!-- Left Column: Charts & Table -->
        <div class="space-y-4">
          <!-- Trend chart card -->
          <UCard class="w-full shadow-sm rounded-2xl border border-gray-200 dark:border-zinc-800" :ui="{ body: 'p-4' }">
            <div class="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3 mb-4">
              <div>
                <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">6-Month Trend</p>
                <h2 class="mt-0.5 text-sm font-black text-slate-900 dark:text-white uppercase">Sales vs Purchase Value</h2>
              </div>
              <div class="flex items-center gap-3">
                <span class="flex items-center gap-1.5 text-[10px] font-bold text-rose-500"><span class="h-2 w-2 rounded-full bg-rose-500"></span> Sales</span>
                <span class="flex items-center gap-1.5 text-[10px] font-bold text-cyan-500"><span class="h-2 w-2 rounded-full bg-cyan-500"></span> Purchase</span>
              </div>
            </div>
            <div class="h-[240px] relative">
              <canvas ref="trendChartRef"></canvas>
            </div>
          </UCard>

          <!-- Two small charts in a grid -->
          <div class="grid gap-4 md:grid-cols-2">
            <!-- Top Value Leaders -->
            <UCard class="w-full shadow-sm rounded-2xl border border-gray-200 dark:border-zinc-800" :ui="{ body: 'p-4' }">
              <div class="border-b border-gray-100 dark:border-zinc-800 pb-3 mb-4">
                <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Value Leaders</p>
                <h2 class="mt-0.5 text-sm font-black text-slate-900 dark:text-white uppercase">Top Stock by Value</h2>
              </div>
              <div class="h-[220px] relative">
                <canvas ref="leadersChartRef"></canvas>
              </div>
            </UCard>

            <!-- Movement mix -->
            <UCard class="w-full shadow-sm rounded-2xl border border-gray-200 dark:border-zinc-800" :ui="{ body: 'p-4' }">
              <div class="border-b border-gray-100 dark:border-zinc-800 pb-3 mb-4">
                <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">Movement Mix</p>
                <h2 class="mt-0.5 text-sm font-black text-slate-900 dark:text-white uppercase">Transaction Composition</h2>
              </div>
              <div class="h-[220px] relative">
                <canvas ref="mixChartRef"></canvas>
              </div>
            </UCard>
          </div>

          <!-- Inventory Register Table -->
          <UCard class="w-full shadow-sm rounded-2xl border border-gray-200 dark:border-zinc-800" :ui="{ body: 'p-0 overflow-hidden' }">
            <div class="p-4 py-3 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-4">
              <div>
                <h2 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">Inventory Register</h2>
                <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Real-time stock availability</p>
              </div>
              <div class="w-64">
                <UInput
                  v-model="stockSearch"
                  placeholder="Filter items..."
                  icon="i-heroicons-magnifying-glass"
                  size="sm"
                  class="w-full"
                />
              </div>
            </div>
            
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
                <thead>
                  <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-800/80">
                    <th class="py-2.5 px-4">Item Details</th>
                    <th class="py-2.5 px-4">Part No</th>
                    <th class="py-2.5 px-4 text-right">Quantity</th>
                    <th class="py-2.5 px-4 text-right">Avg Rate</th>
                    <th class="py-2.5 px-4 text-right">Total Value</th>
                    <th class="py-2.5 px-4 text-center">Health</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-zinc-800">
                  <tr v-for="stock in filteredStocks.slice(0, 10)" :key="stock.id || stock._id" class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group" @click="viewHistory(stock)">
                    <td class="py-2.5 px-4">
                      <div class="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{{ stock.item }}</div>
                      <div class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold tracking-widest mt-0.5">HSN: {{ stock.hsn }}</div>
                    </td>
                    <td class="py-2.5 px-4">
                      <div class="font-semibold text-gray-700 dark:text-zinc-300">{{ stock.pno || '—' }}</div>
                      <div v-if="stock.oem" class="text-[9px] text-zinc-550 dark:text-zinc-500 font-bold uppercase tracking-wider mt-0.5">{{ stock.oem }}</div>
                    </td>
                    <td class="py-2.5 px-4 text-right">
                      <div class="font-bold text-gray-900 dark:text-white">{{ (stock.qty || 0).toLocaleString() }} <span class="text-[9px] text-gray-450 dark:text-zinc-550 ml-0.5">{{ stock.uom }}</span></div>
                      <div v-if="stock.batches?.length > 1" class="text-[8px] text-blue-500 font-black uppercase tracking-widest mt-0.5">{{ stock.batches.length }} Batches</div>
                    </td>
                    <td class="py-2.5 px-4 text-right font-mono text-gray-605 dark:text-zinc-400">₹{{ (stock.rate || 0).toLocaleString() }}</td>
                    <td class="py-2.5 px-4 text-right font-mono font-bold text-gray-900 dark:text-white">₹{{ (stock.total || 0).toLocaleString() }}</td>
                    <td class="py-2.5 px-4 text-center">
                      <UBadge
                        :color="getStockHealthColor(stock.qty || 0)"
                        size="sm"
                        variant="subtle"
                        class="px-2 py-0.5 font-black uppercase tracking-widest text-[9px] rounded-md"
                      >
                        {{ getStockHealthLabel(stock.qty || 0) }}
                      </UBadge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div v-if="filteredStocks.length > 10" class="p-2 bg-gray-50/50 dark:bg-zinc-800/20 text-center border-t border-gray-100 dark:border-zinc-800">
               <UButton
                 color="primary"
                 variant="link"
                 size="xs"
                 class="font-black text-[10px] uppercase tracking-widest"
                 @click="$router.push('/inventory/stocks')"
               >
                 View All {{ filteredStocks.length }} Items →
               </UButton>
            </div>
          </UCard>
        </div>

        <!-- Right Column: Signals & Feeds -->
        <div class="space-y-4">
          <!-- Stock Signals Alerts Card (Dark) -->
          <div class="overflow-hidden rounded-[22px] bg-slate-900 dark:bg-zinc-950 border border-slate-800 shadow-lg">
            <div class="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Stock Signals</p>
                <h2 class="mt-0.5 text-base font-bold text-white">Priority inventory alerts</h2>
              </div>
              <div class="rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 text-right">
                <p class="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Total Valuation</p>
                <p class="mt-0.5 text-sm font-black text-white font-mono">{{ formatCurrency(totalValue) }}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 p-4">
              <!-- Low stock signal -->
              <div class="rounded-[18px] border border-amber-400/20 bg-amber-500/10 p-4">
                <div class="flex items-center gap-1.5 mb-2">
                  <span class="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_2px_rgba(245,158,11,0.5)]"></span>
                  <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Low Stock</span>
                </div>
                <div class="text-[1.8rem] font-black tracking-tight text-white leading-none font-mono">{{ lowStockCount }}</div>
                <div class="mt-2 text-[10px] font-semibold text-amber-300">1–5 units remaining</div>
              </div>
              <!-- Out of stock signal -->
              <div class="rounded-[18px] border border-rose-400/20 bg-rose-500/10 p-4">
                <div class="flex items-center gap-1.5 mb-2">
                  <span class="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_2px_rgba(244,63,94,0.5)]"></span>
                  <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Out of Stock</span>
                </div>
                <div class="text-[1.8rem] font-black tracking-tight text-white leading-none font-mono">{{ outOfStockCount }}</div>
                <div class="mt-2 text-[10px] font-semibold text-rose-300">Zero quantity</div>
              </div>
              <!-- Active bills signal -->
              <div class="rounded-[18px] border border-sky-400/20 bg-sky-500/10 p-4">
                <div class="flex items-center gap-1.5 mb-2">
                  <span class="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_2px_rgba(14,165,233,0.5)]"></span>
                  <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Active Bills</span>
                </div>
                <div class="text-[1.8rem] font-black tracking-tight text-white leading-none font-mono">{{ activeBills.length }}</div>
                <div class="mt-2 text-[10px] font-semibold text-sky-300">In register</div>
              </div>
              <!-- Movements signal -->
              <div class="rounded-[18px] border border-emerald-400/20 bg-emerald-500/10 p-4">
                <div class="flex items-center gap-1.5 mb-2">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(16,185,129,0.5)]"></span>
                  <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Movements</span>
                </div>
                <div class="text-[1.8rem] font-black tracking-tight text-white leading-none font-mono">{{ movements.length }}</div>
                <div class="mt-2 text-[10px] font-semibold text-emerald-300">Recent rows loaded</div>
              </div>
            </div>
          </div>

          <!-- Recent Invoices -->
          <UCard class="w-full shadow-sm rounded-2xl border border-gray-200 dark:border-zinc-800" :ui="{ body: 'p-4 py-3' }">
            <div class="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-3">
               <div>
                 <h2 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none font-sans">Recent Invoices</h2>
                 <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Latest billing activity</p>
               </div>
               <UButton
                 color="primary"
                 variant="link"
                 size="xs"
                 label="View All"
                 class="font-black text-[10px] uppercase tracking-widest p-0"
                 @click="$router.push('/accounting/bills')"
               />
            </div>
            <div class="space-y-1.5">
               <div
                 v-for="bill in recentBills"
                 :key="bill.id"
                 class="flex items-center gap-3 p-2 px-3 rounded-2xl border border-gray-100/60 dark:border-zinc-800/60 hover:bg-gray-50/50 dark:hover:bg-zinc-850/50 transition-all cursor-pointer"
                 @click="$router.push('/accounting/bills')"
               >
                  <div :class="bill.type === 'SALES' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'" class="w-8 h-8 rounded-lg flex items-center justify-center font-black text-[9px] shrink-0 leading-none">
                     {{ bill.type === 'SALES' ? 'SLS' : 'PUR' }}
                  </div>
                  <div class="flex-1 min-w-0">
                     <h4 class="text-xs font-bold text-gray-900 dark:text-white truncate leading-none">{{ bill.party }}</h4>
                     <p class="text-[9px] text-gray-450 dark:text-zinc-550 font-bold uppercase mt-1 leading-none font-mono">{{ bill.number }}</p>
                  </div>
                  <div class="text-right">
                     <div class="text-xs font-bold text-gray-900 dark:text-white font-mono leading-none">₹{{ bill.amount.toLocaleString() }}</div>
                     <div class="text-[9px] text-gray-450 dark:text-zinc-550 font-bold uppercase mt-1 leading-none">{{ formatDate(bill.date) }}</div>
                  </div>
               </div>
               <div v-if="recentBills.length === 0" class="py-8 text-center text-gray-400 dark:text-zinc-500 font-bold uppercase text-[10px] tracking-widest">No recent bills found</div>
            </div>
          </UCard>

          <!-- Stock Movement Feed -->
          <UCard class="w-full shadow-sm rounded-2xl border border-gray-200 dark:border-zinc-800" :ui="{ body: 'p-4 py-3' }">
             <div class="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-3">
                <div>
                  <h2 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none font-sans">Stock Movement Feed</h2>
                  <p class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-1">Trace inward and outward transactions</p>
                </div>
                <UButton
                  color="primary"
                  variant="link"
                  size="xs"
                  label="Full Ledger"
                  class="font-black text-[10px] uppercase tracking-widest p-0"
                  @click="$router.push('/inventory/movement')"
                />
             </div>
             <div class="space-y-1.5">
                <div v-for="move in recentMovements" :key="move.date + move.item + move.qty" class="flex items-center gap-3 p-2 px-3 rounded-2xl bg-gray-50/60 dark:bg-zinc-800/40 hover:bg-gray-100 dark:hover:bg-zinc-800/80 transition-all border border-gray-100/50 dark:border-zinc-800/50">
                   <div :class="move.type === 'SALE' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'" class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                      <UIcon v-if="move.type === 'SALE'" name="i-heroicons-arrow-trending-down" class="w-5 h-5" />
                      <UIcon v-else name="i-heroicons-arrow-trending-up" class="w-5 h-5" />
                   </div>
                   <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-2">
                         <h4 class="font-bold text-xs text-gray-900 dark:text-white truncate leading-none">{{ move.item }}</h4>
                         <span class="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase">{{ formatDate(move.date) }}</span>
                      </div>
                      <div class="flex items-center gap-2 mt-1">
                         <span class="text-[9px] font-bold text-gray-450 dark:text-zinc-550 uppercase tracking-wider leading-none truncate max-w-[120px]">{{ move.party }}</span>
                         <span class="text-[9px] font-black leading-none uppercase" :class="move.type === 'SALE' ? 'text-rose-500' : 'text-emerald-500'">{{ move.type }}</span>
                      </div>
                   </div>
                   <div class="text-right">
                      <div class="font-bold text-sm text-gray-900 dark:text-white font-mono leading-none">{{ move.type === 'SALE' ? '-' : '+' }}{{ move.qty.toLocaleString() }}</div>
                   </div>
                </div>
                <div v-if="recentMovements.length === 0" class="py-8 text-center text-gray-400 dark:text-zinc-500 font-bold uppercase text-[10px] tracking-widest">No recent movements recorded</div>
             </div>
          </UCard>
        </div>
      </section>

      <!-- Quick Access Links Section -->
      <section class="overflow-hidden rounded-[22px] border border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 shadow-sm relative z-10">
        <div class="flex flex-col gap-2 border-b border-slate-100 dark:border-zinc-850 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-550">Quick Access</p>
            <h2 class="mt-0.5 text-sm font-black text-slate-900 dark:text-white uppercase leading-none">Inventory modules</h2>
          </div>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-850 px-3 py-1 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
            Reflecting live activity
          </span>
        </div>
        <div class="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="link in quickAccessLinks"
            :key="link.title"
            @click="$router.push(link.href)"
            class="group relative overflow-hidden rounded-[20px] border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-md cursor-pointer"
          >
            <!-- Gradient Header -->
            <div class="relative bg-gradient-to-br p-4 text-white" :class="link.gradient">
              <div class="relative flex items-start justify-between gap-3">
                <UIcon :name="link.icon" class="w-7 h-7 text-white transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[-4deg]" />
                <div class="rounded-full bg-white/20 p-1.5 transition group-hover:bg-white/30">
                  <UIcon name="i-heroicons-arrow-up-right" class="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div class="relative mt-4">
                <div class="text-sm font-bold leading-none">{{ link.title }}</div>
                <div class="mt-1.5 text-[10px] leading-relaxed" :class="link.accent">{{ link.subtitle }}</div>
              </div>
            </div>
            <!-- Footer -->
            <div class="flex items-center justify-between px-4 py-2.5 bg-gray-50/50 dark:bg-zinc-900/50">
              <span class="text-xs font-bold text-slate-500 dark:text-zinc-450 group-hover:text-slate-800 dark:group-hover:text-white transition">Open module</span>
              <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </section>
    </template>

    <StockHistoryModal v-model="showHistoryModal" :stock="selectedStock" />
    <CreateStockModal v-model="showCreateModal" @saved="fetchStocks" />
    <StockAdjustmentModal v-model="showAdjustmentModal" @saved="refreshAll" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useInventory } from '@/composables/useInventory';
import { useBilling } from '@/composables/useBilling';
import StockHistoryModal from '@/components/inventory/StockHistoryModal.vue';
import CreateStockModal from '@/components/inventory/CreateStockModal.vue';
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal.vue';
import Chart from 'chart.js/auto';

const router = useRouter();

const { stocks, movements, fetchStocks, fetchMovements, loading: inventoryLoading } = useInventory();
const { bills, fetchBills, fetchParties, parties, loading: billingLoading } = useBilling();

const loading = computed(() => inventoryLoading.value || billingLoading.value);

const stockSearch = ref('');
const showAdjustmentModal = ref(false);
const showCreateModal = ref(false);
const showHistoryModal = ref(false);
const selectedStock = ref<any>(null);

const dateStr = ref('');
const lastRefreshedAt = ref('');

// Chart References
const trendChartRef = ref<HTMLCanvasElement | null>(null);
const leadersChartRef = ref<HTMLCanvasElement | null>(null);
const mixChartRef = ref<HTMLCanvasElement | null>(null);

let trendChart: Chart | null = null;
let leadersChart: Chart | null = null;
let mixChart: Chart | null = null;

// Helpers & Calculators
const getBillCategory = (bill: any) => {
  const rawType = String(bill?.btype || '').toUpperCase();
  const billNo = String(bill?.bno || '').toUpperCase();
  if (rawType === 'PURCHASE' || billNo.startsWith('PUR/')) return 'PURCHASE';
  return 'SALES';
};

const getBillPartyName = (bill: any) => {
  return getBillCategory(bill) === 'PURCHASE'
    ? (bill?.supply || bill?.partyName || 'Supplier')
    : (bill?.supply || bill?.partyName || 'Customer');
};

const parseBillDate = (value: any) => {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const toNumber = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const sumBillsForMonth = (billsList: any[], month: number, year: number) => {
  return billsList.reduce((sum, bill) => {
    const dt = parseBillDate(bill.bdate || bill.createdAt);
    if (!dt) return sum;
    return dt.getMonth() === month && dt.getFullYear() === year
      ? sum + toNumber(bill.netTotal || bill.ntot)
      : sum;
  }, 0);
};

const getLastMonths = (count: number) => {
  const months = [];
  const now = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - index, 1);
    months.push({
      key: `${dt.getFullYear()}-${dt.getMonth() + 1}`,
      label: dt.toLocaleDateString('en-IN', { month: 'short' }),
      month: dt.getMonth(),
      year: dt.getFullYear(),
    });
  }
  return months;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: value >= 100000 ? 0 : 2,
  }).format(value);
};

const formatCompactNumber = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};

const formatAxisCurrency = (value: number) => {
  const amount = toNumber(value);
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount.toFixed(0)}`;
};

const truncateLabel = (value: string, max: number) => {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

// Data Model Computations
const activeBills = computed(() => bills.value.filter(bill => (bill.status || 'ACTIVE') !== 'CANCELLED'));
const salesBills = computed(() => activeBills.value.filter(bill => getBillCategory(bill) === 'SALES'));
const purchaseBills = computed(() => activeBills.value.filter(bill => getBillCategory(bill) === 'PURCHASE'));

const totalSkus = computed(() => stocks.value.length);
const totalUnits = computed(() => stocks.value.reduce((sum, stock) => sum + toNumber(stock.qty), 0));
const totalValue = computed(() => stocks.value.reduce((sum, stock) => sum + toNumber(stock.total), 0));
const lowStockCount = computed(() => stocks.value.filter(stock => toNumber(stock.qty) > 0 && toNumber(stock.qty) <= 5).length);
const outOfStockCount = computed(() => stocks.value.filter(stock => toNumber(stock.qty) <= 0).length);

const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

const salesThisMonth = computed(() => sumBillsForMonth(salesBills.value, currentMonth, currentYear));
const purchasesThisMonth = computed(() => sumBillsForMonth(purchaseBills.value, currentMonth, currentYear));

const trendMonths = computed(() => {
  return getLastMonths(6).map(({ key, label, month, year }) => ({
    key,
    label,
    sales: sumBillsForMonth(salesBills.value, month, year),
    purchases: sumBillsForMonth(purchaseBills.value, month, year),
  }));
});

const movementCounts = computed(() => {
  return movements.value.reduce((acc: Record<string, number>, row: any) => {
    const type = (row.type || 'OTHER').toUpperCase();
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
});

const stockValueLeaders = computed(() => {
  return [...stocks.value]
    .sort((a, b) => toNumber(b.total) - toNumber(a.total))
    .slice(0, 6)
    .map((stock) => ({
      name: stock.item || 'Unnamed Item',
      value: toNumber(stock.total),
      qty: toNumber(stock.qty),
    }));
});

const recentBills = computed(() => {
  return [...activeBills.value]
    .sort((a, b) => new Date(b.bdate || b.createdAt || 0).getTime() - new Date(a.bdate || a.createdAt || 0).getTime())
    .slice(0, 7)
    .map((bill) => ({
      id: bill._id,
      type: getBillCategory(bill),
      number: bill.bno || '—',
      party: getBillPartyName(bill),
      amount: toNumber(bill.netTotal || bill.ntot),
      date: bill.bdate || bill.createdAt || '',
    }));
});

const recentMovements = computed(() => {
  return [...movements.value]
    .sort((a, b) => new Date(b.bdate || b.createdAt || 0).getTime() - new Date(a.bdate || a.createdAt || 0).getTime())
    .slice(0, 7)
    .map((movement) => ({
      type: (movement.type || 'OTHER').toUpperCase(),
      item: movement.item || 'Unnamed Item',
      party: movement.supply || 'Internal',
      qty: toNumber(movement.qty),
      date: movement.bdate || movement.createdAt || '',
    }));
});

const compactStats = computed(() => [
  {
    label: 'SKUs',
    value: formatCompactNumber(totalSkus.value),
    tone: 'from-sky-500 to-blue-600',
    textColor: 'text-sky-600 dark:text-sky-400',
    meta: `${formatCompactNumber(lowStockCount.value)} low stock`,
  },
  {
    label: 'Units On Hand',
    value: formatCompactNumber(totalUnits.value),
    tone: 'from-emerald-500 to-green-600',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    meta: `${formatCompactNumber(outOfStockCount.value)} out of stock`,
  },
  {
    label: 'Stock Value',
    value: formatCurrency(totalValue.value),
    tone: 'from-violet-500 to-purple-600',
    textColor: 'text-violet-600 dark:text-violet-400',
    meta: `${formatCompactNumber(stockValueLeaders.value.length)} high-value leaders`,
  },
  {
    label: 'Parties',
    value: formatCompactNumber(parties.value.length),
    tone: 'from-amber-500 to-orange-600',
    textColor: 'text-amber-600 dark:text-amber-400',
    meta: `${formatCompactNumber(activeBills.value.length)} active bills`,
  },
  {
    label: 'Sales This Month',
    value: formatCurrency(salesThisMonth.value),
    tone: 'from-rose-500 to-pink-600',
    textColor: 'text-rose-600 dark:text-rose-450',
    meta: `${formatCompactNumber(salesBills.value.length)} sales bills`,
  },
  {
    label: 'Purchase This Month',
    value: formatCurrency(purchasesThisMonth.value),
    tone: 'from-cyan-500 to-teal-600',
    textColor: 'text-cyan-600 dark:text-cyan-455',
    meta: `${formatCompactNumber(purchaseBills.value.length)} purchase bills`,
  },
]);

const quickAccessLinks = [
  { href: '/inventory/stocks', title: 'Stock Management', subtitle: 'Items, batches, quantity, pricing', gradient: 'from-blue-600 via-cyan-500 to-sky-400', accent: 'text-blue-100', icon: 'i-heroicons-cube' },
  { href: '/accounting/parties', title: 'Suppliers', subtitle: 'Vendor visibility and balance context', gradient: 'from-violet-600 via-purple-500 to-fuchsia-400', accent: 'text-violet-100', icon: 'i-heroicons-user-group' },
  { href: '/accounting/gst-returns', title: 'GST Returns', subtitle: 'GSTR-1 & GSTR-3B analysis', gradient: 'from-indigo-600 via-blue-500 to-cyan-400', accent: 'text-indigo-100', icon: 'i-heroicons-document-duplicate' },
  { href: '/inventory/reports', title: 'Returns / Notes', subtitle: 'Issue Credit & Debit Notes', gradient: 'from-amber-600 via-orange-500 to-amber-400', accent: 'text-amber-100', icon: 'i-heroicons-arrow-uturn-left' },
  { href: '/inventory/reports', title: 'Reports', subtitle: 'Bills, totals, cancellations, exports', gradient: 'from-amber-500 via-orange-500 to-rose-400', accent: 'text-amber-100', icon: 'i-heroicons-document-chart-bar' },
  { href: '/accounting/bills', title: 'Sales', subtitle: 'Issue invoices and reduce stock', gradient: 'from-pink-600 via-rose-500 to-orange-400', accent: 'text-pink-100', icon: 'i-heroicons-credit-card' },
  { href: '/accounting/bills', title: 'Purchases', subtitle: 'Receive stock and supplier bills', gradient: 'from-teal-600 via-cyan-500 to-sky-400', accent: 'text-teal-100', icon: 'i-heroicons-shopping-cart' },
  { href: '/inventory/movement', title: 'Stock Movement', subtitle: 'Trace inward and outward transactions', gradient: 'from-green-600 via-emerald-500 to-teal-400', accent: 'text-green-100', icon: 'i-heroicons-arrow-path' },
];

const filteredStocks = computed(() => {
  if (!stockSearch.value) return stocks.value;
  const query = stockSearch.value.toLowerCase();
  return stocks.value.filter(s =>
    s.item.toLowerCase().includes(query) ||
    s.hsn?.toLowerCase().includes(query)
  );
});

// Chart Rendering Lifecycle
const renderCharts = async () => {
  await nextTick();

  // 1. Trend Chart
  if (trendChartRef.value) {
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(trendChartRef.value, {
      type: 'line',
      data: {
        labels: trendMonths.value.map(row => row.label),
        datasets: [
          {
            label: 'Sales',
            data: trendMonths.value.map(row => row.sales),
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.08)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 4,
          },
          {
            label: 'Purchases',
            data: trendMonths.value.map(row => row.purchases),
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.08)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            padding: 10,
          },
        },
        scales: {
          y: {
            ticks: {
              callback: (val) => formatAxisCurrency(Number(val)),
              font: { family: 'monospace', size: 9 },
              color: 'rgba(156, 163, 175, 0.9)',
            },
            grid: { color: 'rgba(148,163,184,0.12)' },
          },
          x: {
            ticks: {
              font: { size: 9, weight: 'bold' },
              color: 'rgba(156, 163, 175, 0.9)',
            },
            grid: { display: false },
          },
        },
      },
    });
  }

  // 2. Value Leaders Chart
  if (leadersChartRef.value) {
    if (leadersChart) leadersChart.destroy();
    const leaders = stockValueLeaders.value.length
      ? stockValueLeaders.value
      : [{ name: 'No stock value yet', value: 0 }];

    leadersChart = new Chart(leadersChartRef.value, {
      type: 'bar',
      data: {
        labels: leaders.map(row => truncateLabel(row.name, 12)),
        datasets: [{
          label: 'Stock Value',
          data: leaders.map(row => row.value),
          borderRadius: 8,
          backgroundColor: ['#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'],
          borderSkipped: false,
        }],
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
          },
        },
        scales: {
          x: {
            ticks: {
              callback: (val) => formatAxisCurrency(Number(val)),
              font: { family: 'monospace', size: 9 },
              color: 'rgba(156, 163, 175, 0.9)',
            },
            grid: { color: 'rgba(148,163,184,0.12)' },
          },
          y: {
            ticks: {
              font: { size: 9, weight: 'bold' },
              color: 'rgba(156, 163, 175, 0.9)',
            },
            grid: { display: false },
          },
        },
      },
    });
  }

  // 3. Movement Mix Chart
  if (mixChartRef.value) {
    if (mixChart) mixChart.destroy();
    const movementEntries = Object.entries(movementCounts.value);
    mixChart = new Chart(mixChartRef.value, {
      type: 'doughnut',
      data: {
        labels: movementEntries.length ? movementEntries.map(([label]) => label) : ['No Activity'],
        datasets: [{
          data: movementEntries.length ? movementEntries.map(([, val]) => val) : [1],
          backgroundColor: movementEntries.length
            ? ['#10b981', '#f43f5e', '#0ea5e9', '#f59e0b', '#8b5cf6', '#14b8a6']
            : ['#cbd5e1'],
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 8,
              boxHeight: 8,
              padding: 10,
              color: 'rgba(156, 163, 175, 0.9)',
              font: { size: 9, weight: 'bold' },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            padding: 10,
          },
        },
      },
    });
  }
};

const refreshAll = async () => {
  updateRefreshTime();
  await Promise.all([
    fetchStocks(),
    fetchMovements({ limit: 500 }),
    fetchBills({ limit: 1000 }),
    fetchParties()
  ]);
  renderCharts();
};

onMounted(() => {
  refreshAll();
});

onBeforeUnmount(() => {
  if (trendChart) trendChart.destroy();
  if (leadersChart) leadersChart.destroy();
  if (mixChart) mixChart.destroy();
});

function getStockHealthColor(qty: number) {
  if (qty <= 0) return 'error';
  if (qty <= 5) return 'warning';
  if (qty <= 20) return 'primary';
  return 'success';
}

function getStockHealthLabel(qty: number) {
  if (qty <= 0) return 'Out of Stock';
  if (qty <= 5) return 'Low Stock';
  if (qty <= 20) return 'Watchlist';
  return 'Healthy';
}

function formatDate(date: string) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function viewHistory(stock: any) {
  selectedStock.value = stock;
  showHistoryModal.value = true;
}

const updateRefreshTime = () => {
  const now = new Date();
  dateStr.value = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  lastRefreshedAt.value = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};
</script>
