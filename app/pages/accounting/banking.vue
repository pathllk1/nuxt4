<template>
  <div class="p-4 py-3 max-w-[1600px] mx-auto space-y-3">
    <!-- Header Section -->
    <div class="flex flex-wrap justify-between items-end gap-3 mb-1">
      <div>
        <div class="flex items-center gap-2 mb-0.5">
          <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span class="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">Financial Treasury</span>
        </div>
        <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Banking Hub</h1>
        <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mt-1">Manage bank accounts, clean PDF/Excel bank statements, and monitor treasury balances</p>
      </div>

      <div class="flex items-center gap-2">
        <UButton 
          v-if="activeTab === 'accounts'"
          color="primary" 
          variant="solid" 
          icon="i-heroicons-plus"
          label="Add Bank Account"
          size="sm"
          class="font-bold text-xs h-8 cursor-pointer"
          @click="openCreateModal"
        />
        <UButton 
          color="neutral" 
          variant="outline" 
          icon="i-heroicons-arrow-left"
          size="sm"
          class="font-bold text-xs h-8 cursor-pointer"
          @click="$router.push('/accounting')"
        />
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="bg-slate-100/80 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 self-start border border-slate-200 dark:border-zinc-800 w-fit">
      <button
        type="button"
        @click="activeTab = 'accounts'"
        :class="activeTab === 'accounts' ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs border-gray-250/50 dark:border-zinc-700' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border-transparent'"
        class="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer border-0"
      >
        🏦 Bank Accounts
      </button>
      <button
        type="button"
        @click="activeTab = 'excel'"
        :class="activeTab === 'excel' ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs border-gray-250/50 dark:border-zinc-700' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border-transparent'"
        class="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer border-0"
      >
        📊 Excel & PDF Parser Cleaner
      </button>
    </div>

    <!-- TAB 1: BANK ACCOUNTS -->
    <template v-if="activeTab === 'accounts'">
      <!-- KPI Strip -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <UCard class="border-l-4 border-l-blue-500 shadow-2xs rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
          <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Total Accounts</p>
          <div class="text-lg font-black text-slate-900 dark:text-white leading-tight">{{ accounts.length }}</div>
        </UCard>
        <UCard class="border-l-4 border-l-emerald-500 shadow-2xs rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
          <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Active Liquidity</p>
          <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight">₹{{ totalLiquidity.toLocaleString() }}</div>
        </UCard>
        <UCard class="border-l-4 border-l-violet-500 shadow-2xs rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
          <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Default Channel</p>
          <div class="text-xs font-black text-slate-900 dark:text-white truncate leading-tight mt-0.5">{{ defaultAccount?.bank_name || 'Not Set' }}</div>
        </UCard>
        <UCard class="border-l-4 border-l-amber-500 shadow-2xs rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
          <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Linked COA Heads</p>
          <div class="text-lg font-black text-slate-900 dark:text-white leading-tight">{{ accounts.length }}</div>
        </UCard>
      </div>

      <!-- Main Grid -->
      <div class="grid grid-cols-1 gap-3.5" :class="selectedHistoryAcc ? 'lg:grid-cols-3' : ''">
         <!-- Accounts List -->
         <div :class="selectedHistoryAcc ? 'lg:col-span-2' : ''" class="space-y-3">
            <!-- Loader -->
            <UCard v-if="loading" class="shadow-2xs rounded-xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-10' }">
               <div class="flex flex-col items-center justify-center gap-3">
                  <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
                  <p class="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">Loading bank accounts...</p>
               </div>
            </UCard>

            <template v-else>
               <UCard v-for="acc in accountsWithBalances" :key="acc._id" class="shadow-2xs rounded-xl border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-all group" :ui="{ body: 'p-4' }">
                  <div class="flex flex-col md:flex-row justify-between gap-4">
                     <div class="flex gap-4">
                        <div class="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20 group-hover:text-blue-500 transition-colors shrink-0">
                           <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                        </div>
                        <div>
                           <div class="flex items-center gap-2 mb-0.5">
                              <h3 class="text-base font-black text-slate-900 dark:text-white leading-snug">{{ acc.account_name }}</h3>
                              <UBadge v-if="acc.is_default" color="success" variant="subtle" size="sm" class="font-black text-[8px] tracking-wider rounded px-1.5 py-0">Primary</UBadge>
                              <UBadge :color="acc.status === 'ACTIVE' ? 'primary' : 'neutral'" variant="subtle" size="sm" class="font-black text-[8px] tracking-wider rounded px-1.5 py-0">{{ acc.status || 'ACTIVE' }}</UBadge>
                           </div>
                           <p class="text-xs font-bold text-slate-500 dark:text-zinc-400">{{ acc.bank_name }} <span class="text-slate-300 dark:text-zinc-700 mx-1.5">|</span> {{ acc.branch_name || 'N/A' }}</p>
                           <div class="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-2">
                              <div>
                                 <p class="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase">Account Number</p>
                                 <p class="text-xs font-bold text-slate-700 dark:text-zinc-300 font-mono leading-none">{{ acc.account_number }}</p>
                              </div>
                              <div>
                                 <p class="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase">IFSC Code</p>
                                 <p class="text-xs font-bold text-slate-700 dark:text-zinc-300 font-mono leading-none">{{ acc.ifsc_code }}</p>
                              </div>
                           </div>
                        </div>
                     </div>
                     <div class="flex flex-col items-start md:items-end justify-between gap-3 md:min-w-[180px]">
                        <div class="md:text-right">
                           <p class="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Current Balance</p>
                           <div class="text-lg font-black font-mono leading-none" :class="acc.balanceType === 'DR' ? 'text-emerald-600' : 'text-rose-600'">
                              ₹{{ acc.balance?.toLocaleString() || '0' }}
                              <span class="text-[9px] ml-0.5 font-bold uppercase">{{ acc.balanceType || 'DR' }}</span>
                           </div>
                        </div>
                        <div class="flex gap-1.5">
                           <UButton 
                             icon="i-heroicons-clock" 
                             color="neutral" 
                             variant="soft" 
                             size="xs" 
                             class="font-bold rounded-lg cursor-pointer"
                             title="Transaction History"
                             @click="viewHistory(acc._id)"
                           />
                           <UButton 
                             icon="i-heroicons-pencil-square" 
                             color="neutral" 
                             variant="soft" 
                             size="xs" 
                             class="font-bold rounded-lg cursor-pointer"
                             @click="openEditModal(acc)"
                           />
                           <UButton 
                             icon="i-heroicons-trash" 
                             color="error" 
                             variant="soft" 
                             size="xs" 
                             class="font-bold rounded-lg cursor-pointer"
                             @click="confirmDelete(acc)"
                           />
                        </div>
                     </div>
                  </div>
               </UCard>

               <div v-if="accounts.length === 0" class="bg-slate-50 dark:bg-zinc-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-800 py-12 text-center">
                  <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
                     <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                  </div>
                  <h3 class="text-base font-black text-slate-900 dark:text-white tracking-tight">No Bank Accounts Found</h3>
                  <p class="text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto mt-1 font-medium">Create your first bank account to enable bank-based vouchers and professional invoice printing.</p>
                  <UButton @click="openCreateModal" color="primary" class="mt-4 px-6 font-bold text-xs cursor-pointer" label="Add First Account" />
               </div>
            </template>
         </div>

         <!-- Transaction History Drawer -->
         <div v-if="selectedHistoryAcc" class="space-y-3">
            <UCard class="shadow-2xs rounded-xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-4' }">
               <div class="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-zinc-800 pb-2">
                  <h3 class="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Recent Activity</h3>
                  <UButton 
                    icon="i-heroicons-x-mark" 
                    color="neutral" 
                    variant="ghost" 
                    size="xs" 
                    class="cursor-pointer"
                    @click="selectedHistoryAcc = null" 
                  />
               </div>
               <div v-if="historyLoading" class="flex justify-center py-6">
                  <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary" />
               </div>
               <div v-else-if="history.length" class="space-y-2.5">
                  <div v-for="h in history" :key="h._id" class="flex items-start justify-between gap-3 pb-2 border-b border-slate-50 dark:border-zinc-800/40 last:border-0">
                     <div>
                        <p class="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase font-mono">{{ h.transactionDate }}</p>
                        <p class="text-xs font-bold text-slate-900 dark:text-zinc-300 line-clamp-1 leading-snug">{{ h.narration }}</p>
                     </div>
                     <p class="text-xs font-black font-mono whitespace-nowrap leading-none mt-1" :class="h.debitAmount > 0 ? 'text-emerald-600' : 'text-rose-600'">
                        {{ h.debitAmount > 0 ? '+' : '-' }} ₹{{ (h.debitAmount || h.creditAmount).toLocaleString() }}
                     </p>
                  </div>
               </div>
               <p v-else class="text-xs text-slate-400 dark:text-zinc-500 font-medium text-center py-4 italic">No recent transactions</p>
            </UCard>
         </div>
      </div>
    </template>

    <!-- TAB 2: EXCEL & PDF PARSER CLEANER -->
    <template v-else-if="activeTab === 'excel'">
      <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-2xs min-h-[500px] flex flex-col gap-4">
        <!-- Loader during parsing -->
        <div v-if="excelLoading" class="flex-grow flex flex-col items-center justify-center p-12 space-y-3">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
          <p class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">Parsing and extracting bank statement data...</p>
        </div>

        <!-- Sheet loaded state -->
        <div v-else-if="excelSheets.length > 0" class="flex-grow flex flex-col gap-3 min-h-0">
          <!-- Controls Header Bar -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3 shrink-0">
            <!-- Sheet selector tabs -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mr-1">Document Stream:</span>
              <button
                v-for="(sheet, idx) in excelSheets"
                :key="idx"
                type="button"
                @click="selectedSheetIndex = idx; excelPage = 1"
                :class="selectedSheetIndex === idx ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700' : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-100'"
                class="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border transition cursor-pointer"
              >
                📄 {{ sheet.name }}
              </button>
            </div>

            <!-- Global Action Controls -->
            <div class="flex items-center gap-2 flex-wrap">
              <UButton 
                color="warning" 
                variant="solid" 
                icon="i-heroicons-arrow-down-tray" 
                label="Export Cleaned Excel" 
                size="xs" 
                class="font-bold cursor-pointer" 
                @click="downloadCleanedExcel"
              />
              <UButton 
                color="neutral" 
                variant="ghost" 
                icon="i-heroicons-x-mark" 
                label="Close Statement" 
                size="xs" 
                class="font-bold cursor-pointer" 
                @click="resetExcel"
              />
            </div>
          </div>

          <!-- Secondary Options & Search Bar -->
          <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shrink-0">
            <div class="flex items-center gap-4 flex-wrap">
              <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  v-model="firstRowIsHeader"
                  class="w-4 h-4 text-emerald-600 rounded border-gray-300 dark:border-zinc-700"
                />
                <span class="text-[10px] uppercase font-black tracking-wider">First Row Contains Headers</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-zinc-300 border-l border-slate-200 dark:border-zinc-700 pl-4">
                <input
                  type="checkbox"
                  v-model="cleanDescriptionEnabled"
                  class="w-4 h-4 text-emerald-600 rounded border-gray-300 dark:border-zinc-700"
                />
                <span class="text-[10px] uppercase font-black tracking-wider text-emerald-700 dark:text-emerald-400">✨ Auto-Clean Bank Descriptions</span>
              </label>
            </div>

            <div class="w-full sm:w-64">
              <UInput 
                v-model="excelSearchQuery" 
                icon="i-heroicons-magnifying-glass" 
                placeholder="Search statement rows..." 
                size="xs" 
                class="w-full font-semibold"
              />
            </div>
          </div>

          <!-- Data Grid Table -->
          <div class="flex-grow overflow-auto border border-slate-100 dark:border-zinc-800 rounded-xl relative min-h-[300px]">
            <table v-if="filteredExcelRows.length > 0" class="w-full text-left border-collapse text-xs font-semibold">
              <thead>
                <tr class="bg-slate-100/80 dark:bg-zinc-800/80 text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 tracking-wider sticky top-0 backdrop-blur-xs z-10">
                  <th class="p-2.5 w-12 text-center border-b border-slate-200 dark:border-zinc-700">#</th>
                  <th
                    v-for="(header, hIdx) in parsedSheetContent?.headers || []"
                    :key="hIdx"
                    class="p-2.5 border-b border-slate-200 dark:border-zinc-700 truncate max-w-[220px]"
                    :class="{ 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30': isDescriptionColumn(hIdx) }"
                  >
                    {{ header }}
                  </th>
                  <th class="p-2.5 w-16 text-center border-b border-slate-200 dark:border-zinc-700">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-800 dark:text-zinc-200 font-mono text-[11px]">
                <tr
                  v-for="(row, rIdx) in paginatedExcelRows"
                  :key="rIdx"
                  class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition odd:bg-white even:bg-slate-50/20 dark:odd:bg-zinc-900 dark:even:bg-zinc-900/40"
                >
                  <td class="p-2.5 text-center text-slate-400 dark:text-zinc-500 font-bold text-[10px]">
                    {{ (excelPage - 1) * excelPageSize + rIdx + 1 }}
                  </td>
                  <td
                    v-for="(cell, cIdx) in row"
                    :key="cIdx"
                    class="p-2.5 truncate max-w-[240px]"
                    :class="{ 'font-bold text-emerald-800 dark:text-emerald-300 font-sans': isDescriptionColumn(cIdx) }"
                  >
                    {{ cell }}
                  </td>
                  <td class="p-2.5 text-center">
                    <UButton
                      icon="i-heroicons-plus-circle"
                      color="primary"
                      variant="ghost"
                      size="xs"
                      class="font-bold cursor-pointer"
                      title="Create Voucher from Row"
                      @click="openVoucherFromExcelRow(row)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-else class="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900">
              <UIcon name="i-heroicons-magnifying-glass-circle" class="w-10 h-10 text-slate-300 dark:text-zinc-600 mb-2" />
              <span class="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">No matching records found</span>
              <p class="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Try adjusting your search query or inspect a different worksheet.</p>
            </div>
          </div>

          <!-- Pagination Bar -->
          <div v-if="totalExcelPages > 1" class="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-2 text-xs text-slate-500 dark:text-zinc-400 font-bold shrink-0">
            <span class="text-[10px] uppercase font-black tracking-wider">
              Showing {{ (excelPage - 1) * excelPageSize + 1 }} to {{ Math.min(excelPage * excelPageSize, filteredExcelRows.length) }} of {{ filteredExcelRows.length }} rows
            </span>
            <div class="flex items-center gap-1.5">
              <UButton 
                label="Previous" 
                size="xs" 
                color="neutral" 
                variant="outline" 
                :disabled="excelPage === 1" 
                class="cursor-pointer"
                @click="excelPage--" 
              />
              <span class="px-2 font-mono text-[10px] font-black">Page {{ excelPage }} of {{ totalExcelPages }}</span>
              <UButton 
                label="Next" 
                size="xs" 
                color="neutral" 
                variant="outline" 
                :disabled="excelPage >= totalExcelPages" 
                class="cursor-pointer"
                @click="excelPage++" 
              />
            </div>
          </div>
        </div>

        <!-- Dropzone Empty State -->
        <div v-else class="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/40 p-12 text-center">
          <div class="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 animate-bounce">
            <UIcon name="i-heroicons-document-arrow-up" class="w-8 h-8" />
          </div>
          <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Upload Bank Statement (PDF, Excel, CSV)</h3>
          <p class="text-xs text-slate-500 dark:text-zinc-400 max-w-md mt-1 mb-6 font-medium leading-relaxed">
            Choose any Bank Statement PDF (.pdf), Excel workbook (.xlsx, .xls) or CSV file (.csv) to parse, auto-clean transaction descriptions, paginate, and convert directly into accounting vouchers.
          </p>

          <label class="flex flex-col items-center gap-3">
            <span class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer shadow-md transition-all">
              📁 Browse PDF / Excel / CSV File
            </span>
            <input
              type="file"
              @change="onExcelFileSelected"
              accept=".pdf, .xlsx, .xls, .csv"
              class="hidden"
            />
          </label>

          <label class="flex items-center gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              v-model="firstRowIsHeader"
              class="w-4 h-4 text-emerald-600 rounded border-gray-300 dark:border-zinc-700"
            />
            <span class="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase">First row contains header labels</span>
          </label>
        </div>
      </div>
    </template>

    <!-- Banking Account Modal -->
    <BankingModal v-model="showModal" :edit-data="selectedAcc" @saved="fetchData" />

    <!-- ONE-CLICK VOUCHER CREATION MODAL OVERLAY -->
    <UModal v-model:open="showVoucherModal" :ui="{ content: 'w-full sm:max-w-4xl' }">
      <template #content>
        <div class="bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-slate-100 dark:border-zinc-800 flex flex-col max-h-[90vh] text-left">
          <!-- Header -->
          <div class="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center shrink-0">
            <div>
              <h2 class="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
                <span>{{ vform.vtype === 'PAYMENT' ? 'Payment Voucher' : vform.vtype === 'RECEIPT' ? 'Receipt Voucher' : 'Journal Entry' }}</span>
              </h2>
              <p class="text-[9px] font-bold text-blue-100 uppercase tracking-widest mt-0.5">Record new financial ledger entry from bank statement row</p>
            </div>
            <UButton 
              icon="i-heroicons-x-mark" 
              size="xs" 
              color="neutral" 
              variant="ghost" 
              class="text-white hover:bg-white/20 cursor-pointer"
              @click="closeVoucherModal"
            />
          </div>

          <!-- Body -->
          <div class="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Transaction Date</label>
                <UInput v-model="vform.vdate" type="date" size="sm" class="w-full font-bold cursor-pointer" />
              </div>
              <div>
                <label class="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Voucher Type</label>
                <USelect 
                  v-model="vform.vtype" 
                  :items="[
                    { label: 'Payment Out', value: 'PAYMENT' },
                    { label: 'Receipt In', value: 'RECEIPT' },
                    { label: 'Journal Entry', value: 'JOURNAL' }
                  ]" 
                  size="sm" 
                  class="w-full font-bold cursor-pointer"
                />
              </div>
            </div>

            <!-- Primary Account for Payment/Receipt -->
            <div v-if="vform.vtype !== 'JOURNAL'" class="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-1">
              <label class="block text-[9px] font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                {{ vform.vtype === 'PAYMENT' ? '💳 Paid From (Bank Account)' : '💰 Receipt To (Bank Account)' }}
              </label>
              <select v-model="vform.mainAccount" class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-blue-300 dark:border-blue-700 rounded-lg outline-none font-bold text-xs">
                <option value="">-- Select Bank Account --</option>
                <option v-for="acc in accounts" :key="acc._id" :value="acc._id">
                  {{ acc.account_name }} ({{ acc.bank_name }})
                </option>
              </select>
            </div>

            <!-- Line Items Table -->
            <div class="space-y-2">
              <div class="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-1">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transaction Details</span>
                <UButton label="+ Add Line" size="xs" color="primary" variant="subtle" class="font-bold cursor-pointer" @click="addLine" />
              </div>

              <div v-for="(entry, idx) in vform.entries" :key="idx" class="grid grid-cols-12 gap-2 items-center p-2.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl">
                <div class="col-span-6">
                  <UInput v-model="entry.accountHead" placeholder="Payee / Account Head Name..." size="sm" class="w-full font-bold" />
                </div>
                <div class="col-span-5">
                  <UInput v-model.number="entry.amount" type="number" step="0.01" placeholder="Amount (₹)" size="sm" class="w-full font-bold font-mono text-right" />
                </div>
                <div class="col-span-1 text-center">
                  <UButton v-if="vform.entries.length > 1" icon="i-heroicons-trash" size="xs" color="error" variant="ghost" class="cursor-pointer" @click="removeLine(idx)" />
                </div>
              </div>
            </div>

            <!-- Narration -->
            <div>
              <label class="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Narration / Remarks</label>
              <UTextarea v-model="vform.narration" :rows="2" size="sm" class="w-full font-medium" />
            </div>

            <!-- Summary Box -->
            <div class="p-3 bg-slate-100 dark:bg-zinc-800/80 rounded-xl flex justify-between items-center">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Total Amount</span>
              <span class="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">₹{{ mainAmount().toLocaleString() }}</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-5 py-3.5 bg-slate-50 dark:bg-zinc-800/80 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-2.5 shrink-0">
            <UButton label="Cancel" color="neutral" variant="outline" size="xs" class="font-bold cursor-pointer" @click="closeVoucherModal" />
            <UButton label="Save Voucher" color="success" variant="solid" size="xs" :loading="savingVoucher" class="font-bold cursor-pointer" @click="submitVoucher" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@/utils/api';
