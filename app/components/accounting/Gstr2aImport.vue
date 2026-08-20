<template>
  <div class="space-y-4">
    <!-- 1. Top Configuration & File Upload Bar -->
    <div class="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 space-y-4">
      <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
              <UIcon name="i-heroicons-arrow-down-tray" class="w-5 h-5" />
            </span>
            <h2 class="text-base font-black tracking-tight uppercase text-gray-900 dark:text-white">
              GSTR-2A Inward Supplies CSV Import
            </h2>
          </div>
          <p class="text-xs text-gray-500 dark:text-zinc-400">
            Upload official GSTR-2A CSV to automatically resolve supplier party details, detect duplicate bills, and post accounting purchase vouchers.
          </p>
        </div>

        <!-- Controls: Target Firm GSTIN & Purchase Ledger -->
        <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <!-- Target Firm GSTIN Selector -->
          <div class="w-64 flex flex-col gap-1">
            <label class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-1 flex items-center justify-between">
              <span>Target Firm GSTIN</span>
              <span v-if="firmGstins.length > 1" class="text-[9px] text-primary-500 font-bold lowercase">({{ firmGstins.length }} branches)</span>
            </label>
            <USelect
              v-model="selectedFirmGstin"
              :items="firmGstins.map(g => ({ label: g.label, value: g.gst_number }))"
              placeholder="Select Branch GSTIN"
              class="w-full"
              size="sm"
            />
          </div>

          <!-- Purchase Account Selector -->
          <div class="w-60 flex flex-col gap-1">
            <label class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-1">
              Purchase Expense Account
            </label>
            <AccountSelectMenu
              v-model="selectedPurchaseAccountId"
              :accounts="accountsList"
              :filter-types="['EXPENSE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE']"
              :match-by-id="true"
              placeholder="Select Purchase Account"
              @change="onPurchaseAccountChange"
              @accountCreated="onAccountCreated"
            />
          </div>

          <!-- Reset / Clear File -->
          <UButton
            v-if="analyzedInvoices.length > 0"
            color="neutral"
            variant="outline"
            icon="i-heroicons-arrow-path"
            size="sm"
            label="Upload New File"
            class="h-8 text-xs font-bold mt-4"
            @click="resetImport"
          />
        </div>
      </div>

      <!-- POS Heuristic Mismatch Advisory Alert -->
      <div
        v-if="posMismatchWarning"
        class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-300 text-xs"
      >
        <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div class="space-y-0.5 flex-1">
          <p class="font-bold">Place of Supply (POS) Mismatch Advisory</p>
          <p class="text-[11px] leading-relaxed">
            The uploaded CSV contains inward supplies primarily for Place of Supply <strong class="font-black">{{ summaryStats.primaryPos }}</strong>, but your selected Firm GSTIN is <strong class="font-mono font-bold">{{ selectedFirmGstin }}</strong> ({{ selectedGstinObj?.state || 'Different State' }}). Please verify you have selected the correct branch GSTIN before posting.
          </p>
        </div>
      </div>

      <!-- Drag & Drop CSV Dropzone (Visible when no file analyzed) -->
      <div
        v-if="!analyzedInvoices.length"
        class="border-2 border-dashed border-gray-200 dark:border-zinc-700 hover:border-primary-500 dark:hover:border-primary-500 rounded-2xl p-8 text-center transition-all bg-gray-50/50 dark:bg-zinc-850/50 cursor-pointer group"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleFileDrop"
        @click="triggerFileInput"
      >
        <input
          ref="fileInputRef"
          type="file"
          accept=".csv"
          class="hidden"
          @change="handleFileSelect"
        />
        <div class="max-w-md mx-auto space-y-3">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform">
            <UIcon name="i-heroicons-document-arrow-up" class="w-6 h-6" />
          </div>
          <div>
            <p class="text-sm font-bold text-gray-800 dark:text-zinc-200">
              {{ isDragging ? 'Drop GSTR-2A CSV File Here' : 'Click to Upload or Drag & Drop GSTR-2A CSV' }}
            </p>
            <p class="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              Supports official GST portal CSV exports (<span class="font-mono">MyReport_Taxable_inward_supplies...csv</span>)
            </p>
          </div>
          <div v-if="analyzing" class="flex items-center justify-center gap-2 text-xs font-bold text-primary-600 dark:text-primary-400">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <span>Analyzing GSTR-2A and resolving vendor GSTINs...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Analyzed Content View -->
    <template v-if="analyzedInvoices.length > 0">
      <!-- KPI Ticker Summary Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4 border-l-blue-500">
          <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Total Invoices</p>
          <p class="text-lg font-black font-mono text-gray-900 dark:text-white mt-0.5">{{ summaryStats.totalInvoices }}</p>
          <p class="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
            {{ summaryStats.uniqueParties }} Vendors <span v-if="summaryStats.creditNotesCount > 0" class="text-purple-600">({{ summaryStats.creditNotesCount }} CR)</span>
          </p>
        </div>

        <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4 border-l-indigo-500">
          <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Total Taxable Value</p>
          <p class="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{{ formatCurrency(summaryStats.totalTaxable) }}</p>
          <p class="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Base Amount</p>
        </div>

        <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4 border-l-purple-500">
          <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Total GST + Cess</p>
          <p class="text-lg font-black font-mono text-purple-600 dark:text-purple-400 mt-0.5">{{ formatCurrency(summaryStats.totalTax) }}</p>
          <p class="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
            {{ summaryStats.totalCess > 0 ? `Incl. Cess ${formatCurrency(summaryStats.totalCess)}` : 'CGST + SGST + IGST' }}
          </p>
        </div>

        <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4 border-l-emerald-500">
          <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Ready to Post</p>
          <p class="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{{ summaryStats.newBillsCount }}</p>
          <p class="text-[9px] font-bold text-emerald-500 uppercase mt-0.5">{{ selectedInvoicesCount }} Selected</p>
        </div>

        <div
          class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4"
          :class="summaryStats.itcRiskCount > 0 ? 'border-l-rose-500 bg-rose-50/20' : 'border-l-amber-500'"
        >
          <p class="text-[9px] font-black uppercase tracking-widest" :class="summaryStats.itcRiskCount > 0 ? 'text-rose-500' : 'text-gray-400 dark:text-zinc-500'">
            {{ summaryStats.itcRiskCount > 0 ? '⚠️ Rule 37A Risk' : 'Already in DB' }}
          </p>
          <p class="text-lg font-black font-mono mt-0.5" :class="summaryStats.itcRiskCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'">
            {{ summaryStats.itcRiskCount > 0 ? summaryStats.itcRiskCount : summaryStats.existingBillsCount }}
          </p>
          <p class="text-[9px] font-bold uppercase mt-0.5" :class="summaryStats.itcRiskCount > 0 ? 'text-rose-500' : 'text-amber-500'">
            {{ summaryStats.itcRiskCount > 0 ? '3B Unfiled by Vendor' : 'Duplicate Skipped' }}
          </p>
        </div>

        <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4 border-l-cyan-500">
          <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">New Parties</p>
          <p class="text-lg font-black font-mono text-cyan-600 dark:text-cyan-400 mt-0.5">{{ summaryStats.newPartiesCount }}</p>
          <p class="text-[9px] font-bold text-cyan-500 uppercase mt-0.5">Auto-Register in Master</p>
        </div>
      </div>

      <!-- Filter Toolbar & Selection Header -->
      <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-wrap gap-3 items-center justify-between">
        <!-- Filter Tabs -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            :class="activeFilter === 'all' ? 'bg-primary-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'"
            @click="activeFilter = 'all'"
          >
            All ({{ analyzedInvoices.length }})
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            :class="activeFilter === 'ready' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'"
            @click="activeFilter = 'ready'"
          >
            Ready to Post ({{ summaryStats.newBillsCount }})
          </button>
          <button
            v-if="summaryStats.itcRiskCount > 0"
            type="button"
            class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            :class="activeFilter === 'itc_risk' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-200'"
            @click="activeFilter = 'itc_risk'"
          >
            <UIcon name="i-heroicons-exclamation-triangle" class="w-3.5 h-3.5" />
            <span>ITC at Risk ({{ summaryStats.itcRiskCount }})</span>
          </button>
          <button
            v-if="summaryStats.creditNotesCount > 0"
            type="button"
            class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            :class="activeFilter === 'credit_notes' ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200'"
            @click="activeFilter = 'credit_notes'"
          >
            <span>Credit Notes ({{ summaryStats.creditNotesCount }})</span>
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            :class="activeFilter === 'existing' ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'"
            @click="activeFilter = 'existing'"
          >
            Already Exists ({{ summaryStats.existingBillsCount }})
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            :class="activeFilter === 'new_parties' ? 'bg-cyan-500 text-white shadow-sm' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'"
            @click="activeFilter = 'new_parties'"
          >
            New Parties ({{ summaryStats.newPartiesCount }})
          </button>
        </div>

        <!-- Search & Batch Action -->
        <div class="flex items-center gap-3 flex-1 justify-end min-w-[280px]">
          <div class="w-64">
            <UInput
              v-model="searchQuery"
              placeholder="Search vendor, GSTIN, invoice #..."
              icon="i-heroicons-magnifying-glass"
              size="sm"
              class="w-full"
            />
          </div>

          <UButton
            color="primary"
            icon="i-heroicons-check-circle"
            size="sm"
            :label="`Post Selected (${selectedInvoicesCount})`"
            class="font-black text-xs h-8 cursor-pointer shrink-0"
            :disabled="selectedInvoicesCount === 0 || posting"
            :loading="posting"
            @click="showConfirmModal = true"
          />
        </div>
      </div>

      <!-- 3. Invoices Review Table -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
        <div class="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-gray-50/80 dark:bg-zinc-850/80 sticky top-0 z-10 backdrop-blur border-b border-gray-200 dark:border-zinc-800">
              <tr>
                <th class="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    :checked="isAllVisibleSelected"
                    :indeterminate="isSomeVisibleSelected"
                    class="rounded text-primary-600 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 cursor-pointer"
                    @change="toggleSelectAllVisible"
                  />
                </th>
                <th class="p-3 font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">Status</th>
                <th class="p-3 font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">Supplier & GSTIN</th>
                <th class="p-3 font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">Doc Details</th>
                <th class="p-3 font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] text-right">Taxable</th>
                <th class="p-3 font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] text-right">Tax Breakup</th>
                <th class="p-3 font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] text-right">Doc Value</th>
                <th class="p-3 font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] text-center w-12">Items</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-zinc-800 font-medium text-gray-700 dark:text-zinc-300">
              <template v-for="(inv, idx) in filteredInvoices" :key="`${inv.gstin}_${inv.invoiceNo}_${idx}`">
                <tr
                  class="hover:bg-gray-50/60 dark:hover:bg-zinc-850/60 transition-colors"
                  :class="{
                    'bg-emerald-50/20 dark:bg-emerald-950/10': inv.selected && inv.billStatus === 'NEW_BILL',
                    'opacity-60 bg-amber-50/10 dark:bg-amber-950/5': inv.billStatus === 'ALREADY_EXISTS',
                    'border-l-4 border-l-rose-500': inv.itcRisk
                  }"
                >
                  <!-- Checkbox -->
                  <td class="p-3 text-center">
                    <input
                      v-model="inv.selected"
                      type="checkbox"
                      :disabled="inv.billStatus === 'ALREADY_EXISTS'"
                      class="rounded text-primary-600 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </td>

                  <!-- Status Badges -->
                  <td class="p-3 whitespace-nowrap">
                    <div class="flex flex-col gap-1">
                      <span
                        v-if="inv.billStatus === 'NEW_BILL'"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 w-fit"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Ready to Post
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 w-fit"
                        :title="`Already posted: ${inv.existingBillNo || 'Existing'}`"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Exists ({{ inv.existingBillNo || 'In DB' }})
                      </span>

                      <!-- ITC Risk Badge -->
                      <span
                        v-if="inv.itcRisk"
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 w-fit"
                        title="Supplier has not filed GSTR-3B. High risk of ITC clawback under GST Rule 37A."
                      >
                        ⚠️ 3B Unfiled
                      </span>

                      <!-- Party Status -->
                      <span
                        v-if="inv.partyStatus === 'NEW_PARTY'"
                        class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 w-fit"
                      >
                        + New Party
                      </span>
                      <span
                        v-else-if="inv.isNewLocation"
                        class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 w-fit"
                      >
                        + New Branch Location
                      </span>
                    </div>
                  </td>

                  <!-- Supplier Info -->
                  <td class="p-3">
                    <div class="font-bold text-gray-900 dark:text-white leading-tight">
                      {{ inv.partyName || 'Unknown Vendor' }}
                    </div>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="font-mono text-[11px] text-gray-500 dark:text-zinc-400 font-semibold">{{ inv.gstin }}</span>
                      <span class="text-[9px] px-1 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 uppercase">{{ inv.partyState || 'State ' + inv.supplierStateCode }}</span>
                      <button
                        v-if="inv.partyName?.startsWith('Vendor (')"
                        type="button"
                        class="text-[9px] font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                        :disabled="resolvingGstins.has(inv.gstin)"
                        @click="resolveSingleGstin(inv.gstin)"
                      >
                        <UIcon :name="resolvingGstins.has(inv.gstin) ? 'i-heroicons-arrow-path' : 'i-heroicons-sparkles'" :class="{ 'animate-spin': resolvingGstins.has(inv.gstin) }" class="w-3 h-3" />
                        <span>{{ resolvingGstins.has(inv.gstin) ? 'Fetching...' : 'Resolve Name' }}</span>
                      </button>
                    </div>
                  </td>

                  <!-- Document Details -->
                  <td class="p-3">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider"
                        :class="inv.docType === 'CREDIT_NOTE' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'"
                      >
                        {{ inv.docType === 'CREDIT_NOTE' ? 'CR Note' : 'Invoice' }}
                      </span>
                      <span class="font-mono font-bold text-gray-900 dark:text-white">{{ inv.invoiceNo }}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                      <span>{{ inv.invoiceDate }}</span>
                      <span v-if="inv.reverseCharge" class="px-1 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-600 font-bold">RCM</span>
                      <span v-if="inv.source === 'E-Invoice'" class="px-1 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 font-bold">e-Inv</span>
                    </div>
                  </td>

                  <!-- Taxable Value -->
                  <td class="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                    {{ formatCurrency(inv.grossTotal) }}
                  </td>

                  <!-- Tax Split -->
                  <td class="p-3 text-right">
                    <div class="font-mono text-[11px] font-bold text-purple-600 dark:text-purple-400">
                      {{ formatCurrency(inv.cgst + inv.sgst + inv.igst + (inv.cess || 0)) }}
                    </div>
                    <div class="text-[9px] text-gray-400 font-mono flex flex-wrap items-center justify-end gap-1 mt-0.5">
                      <span v-if="inv.igst > 0">IGST: {{ formatCurrency(inv.igst) }}</span>
                      <template v-else>
                        <span>C: {{ formatCurrency(inv.cgst) }}</span>
                        <span>S: {{ formatCurrency(inv.sgst) }}</span>
                      </template>
                      <span v-if="inv.cess > 0" class="text-amber-600">Cess: {{ formatCurrency(inv.cess) }}</span>
                    </div>
                  </td>

                  <!-- Total Invoice Value -->
                  <td class="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                    {{ formatCurrency(inv.netTotal) }}
                    <div v-if="Math.abs(inv.roundOff) > 0" class="text-[9px] text-gray-400 font-normal">
                      R/O: {{ inv.roundOff > 0 ? '+' : '' }}{{ inv.roundOff }}
                    </div>
                  </td>

                  <!-- Expand multi-rate breakdown button -->
                  <td class="p-3 text-center">
                    <button
                      type="button"
                      class="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      :title="expandedRows.has(idx) ? 'Collapse Breakdown' : 'Expand Rate Breakdown'"
                      @click="toggleRowExpand(idx)"
                    >
                      <UIcon
                        :name="expandedRows.has(idx) ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                        class="w-4 h-4"
                      />
                    </button>
                  </td>
                </tr>

                <!-- Expanded Breakdown Row -->
                <tr v-if="expandedRows.has(idx)" class="bg-gray-50/90 dark:bg-zinc-850/90 border-b border-gray-200 dark:border-zinc-800">
                  <td colspan="8" class="p-4 space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div>
                        <span class="font-bold text-gray-700 dark:text-zinc-300">Rate Breakdown & Filing Compliance:</span>
                        <span class="text-gray-400 ml-2">Doc: {{ inv.invoiceNo }} ({{ inv.items.length }} rate slabs)</span>
                      </div>
                      <div class="flex items-center gap-3 text-[11px]">
                        <span>Place of Supply: <strong class="text-gray-700 dark:text-zinc-200">{{ inv.placeOfSupply || 'N/A' }}</strong></span>
                        <span>GSTR-1: <strong :class="inv.gstr1FilingStatus === 'Y' ? 'text-emerald-500' : 'text-rose-500'">{{ inv.gstr1FilingStatus || 'N/A' }}</strong></span>
                        <span>GSTR-3B: <strong :class="inv.gstr3bFilingStatus === 'Y' ? 'text-emerald-500' : 'text-rose-500'">{{ inv.gstr3bFilingStatus || 'N/A' }}</strong></span>
                      </div>
                    </div>

                    <!-- Line Items Table -->
                    <table class="w-full text-xs font-mono bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800">
                      <thead class="bg-gray-100 dark:bg-zinc-800 text-[10px] text-gray-500 uppercase">
                        <tr>
                          <th class="p-2 text-left">GST Rate (%)</th>
                          <th class="p-2 text-right">Taxable Value</th>
                          <th class="p-2 text-right">CGST</th>
                          <th class="p-2 text-right">SGST</th>
                          <th class="p-2 text-right">IGST</th>
                          <th class="p-2 text-right">Cess</th>
                          <th class="p-2 text-right">Total Line Tax</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100 dark:divide-zinc-800">
                        <tr v-for="(item, itemIdx) in inv.items" :key="itemIdx">
                          <td class="p-2 font-bold">{{ item.rate }}%</td>
                          <td class="p-2 text-right">{{ formatCurrency(item.taxableValue) }}</td>
                          <td class="p-2 text-right text-gray-500">{{ formatCurrency(item.cgst) }}</td>
                          <td class="p-2 text-right text-gray-500">{{ formatCurrency(item.sgst) }}</td>
                          <td class="p-2 text-right text-gray-500">{{ formatCurrency(item.igst) }}</td>
                          <td class="p-2 text-right text-gray-500">{{ formatCurrency(item.cess || 0) }}</td>
                          <td class="p-2 text-right font-bold text-purple-600">{{ formatCurrency((item.cgst || 0) + (item.sgst || 0) + (item.igst || 0) + (item.cess || 0)) }}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div v-if="inv.irn" class="text-[10px] font-mono text-gray-500 break-all">
                      <span class="font-bold">IRN:</span> {{ inv.irn }} {{ inv.irnDate ? `(${inv.irnDate})` : '' }}
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Confirmation Modal -->
    <UModal v-model:open="showConfirmModal" title="Confirm Purchase Bills & Notes Posting">
      <template #body>
        <div class="space-y-4 py-2 text-xs">
          <p class="text-gray-600 dark:text-zinc-300">
            You are about to post <strong class="text-primary-600 font-black text-sm">{{ selectedInvoicesCount }} accounting documents</strong> into the double-entry accounting ledger.
          </p>

          <!-- Rule 37A ITC Risk Warning Banner inside Confirmation -->
          <div
            v-if="selectedItcRiskCount > 0"
            class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 space-y-1"
          >
            <div class="flex items-center gap-2 font-bold">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-rose-500" />
              <span>GST Rule 37A Compliance Warning</span>
            </div>
            <p class="text-[11px] leading-relaxed">
              <strong>{{ selectedItcRiskCount }}</strong> of your selected invoices have <span class="underline">unfiled GSTR-3B</span> by suppliers. If the vendor fails to deposit tax, you are legally required to reverse this ITC.
            </p>
          </div>

          <div class="bg-gray-50 dark:bg-zinc-850 p-3 rounded-xl space-y-1.5 border border-gray-100 dark:border-zinc-800">
            <div class="flex justify-between">
              <span class="text-gray-500">Target Firm GSTIN / Branch:</span>
              <strong class="font-mono text-gray-900 dark:text-white">{{ selectedFirmGstin }} {{ selectedGstinObj?.state ? `(${selectedGstinObj.state})` : '' }}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Purchase Expense Ledger:</span>
              <strong class="text-gray-900 dark:text-white">{{ selectedPurchaseAccount?.account_name || 'Purchases (Default)' }}</strong>
            </div>
            <div v-if="selectedCreditNotesCount > 0" class="flex justify-between">
              <span class="text-gray-500">Credit Notes Included:</span>
              <strong class="text-purple-600">{{ selectedCreditNotesCount }} Notes (Reverses Payables)</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">New Parties to Register:</span>
              <strong class="text-cyan-600">{{ selectedNewPartiesCount }} Vendors</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Total Taxable Value:</span>
              <strong class="font-mono text-indigo-600">{{ formatCurrency(selectedTaxableTotal) }}</strong>
            </div>
            <div class="flex justify-between border-t border-gray-200 dark:border-zinc-700 pt-1.5">
              <span class="text-gray-700 font-bold">Total Bill Value (Net):</span>
              <strong class="font-mono text-gray-900 dark:text-white font-black">{{ formatCurrency(selectedNetTotal) }}</strong>
            </div>
          </div>

          <p class="text-[11px] text-gray-400">
            * Generates Purchase & Debit Voucher sequences, updates Sundry Creditors ledgers, and guarantees balanced debit/credit entries with zero API costs.
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showConfirmModal = false" />
          <UButton
            color="primary"
            label="Confirm & Post Bills"
            :loading="posting"
            @click="executeBatchPosting"
          />
        </div>
      </template>
    </UModal>

    <!-- Results Modal -->
    <UModal v-model:open="showResultsModal" title="GSTR-2A Batch Posting Report" :ui="{ content: 'w-full sm:max-w-xl' }">
      <template #body>
        <div class="space-y-4 py-2 text-xs">
          <!-- Summary alert -->
          <div
            class="p-3 rounded-xl border flex items-center justify-between"
            :class="postingReport.failureCount === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300' : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'"
          >
            <div>
              <p class="font-bold">Posting Completed</p>
              <p class="text-[11px] mt-0.5">
                {{ postingReport.successCount }} successful, {{ postingReport.failureCount }} failed.
              </p>
            </div>
            <span class="text-xl font-black font-mono">{{ postingReport.successCount }} / {{ postingReport.total }}</span>
          </div>

          <!-- List of created bills -->
          <div class="max-h-60 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
            <div
              v-for="(res, idx) in postingReport.results"
              :key="idx"
              class="p-2 rounded-lg flex items-center justify-between border"
              :class="res.success ? 'bg-gray-50 dark:bg-zinc-800 border-gray-100 dark:border-zinc-700' : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-700 dark:text-rose-300'"
            >
              <div class="truncate max-w-[320px]">
                <span class="font-bold">{{ res.invoiceNo }}</span>
                <span class="text-gray-400 text-[10px] ml-1.5">({{ res.partyName || res.gstin }})</span>
              </div>
              <div>
                <span v-if="res.success" class="text-emerald-600 font-bold">{{ res.billNo }}</span>
                <span v-else class="text-rose-600 font-semibold">{{ res.error }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-between items-center w-full">
          <UButton
            color="primary"
            variant="outline"
            label="View Invoices & Notes"
            size="sm"
            @click="$router.push('/accounting/bills')"
          />
          <UButton color="primary" label="Close" size="sm" @click="showResultsModal = false" />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '~/utils/api';
import AccountSelectMenu from './AccountSelectMenu.vue';

const props = defineProps<{
  initialFirmGstin?: string;
}>();

const api = useApi();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const analyzing = ref(false);
const posting = ref(false);

const firmGstins = ref<Array<{ gst_number: string; label: string; state: string; is_default: boolean }>>([]);
const selectedFirmGstin = ref<string>('');

const accountsList = ref<any[]>([]);
const analyzedInvoices = ref<any[]>([]);
const summaryStats = ref<any>({
  totalInvoices: 0,
  totalTaxable: 0,
  totalTax: 0,
  totalCess: 0,
  newBillsCount: 0,
  existingBillsCount: 0,
  itcRiskCount: 0,
  creditNotesCount: 0,
  newPartiesCount: 0,
  uniqueParties: 0,
  primaryPos: '',
  posBreakdown: {}
});

const activeFilter = ref<'all' | 'ready' | 'existing' | 'new_parties' | 'itc_risk' | 'credit_notes'>('all');
const searchQuery = ref('');
const expandedRows = ref(new Set<number>());

const selectedPurchaseAccountId = ref<string>('');
const selectedPurchaseAccount = ref<any>({
  account_name: 'Purchases',
  account_type: 'EXPENSE'
});

const selectedGstinObj = computed(() => {
  return firmGstins.value.find(g => g.gst_number === selectedFirmGstin.value);
});

// Heuristic check: warn if primary Place of Supply state in CSV does not match selected Firm GSTIN state
const posMismatchWarning = computed(() => {
  if (!summaryStats.value?.primaryPos || !selectedGstinObj.value?.state) return false;
  const primary = summaryStats.value.primaryPos.trim().toLowerCase();
  const firmState = selectedGstinObj.value.state.trim().toLowerCase();
  if (!primary || !firmState) return false;
  return !primary.includes(firmState) && !firmState.includes(primary);
});

const loadFirmGstins = async () => {
  try {
    const res = await api.get('/firms/current');
    if (res.success && res.data) {
      const firm = res.data;
      const locations = firm.locations || [];
      const tempGstins: Array<{ gst_number: string; label: string; state: string; is_default: boolean }> = [];

      if (firm.gst_number) {
        tempGstins.push({
          gst_number: firm.gst_number,
          state: firm.state || '',
          label: `${firm.gst_number} (Principal) - ${firm.state || ''}`,
          is_default: true
        });
      }

      locations.forEach((loc: any) => {
        if (loc.gst_number && !tempGstins.some(g => g.gst_number === loc.gst_number)) {
          tempGstins.push({
            gst_number: loc.gst_number,
            state: loc.state || '',
            label: `${loc.gst_number} (${loc.is_default ? 'Principal' : 'Additional'}) - ${loc.state || ''}`,
            is_default: !!loc.is_default
          });
        }
      });

      firmGstins.value = tempGstins;
      if (props.initialFirmGstin && tempGstins.some(g => g.gst_number === props.initialFirmGstin)) {
        selectedFirmGstin.value = props.initialFirmGstin;
      } else if (tempGstins.length > 0) {
        const defaultLoc = tempGstins.find(g => g.is_default) || tempGstins[0];
        if (defaultLoc?.gst_number) {
          selectedFirmGstin.value = defaultLoc.gst_number;
        }
      }
    }
  } catch (err) {
    console.error('Failed to load firm GST registrations in GSTR-2A import:', err);
  }
};

const loadAccounts = async () => {
  try {
    const res = await api.get('/accounting/coa');
    if (res.success && Array.isArray(res.data)) {
      accountsList.value = res.data;
      const purchaseAcc = res.data.find((a: any) => 
        a.account_name?.toLowerCase() === 'purchases' || 
        a.account_name?.toLowerCase() === 'purchase'
      );
      if (purchaseAcc) {
        selectedPurchaseAccount.value = purchaseAcc;
        selectedPurchaseAccountId.value = purchaseAcc._id;
      }
    }
  } catch (err) {
    console.error('Failed to load chart of accounts in GSTR-2A import:', err);
  }
};

onMounted(async () => {
  await Promise.all([loadFirmGstins(), loadAccounts()]);
});

const onAccountCreated = (newAcc: any) => {
  accountsList.value.push(newAcc);
  selectedPurchaseAccount.value = newAcc;
  selectedPurchaseAccountId.value = newAcc._id;
};

const resolvingGstins = ref(new Set<string>());

const resolveSingleGstin = async (gstin: string) => {
  resolvingGstins.value.add(gstin);
  try {
    const res = await api.get(`/accounting/gst/lookup?gstin=${gstin}&refresh=true`);
    if (res.success && res.data) {
      const d = res.data;
      const resolvedName = d.trade_name || d.tradeName || d.legal_name || d.legalName || d.lgnm || d.bnm;
      if (resolvedName) {
        analyzedInvoices.value.forEach(inv => {
          if (inv.gstin === gstin) {
            inv.partyName = resolvedName;
            if (d.state_jurisdiction || d.state || d.pradr?.addr?.stcd) {
              inv.partyState = d.state_jurisdiction || d.state || inv.partyState;
            }
          }
        });
      }
    }
  } catch (err: any) {
    alert(`Failed to resolve ${gstin}: ${err.message}`);
  } finally {
    resolvingGstins.value.delete(gstin);
  }
};

const showConfirmModal = ref(false);
const showResultsModal = ref(false);
const postingReport = ref<any>({
  total: 0,
  successCount: 0,
  failureCount: 0,
  results: []
});

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    await processCsvFile(target.files[0]);
  }
};

