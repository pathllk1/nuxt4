<template>
  <div class="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <!-- Header Section (Full-Width View with All Creation Navigation Links) -->
    <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none shrink-0">
          <UIcon name="i-heroicons-document-text" class="w-7 h-7" />
        </div>
        <div>
          <h1 class="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">Sales & Purchase Bills</h1>
          <p class="text-xs font-semibold text-slate-500 dark:text-zinc-400 mt-1">Unified register for inventory goods & accounting service invoices, purchase bills, and notes</p>
        </div>
      </div>

      <!-- Quick Action Navigation Links -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Goods Sales -->
        <UButton
          color="primary"
          icon="i-heroicons-shopping-cart"
          size="sm"
          label="+ Goods Sale"
          class="font-black text-xs h-10 px-3.5 rounded-xl shadow-sm cursor-pointer"
          @click="$router.push('/accounting/sales/new')"
        />
        <!-- Service Sales -->
        <UButton
          color="info"
          icon="i-heroicons-briefcase"
          size="sm"
          label="+ Service Sale"
          class="font-black text-xs h-10 px-3.5 rounded-xl shadow-sm cursor-pointer"
          @click="$router.push('/accounting/sales/service')"
        />
        <!-- Goods Purchase -->
        <UButton
          color="success"
          variant="soft"
          icon="i-heroicons-cube"
          size="sm"
          label="+ Goods Purchase"
          class="font-black text-xs h-10 px-3.5 rounded-xl shadow-sm cursor-pointer"
          @click="$router.push('/accounting/purchases/new')"
        />
        <!-- Service Purchase -->
        <UButton
          color="error"
          variant="soft"
          icon="i-heroicons-receipt-percent"
          size="sm"
          label="+ Service Purchase"
          class="font-black text-xs h-10 px-3.5 rounded-xl shadow-sm cursor-pointer"
          @click="$router.push('/accounting/purchases/service')"
        />
      </div>
    </div>

    <!-- Filter, Search & Column Customization Bar -->
    <div class="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3 flex-1">
        <!-- Bill Type Select -->
        <div class="w-full sm:w-56">
          <USelect 
            v-model="filters.btype" 
            :items="typeOptions" 
            class="w-full" 
            placeholder="Select Bill Type"
            size="md"
            @update:model-value="handleFilterChange" 
          />
        </div>
        
        <!-- Search Input -->
        <div class="flex-1 min-w-[240px]">
          <UInput 
            v-model="partySearch" 
            placeholder="Search party, GSTIN, bill or ref no..." 
            icon="i-heroicons-magnifying-glass"
            size="md"
            class="w-full" 
          />
        </div>

        <!-- 1-Click Tax Breakup Toggle -->
        <UButton
          :color="isTaxBreakupActive ? 'primary' : 'neutral'"
          :variant="isTaxBreakupActive ? 'solid' : 'outline'"
          :icon="isTaxBreakupActive ? 'i-heroicons-receipt-percent' : 'i-heroicons-table-cells'"
          :label="isTaxBreakupActive ? 'Tax Split Active' : 'Show Tax Split'"
          size="md"
          class="font-bold text-xs rounded-xl cursor-pointer"
          @click="toggleTaxBreakup"
          title="Toggle CGST, SGST, IGST columns"
        />

        <!-- Column Customizer Dropdown -->
        <div class="relative">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-heroicons-view-columns"
            label="Columns"
            size="md"
            class="font-bold text-xs rounded-xl cursor-pointer"
            @click="showColumnMenu = !showColumnMenu"
          />

          <!-- Backdrop to close on click outside -->
          <div 
            v-if="showColumnMenu" 
            class="fixed inset-0 z-20" 
            @click="showColumnMenu = false"
          />

          <!-- Columns Menu -->
          <div 
            v-if="showColumnMenu" 
            class="absolute left-0 sm:left-auto sm:right-0 mt-2 z-30 w-60 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 p-3 text-xs space-y-2.5"
          >
            <div class="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-zinc-800">
              <span class="font-black text-[10px] uppercase tracking-wider text-gray-900 dark:text-white">Visible Columns</span>
              <div class="flex items-center gap-2">
                <button @click="applyPreset('default')" class="text-[10px] text-primary hover:underline font-bold cursor-pointer">Reset</button>
                <button @click="showColumnMenu = false" class="text-gray-400 hover:text-gray-700 dark:hover:text-white p-0.5 rounded cursor-pointer" title="Close">
                  <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                <input type="checkbox" v-model="visibleCols.type" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
                <span>Type / Mode</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                <input type="checkbox" v-model="visibleCols.status" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
                <span>Status</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                <input type="checkbox" v-model="visibleCols.taxable" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
                <span>Taxable Amount</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                <input type="checkbox" v-model="visibleCols.cgst" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
                <span>CGST</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                <input type="checkbox" v-model="visibleCols.sgst" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
                <span>SGST</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                <input type="checkbox" v-model="visibleCols.igst" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
                <span>IGST</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                <input type="checkbox" v-model="visibleCols.totalTax" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
                <span>Total Tax</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                <input type="checkbox" v-model="visibleCols.roundOff" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
                <span>Round Off</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                <input type="checkbox" v-model="visibleCols.netTotal" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
                <span>Net Amount</span>
              </label>
            </div>

            <div class="pt-2 border-t border-gray-100 dark:border-zinc-800 flex gap-1.5">
              <button @click="applyPreset('gst')" class="flex-1 py-1 px-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-wider cursor-pointer">
                GST View
              </button>
              <button @click="applyPreset('compact')" class="flex-1 py-1 px-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-[10px] font-black uppercase tracking-wider cursor-pointer">
                Compact
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Exports -->
      <div class="flex items-center gap-2 shrink-0">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-table-cells"
          label="Export Excel"
          size="md"
          class="text-xs font-bold rounded-xl cursor-pointer"
          @click="exportExcel"
          title="Export Filtered Bills to Excel"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-document-arrow-down"
          label="Export PDF"
          size="md"
          class="text-xs font-bold rounded-xl cursor-pointer"
          @click="exportPDF"
          title="Export Filtered Bills to PDF"
        />
      </div>
    </div>

    <!-- Full Width Bills Table Card -->
    <UCard class="w-full shadow-sm rounded-3xl border border-slate-100 dark:border-zinc-800 overflow-hidden" :ui="{ body: 'p-0' }">
      <!-- Loader -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-zinc-900">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-emerald-600" />
        <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Fetching bills register...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredBills.length === 0" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-900 text-center p-6">
        <div class="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8" />
        </div>
        <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">No Bills Found</h3>
        <p class="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">No sales or purchase bills matched your current filter criteria.</p>
      </div>

      <!-- Table View -->
      <div v-else class="overflow-x-auto w-full">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50 dark:bg-zinc-800/80 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800 whitespace-nowrap">
              <th class="px-4 py-3.5 cursor-pointer select-none group" @click="toggleSort('bdate')">
                <div class="flex items-center gap-1">
                  <span class="group-hover:text-primary">Bill Info</span>
                  <UIcon v-if="sortField === 'bdate'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
                </div>
              </th>
              <th class="px-4 py-3.5 cursor-pointer select-none group" @click="toggleSort('partyName')">
                <div class="flex items-center gap-1">
                  <span class="group-hover:text-primary">Party Name</span>
                  <UIcon v-if="sortField === 'partyName'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
                </div>
              </th>
              <th v-if="visibleCols.type" class="px-4 py-3.5">Type / Mode</th>
              <th v-if="visibleCols.status" class="px-4 py-3.5 cursor-pointer select-none group" @click="toggleSort('status')">
                <div class="flex items-center gap-1">
                  <span class="group-hover:text-primary">Status</span>
                  <UIcon v-if="sortField === 'status'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
                </div>
              </th>
              <th v-if="visibleCols.taxable" class="px-4 py-3.5 text-right cursor-pointer select-none group" @click="toggleSort('taxable')">
                <div class="flex items-center justify-end gap-1">
                  <span class="group-hover:text-primary">Taxable</span>
                  <UIcon v-if="sortField === 'taxable'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
                </div>
              </th>
              <th v-if="visibleCols.cgst" class="px-4 py-3.5 text-right cursor-pointer select-none group" @click="toggleSort('cgst')">
                <div class="flex items-center justify-end gap-1">
                  <span class="group-hover:text-primary">CGST</span>
                  <UIcon v-if="sortField === 'cgst'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
                </div>
              </th>
              <th v-if="visibleCols.sgst" class="px-4 py-3.5 text-right cursor-pointer select-none group" @click="toggleSort('sgst')">
                <div class="flex items-center justify-end gap-1">
                  <span class="group-hover:text-primary">SGST</span>
                  <UIcon v-if="sortField === 'sgst'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
                </div>
              </th>
              <th v-if="visibleCols.igst" class="px-4 py-3.5 text-right cursor-pointer select-none group" @click="toggleSort('igst')">
                <div class="flex items-center justify-end gap-1">
                  <span class="group-hover:text-primary">IGST</span>
                  <UIcon v-if="sortField === 'igst'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
                </div>
              </th>
              <th v-if="visibleCols.totalTax" class="px-4 py-3.5 text-right cursor-pointer select-none group" @click="toggleSort('totalTax')">
                <div class="flex items-center justify-end gap-1">
                  <span class="group-hover:text-primary">Total Tax</span>
                  <UIcon v-if="sortField === 'totalTax'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
                </div>
              </th>
              <th v-if="visibleCols.roundOff" class="px-4 py-3.5 text-right">Round Off</th>
              <th v-if="visibleCols.netTotal" class="px-4 py-3.5 text-right cursor-pointer select-none group" @click="toggleSort('netTotal')">
                <div class="flex items-center justify-end gap-1">
                  <span class="group-hover:text-primary">Net Amount</span>
                  <UIcon v-if="sortField === 'netTotal'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
                </div>
              </th>
              <th class="px-4 py-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
            <tr v-for="bill in paginatedBills" :key="bill._id" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
              <!-- Bill Info -->
              <td class="px-4 py-3">
                <div class="font-black text-slate-900 dark:text-white uppercase tracking-tight">{{ bill.bno || 'N/A' }}</div>
                <div class="text-[10px] text-slate-400 font-bold mt-0.5">{{ formatDate(bill.bdate || bill.createdAt) }}</div>
                <div v-if="bill.supplierBillNo" class="text-[9px] font-mono font-semibold text-slate-500 mt-0.5">
                  Ref: {{ bill.supplierBillNo }}
                </div>
              </td>

              <!-- Party Name & GSTIN -->
              <td class="px-4 py-3">
                <div class="font-black text-slate-800 dark:text-zinc-200 uppercase">{{ bill.partyName || 'Cash / General' }}</div>
                <div class="text-[10px] text-slate-400 font-mono" v-if="bill.partyGstin">GSTIN: {{ bill.partyGstin }}</div>
              </td>

              <!-- Type & Invoice Mode -->
              <td v-if="visibleCols.type" class="px-4 py-3">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <UBadge :color="getTypeColor(bill.btype)" variant="soft" size="xs" class="font-black uppercase tracking-wider">
                    {{ bill.btype }}
                  </UBadge>
                  <UBadge 
                    v-if="bill.invoiceMode === 'ACCOUNTING' || bill.billSubtype === 'SERVICE'" 
                    color="info" 
                    variant="subtle" 
                    size="xs" 
                    class="text-[9px] font-bold uppercase"
                  >
                    Service
                  </UBadge>
                  <UBadge 
                    v-else 
                    color="neutral" 
                    variant="subtle" 
                    size="xs" 
                    class="text-[9px] font-bold uppercase"
                  >
                    Goods
                  </UBadge>
                </div>
              </td>

              <!-- Status -->
              <td v-if="visibleCols.status" class="px-4 py-3">
                <UBadge :color="getStatusColor(bill.status)" variant="subtle" size="xs" class="font-bold uppercase">
                  {{ bill.status || 'ACTIVE' }}
                </UBadge>
              </td>

              <!-- Taxable Amount -->
              <td v-if="visibleCols.taxable" class="px-4 py-3 text-right font-bold text-slate-700 dark:text-zinc-300 font-mono">
                ₹{{ (bill.grossTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>

              <!-- CGST -->
              <td v-if="visibleCols.cgst" class="px-4 py-3 text-right font-mono" :class="(bill.cgst || 0) > 0 ? 'text-slate-700 dark:text-zinc-300 font-medium' : 'text-slate-400 dark:text-zinc-600'">
                {{ (bill.cgst || 0) > 0 ? '₹' + Number(bill.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-' }}
              </td>

              <!-- SGST -->
              <td v-if="visibleCols.sgst" class="px-4 py-3 text-right font-mono" :class="(bill.sgst || 0) > 0 ? 'text-slate-700 dark:text-zinc-300 font-medium' : 'text-slate-400 dark:text-zinc-600'">
                {{ (bill.sgst || 0) > 0 ? '₹' + Number(bill.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-' }}
              </td>

              <!-- IGST -->
              <td v-if="visibleCols.igst" class="px-4 py-3 text-right font-mono" :class="(bill.igst || 0) > 0 ? 'text-slate-700 dark:text-zinc-300 font-medium' : 'text-slate-400 dark:text-zinc-600'">
                {{ (bill.igst || 0) > 0 ? '₹' + Number(bill.igst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-' }}
              </td>

              <!-- Total Tax Amount -->
              <td v-if="visibleCols.totalTax" class="px-4 py-3 text-right font-mono font-bold" :class="getBillTax(bill) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-zinc-600'">
                ₹{{ getBillTax(bill).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>

              <!-- Round Off -->
              <td v-if="visibleCols.roundOff" class="px-4 py-3 text-right text-slate-500 font-mono">
                {{ (bill.roundOff || 0) !== 0 ? (bill.roundOff > 0 ? '+' : '') + Number(bill.roundOff).toFixed(2) : '0.00' }}
              </td>

              <!-- Net Amount -->
              <td v-if="visibleCols.netTotal" class="px-4 py-3 text-right font-black text-indigo-600 dark:text-indigo-400 font-mono text-sm">
                ₹{{ (bill.netTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>

              <!-- Actions -->
              <td class="px-4 py-3">
                <div class="flex items-center justify-center gap-1.5">
                  <UButton 
                    size="xs" 
                    variant="ghost" 
                    color="neutral" 
                    icon="i-heroicons-eye" 
                    title="View Details"
                    class="cursor-pointer"
                    @click="viewBillDetails(bill._id)" 
                  />
                  <UButton 
                    size="xs" 
                    variant="ghost" 
                    color="primary" 
                    icon="i-heroicons-arrow-down-tray" 
                    title="Download PDF"
                    class="cursor-pointer"
                    @click="downloadBillPdf(bill)" 
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Summary Totals Footer -->
        <div v-if="filteredBills.length > 0" class="bg-slate-50 dark:bg-zinc-800/80 border-t border-slate-200 dark:border-zinc-700 p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-black uppercase tracking-wider text-[10px] text-slate-500 dark:text-zinc-400">Total Filtered:</span>
            <span class="font-bold text-slate-900 dark:text-white">{{ summaryTotals.count }} Bills</span>
          </div>

          <div class="flex flex-wrap items-center gap-4 sm:gap-6 font-mono">
            <div v-if="visibleCols.taxable" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500">Taxable</span>
              <span class="font-bold text-slate-800 dark:text-zinc-200">₹{{ summaryTotals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="visibleCols.cgst" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500">CGST</span>
              <span class="font-bold text-slate-800 dark:text-zinc-200">₹{{ summaryTotals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="visibleCols.sgst" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500">SGST</span>
              <span class="font-bold text-slate-800 dark:text-zinc-200">₹{{ summaryTotals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="visibleCols.igst" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500">IGST</span>
              <span class="font-bold text-slate-800 dark:text-zinc-200">₹{{ summaryTotals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="visibleCols.totalTax" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400">Total Tax</span>
              <span class="font-bold text-amber-600 dark:text-amber-400">₹{{ summaryTotals.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="visibleCols.roundOff" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-slate-400 dark:text-zinc-500">Round Off</span>
              <span class="font-bold text-slate-800 dark:text-zinc-200">{{ summaryTotals.roundOff >= 0 ? '+' : '' }}{{ summaryTotals.roundOff.toFixed(2) }}</span>
            </div>

            <div v-if="visibleCols.netTotal" class="flex flex-col items-end pl-2 border-l border-slate-300 dark:border-zinc-600">
              <span class="text-[9px] uppercase font-black text-indigo-600 dark:text-indigo-400">Net Total</span>
              <span class="font-black text-sm text-indigo-600 dark:text-indigo-400">₹{{ summaryTotals.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
          </div>
        </div>

        <!-- Pagination Footer -->
        <div v-if="filteredBills.length > 0" class="bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 p-3.5 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div class="text-slate-500 dark:text-zinc-400 font-medium">
            Showing <span class="font-bold text-slate-900 dark:text-white">{{ filteredBills.length === 0 ? 0 : (currentPage - 1) * pageSize + 1 }}</span>
            to <span class="font-bold text-slate-900 dark:text-white">{{ Math.min(currentPage * pageSize, filteredBills.length) }}</span>
            of <span class="font-bold text-slate-900 dark:text-white">{{ filteredBills.length }}</span> bills
          </div>

          <div class="flex items-center gap-3">
            <div class="w-32">
              <USelect v-model="pageSize" :items="pageSizeOptions" size="xs" class="w-full" />
            </div>
            <UPagination
              v-model:page="currentPage"
              :total="filteredBills.length"
              :items-per-page="pageSize"
              size="xs"
              :show-edges="true"
            />
          </div>
        </div>
      </div>
    </UCard>

    <BillDetailsModal
      v-model="showDetailsModal"
      :billId="selectedBillId"
      @cancelled="handleFilterChange"
      @view-bill="viewBillDetails"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue';
import { useBilling } from '@/composables/useBilling';
import { api } from '@/utils/api';
import BillDetailsModal from '@/components/accounting/BillDetailsModal.vue';

const { bills, fetchBills, loading } = useBilling();

const selectedBillId = ref<string | null>(null);
const showDetailsModal = ref(false);
const showColumnMenu = ref(false);
const partySearch = ref('');

const filters = reactive({
  btype: 'ALL'
});

// Sorting state
const sortField = ref<'bdate' | 'bno' | 'partyName' | 'status' | 'taxable' | 'cgst' | 'sgst' | 'igst' | 'totalTax' | 'netTotal'>('bdate');
const sortDirection = ref<'asc' | 'desc'>('desc');

function toggleSort(field: any) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = 'desc';
  }
}

// Visible Columns State
const visibleCols = reactive({
  type: true,
  status: true,
  taxable: true,
  cgst: false,
  sgst: false,
  igst: false,
  totalTax: true,
  roundOff: false,
  netTotal: true,
});

const isTaxBreakupActive = computed(() => visibleCols.cgst && visibleCols.sgst && visibleCols.igst);

function toggleTaxBreakup() {
  if (isTaxBreakupActive.value) {
    visibleCols.cgst = false;
    visibleCols.sgst = false;
    visibleCols.igst = false;
    visibleCols.totalTax = true;
  } else {
    visibleCols.cgst = true;
    visibleCols.sgst = true;
    visibleCols.igst = true;
  }
  saveColumnPrefs();
}

function applyPreset(preset: 'default' | 'gst' | 'compact') {
  if (preset === 'gst') {
    visibleCols.type = true;
    visibleCols.status = true;
    visibleCols.taxable = true;
    visibleCols.cgst = true;
    visibleCols.sgst = true;
    visibleCols.igst = true;
    visibleCols.totalTax = true;
    visibleCols.roundOff = true;
    visibleCols.netTotal = true;
  } else if (preset === 'compact') {
    visibleCols.type = false;
    visibleCols.status = true;
    visibleCols.taxable = false;
    visibleCols.cgst = false;
    visibleCols.sgst = false;
    visibleCols.igst = false;
    visibleCols.totalTax = false;
    visibleCols.roundOff = false;
    visibleCols.netTotal = true;
  } else {
    visibleCols.type = true;
    visibleCols.status = true;
    visibleCols.taxable = true;
    visibleCols.cgst = false;
    visibleCols.sgst = false;
    visibleCols.igst = false;
    visibleCols.totalTax = true;
    visibleCols.roundOff = false;
    visibleCols.netTotal = true;
  }
  saveColumnPrefs();
}

function saveColumnPrefs() {
  try {
    localStorage.setItem('inventory_bills_columns_v2', JSON.stringify(visibleCols));
  } catch {}
}

function loadColumnPrefs() {
  try {
    const saved = localStorage.getItem('inventory_bills_columns_v2');
    if (saved) {
      Object.assign(visibleCols, JSON.parse(saved));
    }
  } catch {}
}

const typeOptions = [
  { label: 'All Bills & Invoices', value: 'ALL' },
  { label: 'Goods Sales Invoices', value: 'SALES_GOODS' },
  { label: 'Service Sales Invoices', value: 'SALES_SERVICE' },
  { label: 'Goods Purchase Bills', value: 'PURCHASE_GOODS' },
  { label: 'Service Purchase Bills', value: 'PURCHASE_SERVICE' },
  { label: 'Proforma Invoices', value: 'PROFORMA' },
  { label: 'Delivery Challans', value: 'DELIVERY_NOTE' },
  { label: 'Credit Notes', value: 'CREDIT_NOTE' },
  { label: 'Debit Notes', value: 'DEBIT_NOTE' }
];

const filteredBills = computed(() => {
  let list = bills.value;
  if (partySearch.value) {
    const q = partySearch.value.toLowerCase().trim();
    list = list.filter(b => 
      (b.partyName && b.partyName.toLowerCase().includes(q)) || 
      (b.partyGstin && b.partyGstin.toLowerCase().includes(q)) || 
      (b.bno && b.bno.toLowerCase().includes(q)) ||
      (b.supplierBillNo && b.supplierBillNo.toLowerCase().includes(q))
    );
  }

  return [...list].sort((a: any, b: any) => {
    let aVal = a[sortField.value === 'taxable' ? 'grossTotal' : sortField.value];
    let bVal = b[sortField.value === 'taxable' ? 'grossTotal' : sortField.value];

    if (sortField.value === 'totalTax') {
      aVal = getBillTax(a);
      bVal = getBillTax(b);
    }

    if (sortField.value === 'bdate') {
      const aTime = new Date(a.bdate || a.createdAt || 0).getTime();
      const bTime = new Date(b.bdate || b.createdAt || 0).getTime();
      if (aTime !== bTime) {
        return sortDirection.value === 'asc' ? aTime - bTime : bTime - aTime;
      }
      return sortDirection.value === 'asc' 
        ? String(a.bno || '').localeCompare(String(b.bno || ''))
        : String(b.bno || '').localeCompare(String(a.bno || ''));
    }

    if (typeof aVal === 'number' || typeof bVal === 'number') {
      const diff = (Number(aVal) || 0) - (Number(bVal) || 0);
      return sortDirection.value === 'asc' ? diff : -diff;
    }

    const strA = String(aVal || '').toLowerCase();
    const strB = String(bVal || '').toLowerCase();
    return sortDirection.value === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });
});

// Client-Side Pagination State
const currentPage = ref(1);
const pageSize = ref(15);
const pageSizeOptions = [
  { label: '10 / page', value: 10 },
  { label: '15 / page', value: 15 },
  { label: '25 / page', value: 25 },
  { label: '50 / page', value: 50 },
  { label: '100 / page', value: 100 }
];

const paginatedBills = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredBills.value.slice(start, start + pageSize.value);
});

// Reset page on filter, search or pageSize change
watch([() => filters.btype, partySearch, pageSize], () => {
  currentPage.value = 1;
});

const summaryTotals = computed(() => {
  let taxable = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let totalTax = 0;
  let roundOff = 0;
  let netTotal = 0;

  for (const b of filteredBills.value) {
    const c = Number(b.cgst) || 0;
    const s = Number(b.sgst) || 0;
    const i = Number(b.igst) || 0;
    taxable += Number(b.grossTotal) || 0;
    cgst += c;
    sgst += s;
    igst += i;
    totalTax += (c + s + i);
    roundOff += Number(b.roundOff) || 0;
    netTotal += Number(b.netTotal) || 0;
  }

  return { taxable, cgst, sgst, igst, totalTax, roundOff, netTotal, count: filteredBills.value.length };
});

function getBillTax(bill: any): number {
  if (bill.totalTax !== undefined && bill.totalTax !== null && !isNaN(Number(bill.totalTax))) {
    return Number(bill.totalTax);
  }
  const cgst = parseFloat(bill.cgst) || 0;
  const sgst = parseFloat(bill.sgst) || 0;
  const igst = parseFloat(bill.igst) || 0;
  return parseFloat((cgst + sgst + igst).toFixed(2));
}

function handleFilterChange() {
  const params: any = {};
  if (filters.btype && filters.btype !== 'ALL') {
    params.btype = filters.btype;
  }
  fetchBills(params);
}

function viewBillDetails(id: string) {
  selectedBillId.value = id;
  showDetailsModal.value = true;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTypeColor(type: string) {
  switch (type) {
    case 'SALES': return 'primary';
    case 'PURCHASE': return 'success';
    case 'PROFORMA': return 'info';
    case 'CREDIT_NOTE': return 'warning';
    case 'DEBIT_NOTE': return 'error';
    default: return 'neutral';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'CANCELLED': return 'error';
    case 'DRAFT': return 'warning';
    default: return 'neutral';
  }
}

async function downloadBillPdf(bill: any) {
  try {
    const res = await api.get(`/accounting/bills/${bill._id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bill_${bill.bno || bill._id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF download error:', err);
  }
}

async function exportExcel() {
  try {
    const params: any = {};
    if (filters.btype !== 'ALL') params.btype = filters.btype;
    if (partySearch.value) params.search = partySearch.value;
    params.sortOrder = sortDirection.value;

    const res = await api.get('/accounting/bills/export', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(res);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bills_Register_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Excel export error:', err);
  }
}

async function exportPDF() {
  try {
    const params: any = {};
    if (filters.btype !== 'ALL') params.btype = filters.btype;
    if (partySearch.value) params.search = partySearch.value;
    params.sortOrder = sortDirection.value;

    const res = await api.get('/accounting/bills/export/pdf', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(res);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bills_Register_Report.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF export error:', err);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showColumnMenu.value) {
    showColumnMenu.value = false;
  }
}

onMounted(() => {
  loadColumnPrefs();
  fetchBills();
  window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>