import { useToast } from '#imports';
import BankingModal from '../../components/accounting/BankingModal.vue';

interface BankAccount {
  _id: string;
  account_name: string;
  bank_name: string;
  branch_name?: string;
  account_number: string;
  ifsc_code: string;
  is_default?: boolean;
  status?: string;
  balance?: number;
  balanceType?: string;
}

interface BankingHistory {
  _id: string;
  transactionDate: string;
  narration: string;
  debitAmount: number;
  creditAmount: number;
}

interface SheetData {
  name: string;
  rows: any[][];
  maxColCount: number;
}

interface ParsedContent {
  headers: string[];
  rows: any[][];
}

interface VoucherEntry {
  accountHead: string;
  amount: number;
  type: string;
}

interface VoucherForm {
  mainAccount: string;
  vtype: string;
  vdate: string;
  narration: string;
  entries: VoucherEntry[];
}

const api = useApi();
const toast = useToast();

const activeTab = ref<'accounts' | 'excel'>('accounts');

// Excel & PDF Sheet Previewer state
const excelWorkbook = ref<any>(null);
const excelFile = ref<File | null>(null);
const excelSheets = ref<SheetData[]>([]);
const selectedSheetIndex = ref<number>(0);
const firstRowIsHeader = ref<boolean>(true);
const cleanDescriptionEnabled = ref<boolean>(true);
const excelSearchQuery = ref<string>('');
const excelPage = ref<number>(1);
const excelPageSize = 25;
const excelLoading = ref<boolean>(false);