const handleFileDrop = async (e: DragEvent) => {
  isDragging.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    await processCsvFile(e.dataTransfer.files[0]);
  }
};

const processCsvFile = async (file: File) => {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    alert('Please upload a valid .csv file exported from the GST portal.');
    return;
  }

  analyzing.value = true;
  try {
    const text = await file.text();
    const res = await api.post('/accounting/gstr2a/analyze', {
      csvText: text,
      firmGstin: selectedFirmGstin.value || undefined
    });

    if (res.success && res.data) {
      analyzedInvoices.value = res.data.invoices || [];
      const s = res.data.summary;
      summaryStats.value = {
        totalInvoices: s.totalInvoices || 0,
        totalTaxable: s.totalTaxable || 0,
        totalTax: (s.totalCgst || 0) + (s.totalSgst || 0) + (s.totalIgst || 0) + (s.totalCess || 0),
        totalCess: s.totalCess || 0,
        newBillsCount: s.newBillsCount || 0,
        existingBillsCount: s.existingBillsCount || 0,
        itcRiskCount: s.itcRiskCount || 0,
        creditNotesCount: s.creditNotesCount || 0,
        newPartiesCount: s.newPartiesCount || 0,
        uniqueParties: (s.newPartiesCount || 0) + (s.existingPartiesCount || 0),
        primaryPos: s.primaryPos || '',
        posBreakdown: s.posBreakdown || {}
      };
      expandedRows.value.clear();
    } else {
      alert(res.error || 'Failed to analyze GSTR-2A CSV');
    }
  } catch (err: any) {
    alert(err.message || 'Error processing CSV file');
  } finally {
    analyzing.value = false;
  }
};

