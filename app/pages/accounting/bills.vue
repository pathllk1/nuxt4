<template>
  <div class="p-4 py-3 w-full mx-auto space-y-3">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Invoices & Notes</h1>
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Manage sales, purchases, GST breakups and returns</p>
        </div>
      </div>
      <div class="flex gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-arrow-down-tray"
          size="sm"
          label="Import GSTR-2A"
          class="font-semibold text-xs h-8 cursor-pointer"
          @click="$router.push('/accounting/gst-returns?tab=gstr2a')"
        />
        <UButton
          color="success"
          variant="outline"
          icon="i-heroicons-plus"
          size="sm"
          label="Purchase"
          class="font-semibold text-xs h-8 cursor-pointer"
          @click="$router.push('/accounting/purchases/new')"
        />
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          size="sm"
          label="Sales Invoice"
          class="font-semibold text-xs h-8 cursor-pointer"
          @click="$router.push('/accounting/sales/new')"
        />
      </div>
    </div>

    <!-- Filters & Toolbar Section -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-wrap gap-3 items-end justify-between">
      <div class="flex flex-wrap gap-3 items-end flex-1 min-w-[280px]">
        <!-- Bill Type -->
        <div class="w-48 flex flex-col gap-1">
          <label class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-1">Type</label>
          <USelect 
            v-model="filters.btype" 
            :items="typeOptions" 
            class="w-full" 
            placeholder="Select Type"
            size="sm"
            @update:model-value="handleFilterChange" 
          />
        </div>

        <!-- Search Party / Bill No -->
        <div class="w-64 flex flex-col gap-1">
          <label class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-1">Search Party / Bill No</label>
          <UInput 
            ref="searchInput"
            v-model="partySearch" 
            placeholder="Search name, GSTIN, bill no..." 
            icon="i-heroicons-magnifying-glass"
            size="sm"
            class="w-full" 
            @keydown.down.prevent="moveActiveRow(1)"
            @keydown.up.prevent="moveActiveRow(-1)"
            @keydown.enter.prevent="selectActiveRow"
          />
        </div>

        <!-- 1-Click Tax Breakup Toggle -->
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-1">GST Tax View</label>
          <UButton
            :color="isTaxBreakupActive ? 'primary' : 'neutral'"
            :variant="isTaxBreakupActive ? 'solid' : 'outline'"
            :icon="isTaxBreakupActive ? 'i-heroicons-receipt-percent' : 'i-heroicons-table-cells'"
            :label="isTaxBreakupActive ? 'Tax Split Active' : 'Show Tax Split'"
            size="sm"
            class="h-8 text-xs font-bold cursor-pointer"
            @click="toggleTaxBreakup"
            title="Toggle CGST, SGST, IGST columns"
          />
        </div>

        <!-- Column Customizer Dropdown / Popover -->
        <div class="flex flex-col gap-1 relative">
          <label class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-1">Columns</label>
          <div class="relative">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-heroicons-view-columns"
              label="Columns"
              size="sm"
              class="h-8 text-xs font-bold cursor-pointer"
              @click="showColumnMenu = !showColumnMenu"
            />

            <!-- Backdrop to close on click outside -->
            <div 
              v-if="showColumnMenu" 
              class="fixed inset-0 z-20" 
              @click="showColumnMenu = false"
            />

            <!-- Dropdown Menu -->
            <div 
              v-if="showColumnMenu" 
              class="absolute left-0 sm:left-auto sm:right-0 mt-1 z-30 w-56 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 p-3 text-xs space-y-2.5"
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

              <div class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                  <input type="checkbox" v-model="visibleCols.grossTotal" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
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
                <label class="flex items-center gap-2 cursor-pointer py-0.5 text-gray-700 dark:text-zinc-300 select-none">
                  <input type="checkbox" v-model="visibleCols.status" @change="saveColumnPrefs" class="rounded text-primary focus:ring-0">
                  <span>Status</span>
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
      </div>

      <!-- Action Exports -->
      <div class="flex gap-2 shrink-0">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-table-cells"
          label="Export Excel"
          size="sm"
          class="h-8 text-xs font-bold cursor-pointer"
          @click="exportExcel"
          title="Export Filtered Bills with GST Breakup to Excel"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-document-arrow-down"
          label="Export PDF"
          size="sm"
          class="h-8 text-xs font-bold cursor-pointer"
          @click="exportPDF"
          title="Export Filtered Bills with GST Breakup to PDF Report"
        />
      </div>
    </div>

    <!-- Bills Table Card -->
    <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-gray-800" :ui="{ body: 'p-0 overflow-hidden' }">
      <!-- Loader -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-4 bg-white dark:bg-zinc-900">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-blue-600" />
        <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Loading invoices...</p>
      </div>

      <!-- Table View -->
      <div v-else class="overflow-x-auto">
        <UTable 
          :data="paginatedBills" 
          :columns="columns" 
          :loading="loading" 
          class="w-full text-xs"
          :ui="{ 
            td: 'py-2 px-3 text-gray-700 dark:text-zinc-300',
            th: 'py-2.5 px-3 text-gray-500 font-bold uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-800/80 border-b border-gray-100 dark:border-zinc-800 whitespace-nowrap',
            tr: 'hover:bg-green-50/80 dark:hover:bg-green-900/20 transition-colors cursor-pointer'
          }"
        >
          <!-- Bill Info Column Header & Cell -->
          <template #bno-header>
            <div class="flex items-center gap-1 cursor-pointer select-none group" @click="toggleSort('bdate')">
              <span class="group-hover:text-primary">Bill Info</span>
              <UIcon v-if="sortField === 'bdate'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
            </div>
          </template>
          <template #bno-cell="{ row }">
            <div>
              <div class="font-bold text-gray-900 dark:text-white leading-tight uppercase">{{ row.original.bno }}</div>
              <div class="text-[10px] uppercase font-black tracking-widest mt-0.5" :class="getTypeColor(row.original.btype)">
                {{ row.original.btype.replace('_', ' ') }}
              </div>
              <div class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                {{ formatDate(row.original.bdate) }}
              </div>
              <div v-if="row.original.supplierBillNo" class="text-[9px] font-mono text-gray-500 mt-0.5">
                Ref: {{ row.original.supplierBillNo }}
              </div>
            </div>
          </template>

          <!-- Party Name Column Header & Cell -->
          <template #partyName-header>
            <div class="flex items-center gap-1 cursor-pointer select-none group" @click="toggleSort('partyName')">
              <span class="group-hover:text-primary">Party Name</span>
              <UIcon v-if="sortField === 'partyName'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
            </div>
          </template>
          <template #partyName-cell="{ row }">
            <div>
              <div class="font-bold text-gray-800 dark:text-zinc-200 leading-tight uppercase">{{ row.original.partyName || 'Cash / General' }}</div>
              <div class="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5 font-mono">{{ row.original.partyGstin || 'UNREGISTERED' }}</div>
            </div>
          </template>

          <!-- Status Column -->
          <template #status-header>
            <div class="flex items-center gap-1 cursor-pointer select-none group" @click="toggleSort('status')">
              <span class="group-hover:text-primary">Status</span>
              <UIcon v-if="sortField === 'status'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
            </div>
          </template>
          <template #status-cell="{ row }">
            <UBadge 
              :color="row.original.status === 'ACTIVE' ? 'success' : (row.original.status === 'CONVERTED' ? 'neutral' : 'error')" 
              size="sm" 
              variant="subtle" 
              class="px-2 py-0.5 font-black uppercase tracking-widest text-[9px] rounded-md"
            >
              {{ row.original.status }}
            </UBadge>
          </template>

          <!-- Taxable Amount Column -->
          <template #grossTotal-header>
            <div class="flex items-center justify-end gap-1 cursor-pointer select-none w-full group" @click="toggleSort('grossTotal')">
              <span class="group-hover:text-primary">Taxable</span>
              <UIcon v-if="sortField === 'grossTotal'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
            </div>
          </template>
          <template #grossTotal-cell="{ row }">
            <div class="text-right w-full text-gray-700 dark:text-zinc-300 font-medium font-mono">
              ₹{{ (row.original.grossTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
          </template>

          <!-- CGST Column -->
          <template #cgst-header>
            <div class="flex items-center justify-end gap-1 cursor-pointer select-none w-full group" @click="toggleSort('cgst')">
              <span class="group-hover:text-primary">CGST</span>
              <UIcon v-if="sortField === 'cgst'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
            </div>
          </template>
          <template #cgst-cell="{ row }">
            <div class="text-right w-full font-mono" :class="(row.original.cgst || 0) > 0 ? 'text-gray-700 dark:text-zinc-300 font-medium' : 'text-gray-400 dark:text-zinc-600'">
              {{ (row.original.cgst || 0) > 0 ? '₹' + Number(row.original.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-' }}
            </div>
          </template>

          <!-- SGST Column -->
          <template #sgst-header>
            <div class="flex items-center justify-end gap-1 cursor-pointer select-none w-full group" @click="toggleSort('sgst')">
              <span class="group-hover:text-primary">SGST</span>
              <UIcon v-if="sortField === 'sgst'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
            </div>
          </template>
          <template #sgst-cell="{ row }">
            <div class="text-right w-full font-mono" :class="(row.original.sgst || 0) > 0 ? 'text-gray-700 dark:text-zinc-300 font-medium' : 'text-gray-400 dark:text-zinc-600'">
              {{ (row.original.sgst || 0) > 0 ? '₹' + Number(row.original.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-' }}
            </div>
          </template>

          <!-- IGST Column -->
          <template #igst-header>
            <div class="flex items-center justify-end gap-1 cursor-pointer select-none w-full group" @click="toggleSort('igst')">
              <span class="group-hover:text-primary">IGST</span>
              <UIcon v-if="sortField === 'igst'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
            </div>
          </template>
          <template #igst-cell="{ row }">
            <div class="text-right w-full font-mono" :class="(row.original.igst || 0) > 0 ? 'text-gray-700 dark:text-zinc-300 font-medium' : 'text-gray-400 dark:text-zinc-600'">
              {{ (row.original.igst || 0) > 0 ? '₹' + Number(row.original.igst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-' }}
            </div>
          </template>

          <!-- Total Tax Column -->
          <template #totalTax-header>
            <div class="flex items-center justify-end gap-1 cursor-pointer select-none w-full group" @click="toggleSort('totalTax')">
              <span class="group-hover:text-primary">Total Tax</span>
              <UIcon v-if="sortField === 'totalTax'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
            </div>
          </template>
          <template #totalTax-cell="{ row }">
            <div class="text-right w-full font-mono font-medium" :class="getBillTax(row.original) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-zinc-600'">
              ₹{{ getBillTax(row.original).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
          </template>

          <!-- Round Off Column -->
          <template #roundOff-header>
            <div class="text-right w-full">Round Off</div>
          </template>
          <template #roundOff-cell="{ row }">
            <div class="text-right w-full text-gray-500 font-mono">
              {{ (row.original.roundOff || 0) !== 0 ? (row.original.roundOff > 0 ? '+' : '') + Number(row.original.roundOff).toFixed(2) : '0.00' }}
            </div>
          </template>

          <!-- Net Amount Column -->
          <template #netTotal-header>
            <div class="flex items-center justify-end gap-1 cursor-pointer select-none w-full group" @click="toggleSort('netTotal')">
              <span class="group-hover:text-primary">Net Amount</span>
              <UIcon v-if="sortField === 'netTotal'" :name="sortDirection === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-primary" />
            </div>
          </template>
          <template #netTotal-cell="{ row }">
            <div class="text-right w-full font-black text-gray-900 dark:text-white font-mono">
              ₹{{ (row.original.netTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
          </template>

          <!-- Actions Column -->
          <template #actions-header>
            <div class="text-center w-full">Actions</div>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-center items-center gap-1">
              <UTooltip text="View Details">
                <UButton 
                  size="xs" 
                  variant="ghost" 
                  color="neutral" 
                  icon="i-heroicons-eye" 
                  class="cursor-pointer"
                  @click="viewBillDetails(row.original._id)" 
                />
              </UTooltip>
              <UTooltip text="View PDF">
                <UButton 
                  size="xs" 
                  variant="ghost" 
                  color="neutral" 
                  icon="i-heroicons-arrow-down-tray" 
                  class="cursor-pointer"
                  @click="downloadPDF(row.original)" 
                />
              </UTooltip>
              <UTooltip v-if="row.original.status === 'ACTIVE' && (row.original.btype === 'SALES' || row.original.btype === 'PURCHASE' || row.original.btype === 'PROFORMA' || row.original.btype === 'DELIVERY_NOTE')" text="Edit Bill">
                <UButton 
                  size="xs" 
                  variant="ghost" 
                  color="primary" 
                  icon="i-heroicons-pencil-square" 
                  class="cursor-pointer"
                  @click="handleEdit(row.original)" 
                />
              </UTooltip>
              <UTooltip v-if="row.original.status === 'ACTIVE' && (row.original.btype === 'SALES' || row.original.btype === 'PURCHASE')" text="Return / Credit Note">
                <UButton 
                  size="xs" 
                  variant="ghost" 
                  color="warning" 
                  icon="i-heroicons-arrow-uturn-left" 
                  class="cursor-pointer"
                  @click="handleReturn(row.original)" 
                />
              </UTooltip>
              <UTooltip v-if="row.original.status === 'ACTIVE'" text="Cancel Bill">
                <UButton 
                  size="xs" 
                  variant="ghost" 
                  color="error" 
                  icon="i-heroicons-x-circle" 
                  class="cursor-pointer"
                  @click="handleCancel(row.original._id)" 
                />
              </UTooltip>
            </div>
          </template>
        </UTable>

        <!-- Summary Totals Bar -->
        <div v-if="filteredBills.length > 0" class="bg-slate-50 dark:bg-zinc-800/80 border-t border-gray-200 dark:border-zinc-700 p-3 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div class="flex items-center gap-2">
            <span class="font-black uppercase tracking-wider text-[10px] text-gray-500 dark:text-zinc-400">Total Filtered:</span>
            <span class="font-bold text-gray-900 dark:text-white">{{ summaryTotals.count }} Records</span>
          </div>

          <div class="flex flex-wrap items-center gap-4 sm:gap-6 font-mono">
            <div v-if="visibleCols.grossTotal" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-gray-400 dark:text-zinc-500">Taxable</span>
              <span class="font-bold text-gray-800 dark:text-zinc-200">₹{{ summaryTotals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="visibleCols.cgst" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-gray-400 dark:text-zinc-500">CGST</span>
              <span class="font-bold text-gray-800 dark:text-zinc-200">₹{{ summaryTotals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="visibleCols.sgst" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-gray-400 dark:text-zinc-500">SGST</span>
              <span class="font-bold text-gray-800 dark:text-zinc-200">₹{{ summaryTotals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="visibleCols.igst" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-gray-400 dark:text-zinc-500">IGST</span>
              <span class="font-bold text-gray-800 dark:text-zinc-200">₹{{ summaryTotals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="visibleCols.totalTax" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400">Total Tax</span>
              <span class="font-bold text-amber-600 dark:text-amber-400">₹{{ summaryTotals.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>

            <div v-if="visibleCols.roundOff" class="flex flex-col items-end">
              <span class="text-[9px] uppercase font-bold text-gray-400 dark:text-zinc-500">Round Off</span>
              <span class="font-bold text-gray-800 dark:text-zinc-200">{{ summaryTotals.roundOff >= 0 ? '+' : '' }}{{ summaryTotals.roundOff.toFixed(2) }}</span>
            </div>

            <div v-if="visibleCols.netTotal" class="flex flex-col items-end pl-2 border-l border-gray-300 dark:border-zinc-600">
              <span class="text-[9px] uppercase font-black text-primary">Net Total</span>
              <span class="font-black text-sm text-primary">₹{{ summaryTotals.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
          </div>
        </div>

        <!-- Client-Side Pagination Bar -->
        <div v-if="filteredBills.length > 0" class="bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 p-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div class="text-gray-500 dark:text-zinc-400 font-medium">
            Showing <span class="font-bold text-gray-900 dark:text-white">{{ filteredBills.length === 0 ? 0 : (currentPage - 1) * pageSize + 1 }}</span>
            to <span class="font-bold text-gray-900 dark:text-white">{{ Math.min(currentPage * pageSize, filteredBills.length) }}</span>
            of <span class="font-bold text-gray-900 dark:text-white">{{ filteredBills.length }}</span> bills
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
import { ref, reactive, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useBilling } from '@/composables/useBilling';
import { api } from '@/utils/api';
import BillDetailsModal from '@/components/accounting/BillDetailsModal.vue';

const router = useRouter();
const { bills, fetchBills, loading } = useBilling();

const selectedBillId = ref<string | null>(null);
const showDetailsModal = ref(false);
const showColumnMenu = ref(false);

const searchInput = ref<any>(null);
const activeRowIndex = ref(0);

// Sorting state
const sortField = ref<'bdate' | 'bno' | 'partyName' | 'status' | 'grossTotal' | 'cgst' | 'sgst' | 'igst' | 'totalTax' | 'netTotal'>('bdate');
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
  status: true,
  grossTotal: true,
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
    visibleCols.status = true;
    visibleCols.grossTotal = true;
    visibleCols.cgst = true;
    visibleCols.sgst = true;
    visibleCols.igst = true;
    visibleCols.totalTax = true;
    visibleCols.roundOff = true;
    visibleCols.netTotal = true;
  } else if (preset === 'compact') {
    visibleCols.status = true;
    visibleCols.grossTotal = false;
    visibleCols.cgst = false;
    visibleCols.sgst = false;
    visibleCols.igst = false;
    visibleCols.totalTax = false;
    visibleCols.roundOff = false;
    visibleCols.netTotal = true;
  } else {
    visibleCols.status = true;
    visibleCols.grossTotal = true;
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
    localStorage.setItem('accounting_bills_columns_v2', JSON.stringify(visibleCols));
  } catch {}
}

function loadColumnPrefs() {
  try {
    const saved = localStorage.getItem('accounting_bills_columns_v2');
    if (saved) {
      Object.assign(visibleCols, JSON.parse(saved));
    }
  } catch {}
}

const columns = computed(() => {
  const cols: any[] = [
    { accessorKey: 'bno', header: 'Bill Info' },
    { accessorKey: 'partyName', header: 'Party Name' },
  ];

  if (visibleCols.status) {
    cols.push({ accessorKey: 'status', header: 'Status' });
  }
  if (visibleCols.grossTotal) {
    cols.push({ accessorKey: 'grossTotal', header: 'Taxable' });
  }
  if (visibleCols.cgst) {
    cols.push({ accessorKey: 'cgst', header: 'CGST' });
  }
  if (visibleCols.sgst) {
    cols.push({ accessorKey: 'sgst', header: 'SGST' });
  }
  if (visibleCols.igst) {
    cols.push({ accessorKey: 'igst', header: 'IGST' });
  }
  if (visibleCols.totalTax) {
    cols.push({ accessorKey: 'totalTax', header: 'Total Tax' });
  }
  if (visibleCols.roundOff) {
    cols.push({ accessorKey: 'roundOff', header: 'Round Off' });
  }
  if (visibleCols.netTotal) {
    cols.push({ accessorKey: 'netTotal', header: 'Net Amount' });
  }

  cols.push({ id: 'actions', header: 'Actions' });
  return cols;
});

const typeOptions = [
  { label: 'All Transactions', value: 'ALL' },
  { label: 'Sales Invoices', value: 'SALES' },
  { label: 'Proforma Invoices', value: 'PROFORMA' },
  { label: 'Delivery Challans', value: 'DELIVERY_NOTE' },
  { label: 'Purchase Bills', value: 'PURCHASE' },
  { label: 'Credit Notes (Returns)', value: 'CREDIT_NOTE' },
  { label: 'Debit Notes (Returns)', value: 'DEBIT_NOTE' }
];

function viewBillDetails(id: string) {
  selectedBillId.value = id;
  showDetailsModal.value = true;
}

const filters = reactive({
  btype: 'ALL'
});
const partySearch = ref('');

const filteredBills = computed(() => {
  let list = bills.value;
  if (partySearch.value) {
    const q = partySearch.value.toLowerCase().trim();
    list = list.filter(b => 
      (b.partyName && b.partyName.toLowerCase().includes(q)) ||
      (b.bno && b.bno.toLowerCase().includes(q)) ||
      (b.partyGstin && b.partyGstin.toLowerCase().includes(q)) ||
      (b.supplierBillNo && b.supplierBillNo.toLowerCase().includes(q))
    );
  }

  return [...list].sort((a: any, b: any) => {
    let aVal = a[sortField.value];
    let bVal = b[sortField.value];

    if (sortField.value === 'totalTax') {
      aVal = (Number(a.cgst) || 0) + (Number(a.sgst) || 0) + (Number(a.igst) || 0);
      bVal = (Number(b.cgst) || 0) + (Number(b.sgst) || 0) + (Number(b.igst) || 0);
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

// Reset page on search or filter change
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
  return (Number(bill.cgst) || 0) + (Number(bill.sgst) || 0) + (Number(bill.igst) || 0);
}

function handleFilterChange() {
  const params: any = {};
  if (filters.btype && filters.btype !== 'ALL') {
    params.btype = filters.btype;
  }
  fetchBills(params);
}

function getTableRows(): NodeListOf<HTMLElement> | null {
  const table = document.querySelector('table');
  if (!table) return null;
  return table.querySelectorAll('tbody tr');
}

function highlightActiveRow() {
  const rows = getTableRows();
  if (!rows) return;
  rows.forEach((row) => {
    row.classList.remove('kb-active-row');
  });
  const activeRow = rows[activeRowIndex.value] as HTMLElement;
  if (activeRow) {
    activeRow.classList.add('kb-active-row');
  }
}

function moveActiveRow(direction: number) {
  const len = filteredBills.value.length;
  if (len === 0) return;
  activeRowIndex.value = (activeRowIndex.value + direction + len) % len;
  nextTick(() => {
    highlightActiveRow();
    scrollToActiveRow();
  });
}

function scrollToActiveRow() {
  const rows = getTableRows();
  if (!rows) return;
  const activeRow = rows[activeRowIndex.value] as HTMLElement;
  if (!activeRow) return;
  activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function selectActiveRow() {
  const activeBill = filteredBills.value[activeRowIndex.value];
  if (activeBill) {
    viewBillDetails(activeBill._id);
  }
}

watch(filteredBills, () => {
  activeRowIndex.value = 0;
  nextTick(() => {
    highlightActiveRow();
  });
});

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showColumnMenu.value) {
    showColumnMenu.value = false;
  }
}

onMounted(() => {
  loadColumnPrefs();
  handleFilterChange();
  window.addEventListener('keydown', handleKeyDown);
  setTimeout(() => {
    const inputEl = searchInput.value?.$el?.querySelector('input') || searchInput.value;
    inputEl?.focus();
    nextTick(() => highlightActiveRow());
  }, 100);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

watch(bills, () => {
  nextTick(() => highlightActiveRow());
});

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTypeColor(type: string) {
  const map: any = {
    'SALES': 'text-blue-600 dark:text-blue-400',
    'PROFORMA': 'text-teal-600 dark:text-teal-400',
    'DELIVERY_NOTE': 'text-amber-600 dark:text-amber-400',
    'PURCHASE': 'text-green-600 dark:text-green-400',
    'CREDIT_NOTE': 'text-purple-600 dark:text-purple-400',
    'DEBIT_NOTE': 'text-orange-600 dark:text-orange-400'
  };
  return map[type] || 'text-gray-600 dark:text-gray-400';
}

function handleEdit(bill: any) {
  const btypeUpper = String(bill.btype).toUpperCase();
  const path = ['SALES', 'PROFORMA', 'DELIVERY_NOTE'].includes(btypeUpper) 
    ? `/accounting/sales/${bill._id}/edit` 
    : `/accounting/purchases/${bill._id}/edit`;
  router.push(path);
}

function handleReturn(bill: any) {
  const path = bill.btype === 'SALES' ? '/accounting/sales/new' : '/accounting/purchases/new';
  router.push({ path, query: { returnFrom: bill._id } });
}

async function handleCancel(id: string) {
  if (!confirm('Are you sure you want to cancel this bill? This will reverse all stock and ledger effects.')) return;
  try {
    await api.post(`/accounting/bills/${id}/cancel`, { reason: 'User requested cancellation' });
    handleFilterChange();
  } catch (err) {
    alert('Cancellation failed');
  }
}

async function downloadPDF(bill: any) {
  try {
    const res = await api.get(`/accounting/bills/${bill._id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${bill.bno || bill._id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('PDF download failed.');
  }
}

async function exportPDF() {
  try {
    const params: any = {};
    if (filters.btype && filters.btype !== 'ALL') params.btype = filters.btype;
    if (partySearch.value) params.search = partySearch.value;
    params.sortOrder = sortDirection.value;

    const queryStr = new URLSearchParams(params).toString();
    const url = `/accounting/bills/export/pdf${queryStr ? '?' + queryStr : ''}`;
    await (api as any).download(url, `Bills_Register_Report.pdf`);
  } catch (err) {
    alert('PDF export failed.');
  }
}

async function exportExcel() {
  try {
    const params: any = {};
    if (filters.btype && filters.btype !== 'ALL') params.btype = filters.btype;
    if (partySearch.value) params.search = partySearch.value;
    params.sortOrder = sortDirection.value;

    const queryStr = new URLSearchParams(params).toString();
    const url = `/accounting/bills/export${queryStr ? '?' + queryStr : ''}`;
    await (api as any).download(url, `Bills_Register.xlsx`);
  } catch (err) {
    alert('Excel export failed.');
  }
}
</script>

<style scoped>
:deep(tbody tr.kb-active-row) {
  background-color: rgba(220, 252, 231, 0.8) !important;
}
.dark :deep(tbody tr.kb-active-row) {
  background-color: rgba(20, 83, 45, 0.4) !important;
}
:deep(tbody tr.kb-active-row td:first-child) {
  border-left: 4px solid #22c55e !important;
}
</style>