const accounts = ref<BankAccount[]>([]);
const balances = ref<Record<string, any>>({});
const history = ref<BankingHistory[]>([]);
const historyLoading = ref<boolean>(false);
const selectedHistoryAcc = ref<string | null>(null);

const showModal = ref<boolean>(false);
const selectedAcc = ref<BankAccount | null>(null);
const loading = ref<boolean>(false);

// Voucher state
const showVoucherModal = ref<boolean>(false);
const savingVoucher = ref<boolean>(false);
const vform = ref<VoucherForm>({
  mainAccount: '',
  vtype: 'PAYMENT',
  vdate: new Date().toISOString().split('T')[0] || '',
  narration: '',
  entries: [{ accountHead: '', amount: 0, type: 'MAIN' }]
});

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await api.get('/banking');
    if (res.success) {
      accounts.value = res.data;
      await Promise.all(accounts.value.map(async (acc) => {
        const balRes = await api.get(`/banking/${acc._id}`);
        if (balRes.success) {
          balances.value[acc._id] = balRes.data;
        }
      }));
    }
  } catch (err) {
    console.error('Failed to fetch accounts', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchData);

const accountsWithBalances = computed<BankAccount[]>(() => {
  return accounts.value.map(acc => ({
    ...acc,
    ...(balances.value[acc._id] || { balance: 0, balanceType: 'DR' })
  }));
});

const totalLiquidity = computed<number>(() => {
  return accountsWithBalances.value.reduce((sum, acc) => {
    return acc.balanceType === 'DR' ? sum + (acc.balance || 0) : sum - (acc.balance || 0);
  }, 0);
});

const defaultAccount = computed<BankAccount | undefined>(() => {
  return accounts.value.find(a => a.is_default);
});

function openCreateModal() {
  selectedAcc.value = null;
  showModal.value = true;
}

function openEditModal(acc: BankAccount) {
  selectedAcc.value = acc;
  showModal.value = true;
}

async function viewHistory(id: string) {
  selectedHistoryAcc.value = id;
  historyLoading.value = true;
  try {
    const res = await api.get(`/banking/${id}/history`);
    if (res.success) {
      history.value = res.data;
    }
  } catch (err) {
    console.error('Failed to fetch history', err);
  } finally {
    historyLoading.value = false;
  }
}

async function confirmDelete(acc: BankAccount) {
  if (confirm(`Delete bank account "${acc.account_name}"? This action cannot be undone.`)) {
    try {
      const res = await api.delete(`/banking/${acc._id}`);
      if (res.success) {
        fetchData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    }
  }
}

// ==================== BANKING CLEANING ENGINE ====================

function cleanDescription(desc: string, refVal?: string): string {
  if (!desc) return '';
  let cleanedDesc = desc.trim();
  let cleanedRef = (refVal || '').trim();

  const combined = (cleanedDesc + ' ' + cleanedRef).trim();
  const isRefund = /Refund of/i.test(combined);

  // 1. INB Transfer with TRANSFER TO or TRANSFER FROM
  const transferMatch = combined.match(/TRANSFER\s+(?:TO|FROM)\s+\d+\s+(.*)/i);
  if (transferMatch && transferMatch[1]) {
    let name = transferMatch[1].trim();
    if (name.endsWith('/')) {
      name = name.slice(0, -1).trim();
    }
    name = name.replace(/^(MR|MRS|MS|DR|LT|LATE)\.?\s+/i, '');
    name = name.replace(/\s+/g, ' ');
    if (name && name !== '/' && name.length > 0) {
      return isRefund ? `Refund - ${name}` : name;
    }
  }

  // 2. IMPS
  if (/IMPS\//i.test(combined)) {
    const parts = combined.split('/');
    const p3 = parts[3];
    if (parts.length >= 4 && p3) {
      let name = p3.trim();
      const firstSegment = name.split('--')[0];
      const secondSegment = (firstSegment || '').split(',')[0];
      name = (secondSegment || '').trim();
      name = name.replace(/^(MR|MRS|MS|DR|LT|LATE)\.?\s+/i, '');
      name = name.replace(/\s+/g, ' ');
      if (name && name !== '--' && name !== '-') {
        return isRefund ? `Refund - ${name}` : name;
      }
    }
  }

  // 3. NEFT
  if (/NEFT\*/i.test(combined)) {
    const parts = combined.split('*');
    const namePart = parts[3];
    if (parts.length >= 4 && namePart) {
      const seg1 = namePart.split('--')[0];
      const seg2 = (seg1 || '').split(',')[0];
      const seg3 = (seg2 || '').split('/')[0];
      let name = (seg3 || '').trim();
      name = name.replace(/^(MR|MRS|MS|DR|LT|LATE)\.?\s+/i, '');
      name = name.replace(/\s+/g, ' ');
      if (name) {
        return isRefund ? `Refund - ${name}` : name;
      }
    }
  }

  // 4. DEBIT-ACHDr
  const achMatch = combined.match(/DEBIT-ACHDr\s+\w+\s+([^/,-]+)/i);
  if (achMatch && achMatch[1]) {
    let name = achMatch[1].trim();
    name = name.replace(/--+$/, '').trim();
    name = name.replace(/^(MR|MRS|MS|DR|LT|LATE)\.?\s+/i, '');
    name = name.replace(/\s+/g, ' ');
    return name;
  }

  // 5. ACH MANDATE CHARGES
  if (combined.startsWith('ACH MANDATE CHARGES-')) {
    let name = combined.replace(/^ACH MANDATE CHARGES-/, '');
    const seg1 = name.split('/')[0];
    const seg2 = (seg1 || '').split(',')[0];
    const seg3 = (seg2 || '').split('--')[0];
    name = (seg3 || '').trim();
    name = name.replace(/\s+CREATE\s+\d+.*$/i, '');
    name = name.replace(/\s+/g, ' ');
    return name;
  }

  // Fallback cleanup
  let cleaned = cleanedDesc;
  if (cleaned.startsWith('UPI/')) {
    const parts = cleaned.split('/');
    const p3 = parts[3];
    if (parts.length >= 4 && p3) {
      cleaned = p3;
    }
  } else if (cleaned.startsWith('BY CASH-')) {
    const parts = cleaned.split('-');
    if (parts.length >= 3) {
      cleaned = parts.slice(2).join('-');
    }
  } else if (cleaned.startsWith('Dr. for ')) {
    const slashIdx = cleaned.indexOf('/');
    if (slashIdx !== -1) {
      cleaned = cleaned.substring(slashIdx + 1);
    }
  } else if (cleaned.startsWith('Charges:')) {
    cleaned = cleaned.replace(/^Charges:/, '');
  }

  cleaned = cleaned.replace(/^IBNEFT\/[A-Z0-9]+\//i, '');
  cleaned = cleaned.replace(/^IBRTGS\/[A-Z0-9]+\//i, '');
  cleaned = cleaned.replace(/^NEFT\/[A-Z0-9]+\/[A-Z0-9]+\//i, '');
  cleaned = cleaned.replace(/^NEFT\//i, '');
  cleaned = cleaned.replace(/^RTGS\/[A-Z0-9]+\/[A-Z0-9]+\//i, '');
  cleaned = cleaned.replace(/^RTGS\//i, '');
  cleaned = cleaned.replace(/^StCon-\d+\//i, '');
  cleaned = cleaned.replace(/^StUBP-[A-Z0-9]+\//i, '');
  cleaned = cleaned.replace(/^(TO|BY)\s+TRANSFER-/i, '');
  cleaned = cleaned.replace(/_\d+$/, '');
  cleaned = cleaned.replace(/^\d+:/, '');

  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const firstCell = parts[0] || '';
    const first = firstCell.trim();
    if (first && !/^(IBNEFT|NEFT|RTGS|IBRTGS|StCon|StUBP)$/i.test(first)) {
      cleaned = first;
    }
  }

  cleaned = cleaned.replace(/,\d+$/, '');
  cleaned = cleaned.replace(/^(MR|MRS|MS|DR|LT|LATE)\.?\s+/i, '');

  return cleaned.trim();
}

function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell);
        cell = '';
      } else if (char === '\r' || char === '\n') {
        row.push(cell);
        cell = '';
        const firstCell = row[0] || '';
        if (row.length > 1 || firstCell !== '') {
          result.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        cell += char;
      }
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    result.push(row);
  }
  return result;
}

function getColLetter(index: number): string {
  let temp = index;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// ==================== PDF STATEMENT PARSER ENGINE ====================

async function parsePDFStatement(buffer: ArrayBuffer): Promise<SheetData> {
  let pdfjsLib: any = (globalThis as any).pdfjsLib;
  if (!pdfjsLib && typeof window !== 'undefined') {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    pdfjsLib = (globalThis as any).pdfjsLib;
  }

  if (!pdfjsLib) {
    throw new Error('PDF parsing library could not be loaded.');
  }

  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const numPages = pdfDoc.numPages;

  let debitHeaderX = 470;
  let creditHeaderX = 570;

  const dataRows: any[][] = [];
  dataRows.push(['Date', 'Description', 'Instr. No.', 'Debits', 'Credits', 'Balance']);

  const datePattern = /^\d{2}[-/.]\d{2}[-/.]\d{4}/;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    // Detect column headers dynamically from text items
    for (const item of items) {
      const str = (item.str || '').trim();
      if (/^Debits$/i.test(str) || /^Withdrawal/i.test(str)) {
        debitHeaderX = item.transform[4] || debitHeaderX;
      } else if (/^Credits$/i.test(str) || /^Deposit/i.test(str)) {
        creditHeaderX = item.transform[4] || creditHeaderX;
      }
    }

    // Group text items by y position (transform[5])
    const lineMap: Map<number, any[]> = new Map();
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round((item.transform[5] || 0) * 10) / 10;
      let foundY = false;
      for (const [existingY, list] of lineMap.entries()) {
        if (Math.abs(existingY - y) < 3.5) {
          list.push(item);
          foundY = true;
          break;
        }
      }
      if (!foundY) {
        lineMap.set(y, [item]);
      }
    }

    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const midpointX = (debitHeaderX + creditHeaderX) / 2;

    for (const y of sortedYs) {
      const lineItems = lineMap.get(y) || [];
      lineItems.sort((a, b) => (a.transform[4] || 0) - (b.transform[4] || 0));

      let lineStr = '';
      let prevX = -1;
      for (const item of lineItems) {
        const x = item.transform[4] || 0;
        if (prevX !== -1 && x - prevX > 15) {
          lineStr += '   ';
        } else if (prevX !== -1 && x - prevX > 4) {
          lineStr += ' ';
        }
        lineStr += item.str;
        prevX = x + (item.width || 0);
      }

      const trimmedLine = lineStr.trim();

      // Noise filter
      if (
        trimmedLine.startsWith('DATE :') ||
        trimmedLine.startsWith('Statement of Account') ||
        trimmedLine.startsWith('Total C/F:') ||
        trimmedLine.startsWith('B/F') ||
        trimmedLine.startsWith('PAGE :') ||
        trimmedLine.startsWith('A/C No') ||
        trimmedLine.startsWith('BANK OF INDIA') ||
        trimmedLine.startsWith('M/S.') ||
        trimmedLine.startsWith('Deposit Insurance') ||
        trimmedLine.startsWith('Generated at') ||
        trimmedLine.startsWith('Generated By') ||
        trimmedLine.startsWith('Generation Time') ||
        trimmedLine.startsWith('-----') ||
        trimmedLine.startsWith('Date Description') ||
        trimmedLine.includes('RELATIONSHIP BEYOND BANKING') ||
        trimmedLine.includes('Toll free no.') ||
        trimmedLine.includes('MAKE USE OF RTGS/NEFT')
      ) {
        continue;
      }

      if (datePattern.test(trimmedLine)) {
        const dateMatch = trimmedLine.match(/^(\d{2}[-/.]\d{2}[-/.]\d{4})\s+(.*)/);
        if (!dateMatch) continue;

        const dateStr = dateMatch[1] || '';
        const remainder = (dateMatch[2] || '').trim();

        // Find amount items with exact X coords
        const amountItems = lineItems.filter(i => /[\d,]+\.\d{2}/.test((i.str || '').trim()));

        let description = remainder;
        let instrNo = '';
        let debit = '';
        let credit = '';
        let balance = '';

        if (amountItems.length >= 2) {
          const balanceItem = amountItems[amountItems.length - 1];
          const txnAmountItem = amountItems[amountItems.length - 2];

          if (balanceItem) balance = (balanceItem.str || '').trim();
          const txnAmountStr = txnAmountItem ? (txnAmountItem.str || '').trim() : '';
          const amountX = txnAmountItem ? (txnAmountItem.transform[4] || 0) : 0;

          const isCredit = amountX >= midpointX || trimmedLine.includes('CREDIT');
          if (isCredit) {
            credit = txnAmountStr;
          } else {
            debit = txnAmountStr;
          }

          // Desc items are those before txnAmountItem X
          const descItems = lineItems.filter(i => (i.transform[4] || 0) < (txnAmountItem ? (txnAmountItem.transform[4] || 0) : 500));
          let fullDesc = descItems.map(i => (i.str || '').trim()).join(' ');
          fullDesc = fullDesc.replace(/^\d{2}[-/.]\d{2}[-/.]\d{4}\s*/, '').trim();

          // InstrNo check
          const descParts = fullDesc.split(/\s+/);
          const lastPart = descParts[descParts.length - 1] || '';
          if (/^\d{5,8}$/.test(lastPart)) {
            instrNo = lastPart;
            description = descParts.slice(0, descParts.length - 1).join(' ');
          } else {
            description = fullDesc;
          }
        } else if (amountItems.length === 1) {
          const balanceItem = amountItems[0];
          if (balanceItem) balance = (balanceItem.str || '').trim();
          const descItems = lineItems.filter(i => (i.transform[4] || 0) < (balanceItem ? (balanceItem.transform[4] || 0) : 600));
          description = descItems.map(i => (i.str || '').trim()).join(' ').replace(/^\d{2}[-/.]\d{2}[-/.]\d{4}\s*/, '').trim();
        }

        dataRows.push([dateStr, description, instrNo, debit, credit, balance]);
      } else if (dataRows.length > 1) {
        const lastRow = dataRows[dataRows.length - 1];
        if (lastRow && lastRow[1] !== undefined) {
          lastRow[1] += ' ' + trimmedLine;
        }
      }
    }
  }

  return {
    name: 'PDF Statement',
    rows: dataRows,
    maxColCount: 6
  };
}

const onExcelFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  if (!target || !target.files || target.files.length === 0) return;
  const file = target.files[0] as File | undefined;
  if (!file) return;

  excelFile.value = file;
  excelLoading.value = true;
  excelPage.value = 1;

  if (file.name.toLowerCase().endsWith('.pdf')) {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) return;
        const pdfData = await parsePDFStatement(buffer);
        excelSheets.value = [pdfData];
        selectedSheetIndex.value = 0;
        excelLoading.value = false;
        toast.add({ title: 'PDF Loaded', description: `Parsed ${pdfData.rows.length - 1} transaction rows from PDF statement`, color: 'success' });
      } catch (err: any) {
        toast.add({ title: 'PDF Parse Error', description: err.message, color: 'error' });
        excelLoading.value = false;
        resetExcel();
      }
    };
    reader.readAsArrayBuffer(file);
  } else if (file.name.toLowerCase().endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = (e.target?.result as string) || '';
        const rows = parseCSV(text);
        let maxColCount = 0;
        rows.forEach(r => {
          if (r.length > maxColCount) maxColCount = r.length;
        });
        const paddedRows = rows.map(r => {
          const newRow = [...r];
          while (newRow.length < maxColCount) {
            newRow.push('');
          }
          return newRow.map(cell => cell.trim());
        });

        excelSheets.value = [{ name: file.name, rows: paddedRows, maxColCount }];
        selectedSheetIndex.value = 0;
        excelLoading.value = false;
      } catch (err: any) {
        toast.add({ title: 'CSV Parse Error', description: err.message, color: 'error' });
        excelLoading.value = false;
        resetExcel();
      }
    };
    reader.readAsText(file);
  } else {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) return;
        const ExcelJS: any = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        excelWorkbook.value = workbook;

        const parsedSheets: SheetData[] = [];
        workbook.eachSheet((worksheet: any) => {
          const rows: any[][] = [];
          let maxColCount = 0;

          worksheet.eachRow({ includeEmpty: true }, (row: any) => {
            row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
              if (colNumber > maxColCount) maxColCount = colNumber;
            });
          });

          worksheet.eachRow({ includeEmpty: true }, (row: any) => {
            const rowValues: any[] = [];
            for (let c = 1; c <= maxColCount; c++) {
              const cell = row.getCell(c);
              let val: any = cell.value;
              if (val && typeof val === 'object') {
                if (val.result !== undefined) {
                  val = val.result;
                } else if (val.text !== undefined) {
                  val = val.text;
                } else if (val instanceof Date) {
                  val = val.toLocaleDateString();
                } else {
                  val = JSON.stringify(val);
                }
              }
              rowValues.push(val !== undefined && val !== null ? String(val) : '');
            }
            rows.push(rowValues);
          });

          parsedSheets.push({ name: worksheet.name, rows, maxColCount });
        });

        excelSheets.value = parsedSheets;
        selectedSheetIndex.value = 0;
        excelLoading.value = false;
      } catch (err: any) {
        toast.add({ title: 'Excel Parse Error', description: err.message, color: 'error' });
        excelLoading.value = false;
        resetExcel();
      }
    };
    reader.readAsArrayBuffer(file);
  }
};