const onPurchaseAccountChange = (account: any) => {
  selectedPurchaseAccount.value = account;
  selectedPurchaseAccountId.value = account?._id || '';
};

const resetImport = () => {
  analyzedInvoices.value = [];
  searchQuery.value = '';
  expandedRows.value.clear();
  summaryStats.value = {
    totalInvoices: 0,
    totalTaxable: 0,
    totalTax: 0,
    totalCess: 0,
    newBillsCount: 0,
    existingBillsCount: 0,
    itcRiskCount: 0,
    creditNotesCount: 0,
    newPartiesCount: 0,
    uniqueParties: 0,
    primaryPos: '',
    posBreakdown: {}
  };
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const toggleRowExpand = (idx: number) => {
  if (expandedRows.value.has(idx)) {
    expandedRows.value.delete(idx);
  } else {
    expandedRows.value.add(idx);
  }
};

// Filtered invoices according to active tab and search query
const filteredInvoices = computed(() => {
  return analyzedInvoices.value.filter(inv => {
    // Tab Filter
    if (activeFilter.value === 'ready' && inv.billStatus !== 'NEW_BILL') return false;
    if (activeFilter.value === 'existing' && inv.billStatus !== 'ALREADY_EXISTS') return false;
    if (activeFilter.value === 'new_parties' && inv.partyStatus !== 'NEW_PARTY') return false;
    if (activeFilter.value === 'itc_risk' && !inv.itcRisk) return false;
    if (activeFilter.value === 'credit_notes' && inv.docType !== 'CREDIT_NOTE') return false;

    // Search Query
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim();
      const matchName = (inv.partyName || '').toLowerCase().includes(q);
      const matchGst = (inv.gstin || '').toLowerCase().includes(q);
      const matchInv = (inv.invoiceNo || '').toLowerCase().includes(q);
      if (!matchName && !matchGst && !matchInv) return false;
    }

    return true;
  });
});