const resetExcel = () => {
  excelFile.value = null;
  excelSheets.value = [];
  excelWorkbook.value = null;
  selectedSheetIndex.value = 0;
  excelSearchQuery.value = '';
  excelPage.value = 1;
};

const currentSheetData = computed<SheetData | null>(() => {
  const sheets = excelSheets.value;
  const idx = selectedSheetIndex.value;
  if (idx < 0 || idx >= sheets.length) return null;
  return sheets[idx] || null;
});

const parsedSheetContent = computed<ParsedContent | null>(() => {
  const sheet = currentSheetData.value;
  if (!sheet) return null;

  const useHeader = firstRowIsHeader.value;
  const cleanDesc = cleanDescriptionEnabled.value;
  const rawRows = sheet.rows;
  const maxCols = sheet.maxColCount;

  let headers: string[] = [];
  let dataRows: any[][] = [];

  const headerRow = rawRows[0];
  if (useHeader && rawRows.length > 0 && headerRow) {
    headers = headerRow.map((h: any, i: number) => h ? String(h).trim() : `Column ${i + 1}`);
    dataRows = rawRows.slice(1);
  } else {
    for (let i = 0; i < maxCols; i++) {
      headers.push(getColLetter(i));
    }
    dataRows = rawRows;
  }

  if (cleanDesc) {
    const descColIdx = headers.findIndex(h => {
      const s = h.trim().toLowerCase();
      return s.includes('description') || s.includes('narration') || s.includes('particulars');
    });
    const refColIdx = headers.findIndex(h => {
      const s = h.trim().toLowerCase();
      return s.includes('ref') || s.includes('cheque') || s.includes('chq') || s.includes('instr');
    });

    if (descColIdx !== -1) {
      dataRows = dataRows.map(row => {
        const newRow = [...row];
        const rawDescVal = newRow[descColIdx];
        if (rawDescVal !== undefined) {
          const descVal = String(rawDescVal || '');
          const refVal = refColIdx !== -1 ? String(newRow[refColIdx] || '') : '';
          newRow[descColIdx] = cleanDescription(descVal, refVal);
        }
        return newRow;
      });
    }
  }

  return { headers, rows: dataRows };
});