// Selection computations
const selectedInvoicesCount = computed(() => {
  return analyzedInvoices.value.filter(i => i.selected).length;
});

const selectedItcRiskCount = computed(() => {
  return analyzedInvoices.value.filter(i => i.selected && i.itcRisk).length;
});

const selectedCreditNotesCount = computed(() => {
  return analyzedInvoices.value.filter(i => i.selected && i.docType === 'CREDIT_NOTE').length;
});

const selectedNewPartiesCount = computed(() => {
  const newGstins = new Set<string>();
  analyzedInvoices.value.forEach(i => {
    if (i.selected && i.partyStatus === 'NEW_PARTY') {
      newGstins.add(i.gstin);
    }
  });
  return newGstins.size;
});

const selectedTaxableTotal = computed(() => {
  return analyzedInvoices.value
    .filter(i => i.selected)
    .reduce((acc, i) => acc + (i.grossTotal || 0), 0);
});

const selectedNetTotal = computed(() => {
  return analyzedInvoices.value
    .filter(i => i.selected)
    .reduce((acc, i) => acc + (i.netTotal || 0), 0);
});

const isAllVisibleSelected = computed(() => {
  const selectable = filteredInvoices.value.filter(i => i.billStatus === 'NEW_BILL');
  return selectable.length > 0 && selectable.every(i => i.selected);
});