const isDescriptionColumn = (cIdx: number): boolean => {
  if (!cleanDescriptionEnabled.value || !parsedSheetContent.value?.headers) return false;
  const header = parsedSheetContent.value.headers[cIdx] || '';
  const h = header.toLowerCase();
  return h.includes('description') || h.includes('narration') || h.includes('particulars');
};

const filteredExcelRows = computed<any[][]>(() => {
  const content = parsedSheetContent.value;
  if (!content) return [];

  const query = excelSearchQuery.value.trim().toLowerCase();
  if (!query) return content.rows;

  return content.rows.filter(row =>
    row.some((cell: any) => String(cell).toLowerCase().includes(query))
  );
});

const paginatedExcelRows = computed<any[][]>(() => {
  const rows = filteredExcelRows.value;
  const page = excelPage.value;
  const size = excelPageSize;
  const start = (page - 1) * size;
  return rows.slice(start, start + size);
});

const totalExcelPages = computed<number>(() => {
  const total = filteredExcelRows.value.length;
  return Math.ceil(total / excelPageSize) || 1;
});

const downloadCleanedExcel = async () => {
  const content = parsedSheetContent.value;
  if (!content) return;

  try {
    const ExcelJS: any = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(currentSheetData.value?.name || 'Cleaned');

    worksheet.addRow(content.headers);
    content.rows.forEach(row => {
      worksheet.addRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const origName = excelFile.value?.name || 'statement.xlsx';
    const baseName = origName.substring(0, origName.lastIndexOf('.')) || origName;
    a.download = `${baseName}_cleaned.xlsx`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.add({ title: 'Export Successful', description: 'Cleaned statement downloaded', color: 'success' });
  } catch (err: any) {
    toast.add({ title: 'Export Failed', description: err.message, color: 'error' });
  }
};

// ==================== ONE-CLICK VOUCHER CREATION ====================

const mainAmount = () => {
  return vform.value.entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
};

const closeVoucherModal = () => {
  showVoucherModal.value = false;
};

const addLine = () => {
  vform.value.entries.push({ accountHead: '', amount: 0, type: 'MAIN' });
};

const removeLine = (idx: number) => {
  vform.value.entries.splice(idx, 1);
};

const openVoucherFromExcelRow = (row: any) => {
  const content = parsedSheetContent.value;
  if (!content || !content.headers) return;

  const headers = content.headers.map(h => h.trim().toLowerCase());
  const dateIdx = headers.findIndex(h => h.includes('date') && !h.includes('value'));
  const descIdx = headers.findIndex(h => h.includes('description') || h.includes('narration') || h.includes('particulars'));
  const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('cheque') || h.includes('chq') || h.includes('instr'));
  const debitIdx = headers.findIndex(h => h.includes('debit'));
  const creditIdx = headers.findIndex(h => h.includes('credit'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('value'));

  const rawDate = dateIdx !== -1 ? row[dateIdx] : '';
  const rawDesc = descIdx !== -1 ? row[descIdx] : '';
  const rawRef = refIdx !== -1 ? row[refIdx] : '';

  const parseAmount = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const cleanVal = String(val).replace(/["\s,]/g, '');
    return parseFloat(cleanVal) || 0;
  };

  let vtype = 'PAYMENT';
  let amount = 0;

  if (debitIdx !== -1 && creditIdx !== -1) {
    const debitAmount = parseAmount(row[debitIdx]);
    const creditAmount = parseAmount(row[creditIdx]);
    if (creditAmount > 0) {
      vtype = 'RECEIPT';
      amount = creditAmount;
    } else {
      vtype = 'PAYMENT';
      amount = debitAmount;
    }
  } else if (amountIdx !== -1) {
    const parsedAmount = parseAmount(row[amountIdx]);
    vtype = parsedAmount >= 0 ? 'RECEIPT' : 'PAYMENT';
    amount = Math.abs(parsedAmount);
  }

  let parsedDate = new Date().toISOString().split('T')[0] || '';
  if (rawDate) {
    const dateStr = String(rawDate).trim().split(' ')[0] || '';
    const sep = dateStr.includes('-') ? '-' : dateStr.includes('/') ? '/' : '';
    if (sep && dateStr) {
      const parts = dateStr.split(sep);
      if (parts.length === 3) {
        const day = parts[0] || '';
        const monthStr = parts[1] || '';
        let year = parts[2] || '';
        if (year && year.length === 2) year = '20' + year;
        let month = monthStr;
        if (isNaN(Number(monthStr))) {
          const months: Record<string, string> = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
          };
          month = months[monthStr.toLowerCase().substring(0, 3)] || '01';
        } else {
          month = monthStr.padStart(2, '0');
        }
        if (day.length === 4) {
          parsedDate = `${day}-${monthStr.padStart(2, '0')}-${year.padStart(2, '0')}`;
        } else if (year) {
          parsedDate = `${year}-${month}-${day.padStart(2, '0')}`;
        }
      }
    }
  }

  const cleanedPayeeName = cleanDescription(rawDesc, rawRef);
  const defaultBank = accounts.value.find(a => a.is_default);

  vform.value = {
    mainAccount: defaultBank ? defaultBank._id : (accounts.value[0]?._id || ''),
    vtype,
    vdate: parsedDate,
    narration: `Voucher for statement entry: ${rawDesc} ${rawRef ? '(Ref: ' + rawRef + ')' : ''}`.trim(),
    entries: [
      { accountHead: cleanedPayeeName, amount: amount || 0, type: 'MAIN' }
    ]
  };

  showVoucherModal.value = true;
};

const submitVoucher = async () => {
  if (vform.value.vtype !== 'JOURNAL' && !vform.value.mainAccount) {
    toast.add({ title: 'Validation Error', description: 'Please select a bank account', color: 'warning' });
    return;
  }

  savingVoucher.value = true;
  try {
    const res = await api.post('/vouchers', {
      vtype: vform.value.vtype,
      vdate: vform.value.vdate,
      narration: vform.value.narration,
      mainAccount: vform.value.mainAccount,
      entries: vform.value.entries.filter(e => e.accountHead && e.amount > 0),
      summary: {
        mainAmount: mainAmount(),
        netAmount: mainAmount()
      }
    });

    if (res.success) {
      toast.add({ title: 'Voucher Recorded', description: 'Voucher saved successfully to ledger', color: 'success' });
      showVoucherModal.value = false;
      fetchData();
    } else {
      toast.add({ title: 'Save Failed', description: res.message || 'Error saving voucher', color: 'error' });
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message || 'Failed to save voucher', color: 'error' });
  } finally {
    savingVoucher.value = false;
  }
};
</script>