const isSomeVisibleSelected = computed(() => {
  const selectable = filteredInvoices.value.filter(i => i.billStatus === 'NEW_BILL');
  const selected = selectable.filter(i => i.selected);
  return selected.length > 0 && selected.length < selectable.length;
});

const toggleSelectAllVisible = () => {
  const selectable = filteredInvoices.value.filter(i => i.billStatus === 'NEW_BILL');
  const targetState = !isAllVisibleSelected.value;
  selectable.forEach(i => {
    i.selected = targetState;
  });
};

// Batch Posting Action
const executeBatchPosting = async () => {
  const selected = analyzedInvoices.value.filter(i => i.selected);
  if (!selected.length) return;

  showConfirmModal.value = false;
  posting.value = true;

  try {
    const payload = {
      invoices: selected,
      purchaseLedgerId: selectedPurchaseAccountId.value || undefined,
      purchaseLedgerHead: selectedPurchaseAccount.value?.account_name || 'Purchases',
      firmGstin: selectedFirmGstin.value || undefined
    };

    const res = await api.post('/accounting/gstr2a/post', payload);

    if (res.success && res.data) {
      postingReport.value = {
        total: res.data.summary.total,
        successCount: res.data.summary.successCount,
        failureCount: res.data.summary.failureCount,
        results: res.data.results || []
      };

      // Update in-memory statuses for posted invoices
      const successMap = new Map<string, string>();
      res.data.results.forEach((r: any) => {
        if (r.success) {
          successMap.set(`${r.gstin}_${r.invoiceNo}`, r.billNo);
        }
      });

      analyzedInvoices.value.forEach(inv => {
        const key = `${inv.gstin}_${inv.invoiceNo}`;
        if (successMap.has(key)) {
          inv.billStatus = 'ALREADY_EXISTS';
          inv.existingBillNo = successMap.get(key);
          inv.selected = false;
        }
      });

      // Recalculate summary stats
      const newCount = analyzedInvoices.value.filter(i => i.billStatus === 'NEW_BILL').length;
      const existCount = analyzedInvoices.value.filter(i => i.billStatus === 'ALREADY_EXISTS').length;
      summaryStats.value.newBillsCount = newCount;
      summaryStats.value.existingBillsCount = existCount;

      showResultsModal.value = true;
    } else {
      alert(res.error || 'Failed to post purchase bills');
    }
  } catch (err: any) {
    alert(err.message || 'Error during batch posting');
  } finally {
    posting.value = false;
  }
};

const formatCurrency = (val: number | undefined | null) => {
  if (typeof val !== 'number') return '₹0.00';
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
</script>
