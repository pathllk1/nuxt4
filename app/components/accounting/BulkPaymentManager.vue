<template>
  <div class="space-y-3 pb-8">
    <!-- Top Ultra-Compact Horizontal KPI Ribbon (Replaces 4 bulky cards) -->
    <div class="bg-white dark:bg-zinc-900 p-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
      <!-- 1. Disbursement Source Bank -->
      <div class="flex items-center gap-2.5 min-w-[220px]">
        <div class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-800">
          <UIcon name="i-heroicons-building-library" class="w-4 h-4" />
        </div>
        <div class="min-w-0">
          <div class="font-black text-slate-900 dark:text-white truncate text-[11px] leading-tight">
            {{ selectedBankAccount?.bank_name || 'Select Bank Account' }}
          </div>
          <div class="text-[10px] text-slate-500 font-mono flex items-center gap-2" v-if="selectedBankAccount">
            <span>{{ selectedBankAccount.account_number }}</span>
            <span class="font-bold text-blue-600 dark:text-blue-400">₹{{ Number(selectedBankAccount.balance || 0).toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- 2. Staged Payout Total -->
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-800">
          <UIcon name="i-heroicons-shield-check" class="w-4 h-4" />
        </div>
        <div>
          <div class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Staged Payout Total</div>
          <div class="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight mt-0.5">
            ₹{{ stagedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
          </div>
        </div>
      </div>

      <!-- 3. Staged Beneficiaries -->
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-200/60 dark:border-violet-800">
          <UIcon name="i-heroicons-users" class="w-4 h-4" />
        </div>
        <div>
          <div class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Staged Beneficiaries</div>
          <div class="text-sm font-black text-slate-900 dark:text-white leading-tight mt-0.5">
            {{ stagedRows.length }} <span class="text-[10px] text-slate-400 font-normal">recipients</span>
          </div>
        </div>
      </div>

      <!-- 4. Batch Status Badge -->
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-800">
          <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
        </div>
        <div>
          <div class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider leading-none">Batch Status</div>
          <div class="mt-0.5">
            <span 
              class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider inline-block"
              :class="stagedRows.length > 0 ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'"
            >
              {{ stagedRows.length > 0 ? 'READY TO POST' : 'DRAFTING' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Workspace Container -->
    <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs p-3.5 space-y-3">
      
      <!-- Section 1: Collapsible "1. Source Bank & Cheque Details" -->
      <div class="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/15 transition-all relative z-10">
        <!-- Header Strip with Toggle -->
        <div 
          class="flex items-center justify-between px-3.5 py-2 cursor-pointer select-none hover:bg-blue-50/60 dark:hover:bg-blue-950/30 transition-colors rounded-t-xl"
          @click="isSourceBankCollapsed = !isSourceBankCollapsed"
        >
          <h3 class="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-2">
            <UIcon name="i-heroicons-building-library" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>1. Source Bank & Cheque Details</span>
          </h3>
          
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-blue-600/80 dark:text-blue-400 font-bold hidden sm:inline" v-if="isSourceBankCollapsed && selectedBankAccount">
              {{ selectedBankAccount.bank_name }} (Chq: {{ batchConfig.chequeNo || 'N/A' }} • {{ batchConfig.paymentDate }})
            </span>
            <button type="button" class="text-blue-600 dark:text-blue-400 p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50">
              <UIcon :name="isSourceBankCollapsed ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Inputs Grid -->
        <div v-show="!isSourceBankCollapsed" class="p-3 pt-1 border-t border-blue-100 dark:border-blue-900/40">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <!-- Debit Bank Account -->
            <div class="space-y-1">
              <label class="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Debit Bank Account *</label>
              <select
                v-model="batchConfig.bankAccountId"
                class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="" disabled>-- Select Firm Bank Account --</option>
                <option v-for="bank in bankAccounts" :key="bank._id" :value="bank._id">
                  {{ bank.bank_name }} - {{ bank.account_number }} (₹{{ Number(bank.balance || 0).toLocaleString() }})
                </option>
              </select>
            </div>

            <!-- Cheque / UTR / Batch Ref Number -->
            <div class="space-y-1">
              <label class="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Cheque / Ref Number *</label>
              <input
                type="text"
                v-model="batchConfig.chequeNo"
                placeholder="e.g. 127620"
                class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <!-- Payment Date -->
            <div class="space-y-1">
              <label class="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Payment Date *</label>
              <input
                type="date"
                v-model="batchConfig.paymentDate"
                class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <!-- Default Paysys Mode -->
            <div class="space-y-1">
              <label class="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Default Payout Mode</label>
              <select
                v-model="batchConfig.defaultPaysys"
                class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="NEFT">NEFT (Standard)</option>
                <option value="RTGS">RTGS (High Value >= ₹2L)</option>
                <option value="AUTO">AUTO (RTGS if >= ₹2L, else NEFT)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Compact "2. Beneficiary / Party Payout Entry" (Emerald Panel) -->
      <div 
        class="rounded-xl border transition-all relative z-30"
        :class="editingRowIndex !== null 
          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 ring-1 ring-amber-400' 
          : 'bg-emerald-50/30 dark:bg-emerald-950/15 border-emerald-200/80 dark:border-emerald-900/60'"
      >
        <!-- Section Header Strip -->
        <div class="flex items-center justify-between px-3.5 py-2 border-b rounded-t-xl" :class="editingRowIndex !== null ? 'border-amber-200 dark:border-amber-800/60 bg-amber-100/40 dark:bg-amber-900/30' : 'border-emerald-100 dark:border-emerald-900/40 bg-emerald-100/30 dark:bg-emerald-900/20'">
          <h3 class="text-xs font-black uppercase tracking-wider flex items-center gap-2" :class="editingRowIndex !== null ? 'text-amber-900 dark:text-amber-200' : 'text-emerald-900 dark:text-emerald-200'">
            <UIcon name="i-heroicons-user-plus" class="w-4 h-4" :class="editingRowIndex !== null ? 'text-amber-600 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'" />
            <span>{{ editingRowIndex !== null ? `✏️ Editing Staged Row #${editingRowIndex + 1}` : '2. Beneficiary / Party Payout Entry' }}</span>
          </h3>
          
          <div class="flex items-center gap-2">
            <span v-if="editingRowIndex === null" class="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
              <UIcon name="i-heroicons-bolt" class="w-3 h-3" />
              <span>Auto-fill from Banking Info</span>
            </span>
            <UButton
              v-else
              color="neutral"
              variant="ghost"
              size="xs"
              label="Cancel Edit"
              icon="i-heroicons-x-mark"
              class="font-bold text-[10px] cursor-pointer"
              @click="cancelRowEdit"
            />
          </div>
        </div>

        <!-- Entry Form Body -->
        <div class="p-3 space-y-2.5">
          <!-- Row 1: High-Velocity Primary Inputs -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <!-- Select Party / Ledger -->
            <div class="md:col-span-3 space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Select Party / Ledger *</label>
                <button
                  v-if="quickForm.partyId"
                  type="button"
                  @click="openMasterEditModal"
                  class="text-[9px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                  title="Edit Master Record in Chart of Accounts"
                >
                  <UIcon name="i-heroicons-pencil-square" class="w-3 h-3" />
                  <span>Edit Master</span>
                </button>
              </div>
              <AccountSelectMenu
                v-model="quickForm.accountHead"
                :accounts="coaAccounts"
                placeholder="Search party, labor leader..."
                @change="onBeneficiarySelect"
              />
            </div>

            <!-- Beneficiary Account Number -->
            <div class="md:col-span-2 space-y-1">
              <label class="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider">A/C Number *</label>
              <input
                type="text"
                v-model="quickForm.beneficiaryAccountNo"
                placeholder="A/C Number"
                class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <!-- Beneficiary IFSC -->
            <div class="md:col-span-2 space-y-1">
              <label class="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider">IFSC Code *</label>
              <input
                type="text"
                v-model="quickForm.beneficiaryIfsc"
                placeholder="e.g. SBIN0001171"
                maxlength="11"
                class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-mono font-bold uppercase text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <!-- Bank & Branch -->
            <div class="md:col-span-2 space-y-1">
              <label class="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Bank & Branch</label>
              <input
                type="text"
                v-model="quickForm.beneficiaryBankName"
                placeholder="Bank / Branch"
                class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <!-- Amount (₹) -->
            <div class="md:col-span-2 space-y-1">
              <label class="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Amount (₹) *</label>
              <input
                type="number"
                v-model.number="quickForm.amount"
                step="0.01"
                min="1"
                placeholder="₹ 0.00"
                class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-emerald-400 dark:border-emerald-600 rounded-lg text-xs font-mono font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                @keydown.enter="addOrUpdateQuickRow"
              />
            </div>

            <!-- Add / Update Action Button -->
            <div class="md:col-span-1">
              <button
                type="button"
                :class="editingRowIndex !== null 
                  ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'"
                class="w-full h-8 px-2 rounded-lg font-black text-xs flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                @click="addOrUpdateQuickRow"
              >
                <UIcon :name="editingRowIndex !== null ? 'i-heroicons-check' : 'i-heroicons-plus'" class="w-4 h-4" />
                <span>{{ editingRowIndex !== null ? 'Update' : 'Add' }}</span>
              </button>
            </div>
          </div>

          <!-- Row 2: Secondary Narration, Branch & Save to Master -->
          <div class="flex flex-wrap md:flex-nowrap items-center gap-2 pt-0.5">
            <div class="flex-1 min-w-[200px]">
              <input
                type="text"
                v-model="quickForm.narration"
                placeholder="Line Narration / Specific Remark (Optional)"
                class="w-full px-2.5 py-1 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-800 dark:text-zinc-100 outline-none"
                @keydown.enter="addOrUpdateQuickRow"
              />
            </div>
            <div class="w-full md:w-56">
              <input
                type="text"
                v-model="quickForm.beneficiaryBranch"
                placeholder="Branch Name / City (Optional, e.g. RANGIYA)"
                class="w-full px-2.5 py-1 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-800 dark:text-zinc-100 outline-none"
              />
            </div>
            <div class="shrink-0">
              <label class="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-zinc-400 cursor-pointer select-none px-2.5 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg hover:border-blue-400 transition-colors shadow-2xs">
                <input
                  type="checkbox"
                  v-model="saveToMaster"
                  class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span class="whitespace-nowrap">💾 Save to Master</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: High-Density Staging Grid (Violet Panel) -->
      <div class="rounded-xl border border-violet-200/80 dark:border-violet-900/60 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <!-- Grid Header Strip -->
        <div class="flex flex-wrap items-center justify-between px-3.5 py-2 bg-violet-50/40 dark:bg-violet-950/20 border-b border-violet-100 dark:border-violet-900/40 gap-2">
          <h3 class="text-xs font-black uppercase tracking-wider text-violet-900 dark:text-violet-200 flex items-center gap-2">
            <UIcon name="i-heroicons-queue-list" class="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <span>3. Staged Payout List ({{ stagedRows.length }} Entries)</span>
          </h3>

          <div class="flex items-center gap-2">
            <!-- Search staged items -->
            <div class="relative" v-if="stagedRows.length > 0">
              <input
                type="text"
                v-model="stagingSearch"
                placeholder="Search payouts..."
                class="px-2.5 py-1 pl-7 text-xs bg-white dark:bg-zinc-800 border border-violet-200 dark:border-violet-800 rounded-lg outline-none w-44 font-medium"
              />
              <UIcon name="i-heroicons-magnifying-glass" class="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            <!-- Clear All -->
            <UButton
              v-if="stagedRows.length > 0"
              color="error"
              variant="ghost"
              size="xs"
              icon="i-heroicons-trash"
              label="Clear All"
              class="cursor-pointer font-bold text-[10px]"
              @click="clearAllStaged"
            />
          </div>
        </div>

        <!-- Staging Table -->
        <div class="overflow-x-auto max-h-[360px] custom-scrollbar">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-50 dark:bg-zinc-850 sticky top-0 z-10 text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th class="px-3 py-2 w-10 text-center">#</th>
                <th class="px-3 py-2">Beneficiary / Party Name</th>
                <th class="px-3 py-2">Bank & Branch</th>
                <th class="px-3 py-2 font-mono">Account Number</th>
                <th class="px-3 py-2 font-mono">IFSC Code</th>
                <th class="px-3 py-2 w-20 text-center">Paysys</th>
                <th class="px-3 py-2 text-right font-mono">Amount (₹)</th>
                <th class="px-3 py-2">Narration / Ref</th>
                <th class="px-3 py-2 text-center w-16">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-900">
              <!-- Empty State Matching Mockup -->
              <tr v-if="filteredStagedRows.length === 0">
                <td colspan="9" class="py-12 text-center text-slate-400 dark:text-zinc-500">
                  <div class="flex flex-col items-center justify-center gap-1.5">
                    <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-500 border border-blue-200/50">
                      <UIcon name="i-heroicons-document-text" class="w-5 h-5" />
                    </div>
                    <p class="text-xs font-black text-slate-700 dark:text-zinc-300 mt-1">No payout entries staged yet</p>
                    <p class="text-[10px] text-slate-400">Select a party or add beneficiary details above to create payout entries.</p>
                  </div>
                </td>
              </tr>

              <!-- Staged Rows -->
              <tr v-for="(row, idx) in filteredStagedRows" :key="idx" class="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                <td class="px-3 py-2 text-center text-slate-400 font-bold text-[10px]">{{ idx + 1 }}</td>
                <td class="px-3 py-2 font-bold text-slate-900 dark:text-white">
                  {{ row.beneficiaryName }}
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-zinc-300">
                  <div class="font-medium">{{ row.beneficiaryBankName || '-' }}</div>
                  <div class="text-[9px] text-slate-400">{{ row.beneficiaryBranch }}</div>
                </td>
                <td class="px-3 py-2 font-mono font-bold text-slate-800 dark:text-zinc-200">
                  {{ row.beneficiaryAccountNo }}
                </td>
                <td class="px-3 py-2 font-mono font-bold text-blue-600 dark:text-blue-400 uppercase">
                  {{ row.beneficiaryIfsc }}
                </td>
                <td class="px-3 py-2 text-center">
                  <span
                    class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                    :class="row.paysysId === 'RTGS' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'"
                  >
                    {{ row.paysysId }}
                  </span>
                </td>
                <td class="px-3 py-2 text-right font-mono font-black text-slate-900 dark:text-white">
                  ₹{{ Number(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                </td>
                <td class="px-3 py-2 text-[10px] text-slate-500 dark:text-zinc-400 truncate max-w-[140px]">
                  {{ row.narration || batchConfig.chequeNo || '-' }}
                </td>
                <td class="px-3 py-2 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      class="text-amber-600 hover:text-amber-800 dark:text-amber-400 p-1 rounded hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                      title="Edit Row"
                      @click="editStagedRow(idx)"
                    >
                      <UIcon name="i-heroicons-pencil-square" class="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                      title="Remove Row"
                      @click="removeStagedRow(idx)"
                    >
                      <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="stagedRows.length > 0" class="bg-slate-50 dark:bg-zinc-850 font-black text-xs border-t-2 border-slate-200 dark:border-zinc-700">
              <tr>
                <td colspan="6" class="px-3 py-2 text-right uppercase tracking-wider text-[10px] text-slate-500 dark:text-zinc-400">
                  Total Payout ({{ stagedRows.length }} Entries):
                </td>
                <td class="px-3 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                  ₹{{ stagedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                </td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Sticky Command Bar at Bottom Matching Mockup -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
        <div class="text-[11px] text-slate-500 dark:text-zinc-400 font-bold">
          Batch Cheque: <span class="font-mono text-slate-900 dark:text-white">{{ batchConfig.chequeNo || 'N/A' }}</span> |
          Date: <span class="text-slate-900 dark:text-white font-mono">{{ batchConfig.paymentDate }}</span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Primary High-Contrast Action Button -->
          <button
            type="button"
            class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            :disabled="stagedRows.length === 0 || !batchConfig.bankAccountId || isPosting"
            @click="postBatchToLedger"
          >
            <UIcon v-if="isPosting" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <UIcon v-else name="i-heroicons-paper-airplane" class="w-4 h-4" />
            <span>Post {{ stagedRows.length }} Vouchers (Ctrl+Enter)</span>
            <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>
      </div>
    </div>

    <!-- Section 4: Bulk Payment Batch History (Collapsible Panel) -->
    <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
      <div 
        class="flex flex-wrap items-center justify-between p-3 px-4 cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors border-b border-slate-100 dark:border-zinc-800"
        @click="isHistoryCollapsed = !isHistoryCollapsed"
      >
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-clock" class="w-4 h-4 text-slate-600 dark:text-zinc-400" />
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            Bulk Payment Batches History & Audit Trail
          </h3>
          <span class="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-1.5 py-0.5 rounded font-mono font-bold">
            {{ batchHistory.length }} batches
          </span>
        </div>

        <div class="flex items-center gap-2" @click.stop>
          <input
            type="text"
            v-model="historySearch"
            placeholder="Search batch..."
            class="px-2.5 py-1 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none w-36"
            @input="fetchHistory"
          />
          <button type="button" class="text-slate-500 p-1 hover:text-slate-900 dark:hover:text-white" @click="isHistoryCollapsed = !isHistoryCollapsed">
            <UIcon :name="isHistoryCollapsed ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- History Table -->
      <div v-show="!isHistoryCollapsed" class="overflow-x-auto max-h-[300px] custom-scrollbar">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-50 dark:bg-zinc-850 sticky top-0 z-10 text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
            <tr>
              <th class="px-3 py-2">Batch No</th>
              <th class="px-3 py-2">Date</th>
              <th class="px-3 py-2">Bank Account</th>
              <th class="px-3 py-2 font-mono">Cheque No</th>
              <th class="px-3 py-2 text-center">Entries</th>
              <th class="px-3 py-2 text-right font-mono">Total Amount (₹)</th>
              <th class="px-3 py-2 text-center">Status</th>
              <th class="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-900">
            <tr v-if="historyLoading">
              <td colspan="8" class="py-6 text-center text-slate-400 font-bold">Loading batch history...</td>
            </tr>
            <tr v-else-if="batchHistory.length === 0">
              <td colspan="8" class="py-6 text-center text-slate-400">No bulk payment batches recorded yet</td>
            </tr>
            <tr v-for="batch in batchHistory" :key="batch._id" class="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
              <td class="px-3 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">{{ batch.batchNo }}</td>
              <td class="px-3 py-2 text-slate-700 dark:text-zinc-300 font-bold">{{ batch.paymentDate }}</td>
              <td class="px-3 py-2 text-slate-800 dark:text-zinc-200">
                <div class="font-bold">{{ batch.bankAccountName }}</div>
                <div class="text-[9px] font-mono text-slate-400">{{ batch.bankAccountNumber }}</div>
              </td>
              <td class="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">{{ batch.chequeNo || '-' }}</td>
              <td class="px-3 py-2 text-center font-bold">{{ batch.totalCount }}</td>
              <td class="px-3 py-2 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                ₹{{ Number(batch.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </td>
              <td class="px-3 py-2 text-center">
                <span
                  class="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                  :class="batch.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'"
                >
                  {{ batch.status }}
                </span>
              </td>
              <td class="px-3 py-2 text-center">
                <div class="flex items-center justify-center gap-1.5">
                  <!-- Export Excel -->
                  <button
                    type="button"
                    class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 rounded font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                    title="Download Bank Report Excel"
                    @click="exportBatchExcel(batch._id, batch.batchNo)"
                  >
                    <UIcon name="i-heroicons-document-arrow-down" class="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>

                  <!-- Cancel / Reverse Batch -->
                  <button
                    v-if="batch.status === 'POSTED'"
                    type="button"
                    class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 rounded font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                    title="Cancel Batch & Reverse Vouchers"
                    @click="cancelBatch(batch._id, batch.batchNo)"
                  >
                    <UIcon name="i-heroicons-x-circle" class="w-3.5 h-3.5" />
                    <span>Reverse</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Canonical Universal Master Registration & Edit Modal -->
    <PartyAccountMasterModal
      v-model="isMasterEditOpen"
      :account-id="quickForm.partyId"
      @saved="onMasterPartyUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useApi } from '@/utils/api';
import AccountSelectMenu from './AccountSelectMenu.vue';
import PartyAccountMasterModal from './PartyAccountMasterModal.vue';

interface BankAccountDoc {
  _id: string;
  bank_name: string;
  account_number: string;
  balance?: number;
}

interface StagedRow {
  accountHead: string;
  accountType: string;
  partyId?: string | null;
  beneficiaryName: string;
  beneficiaryAccountNo: string;
  beneficiaryIfsc: string;
  beneficiaryBankName: string;
  beneficiaryBranch: string;
  beneficiaryAccountType: string;
  paysysId: string;
  amount: number;
  narration: string;
}

const api = useApi();
const toast = useToast();

const isSourceBankCollapsed = ref(false);
const isHistoryCollapsed = ref(false);
const stagingSearch = ref('');

const bankAccounts = ref<BankAccountDoc[]>([]);
const coaAccounts = ref<any[]>([]);
const batchHistory = ref<any[]>([]);
const historyLoading = ref(false);
const historySearch = ref('');
const isPosting = ref(false);
const saveToMaster = ref(false);
const editingRowIndex = ref<number | null>(null);

const isMasterEditOpen = ref(false);

function openMasterEditModal() {
  if (!quickForm.value.partyId) return;
  isMasterEditOpen.value = true;
}

async function onMasterPartyUpdated(savedDoc: any) {
  await fetchCOAAccounts();
  const name = savedDoc.account_name || savedDoc.name;
  quickForm.value.accountHead = name;
  quickForm.value.beneficiaryName = name;
  quickForm.value.beneficiaryBankName = savedDoc.bank_name || savedDoc.bankName || '';
  quickForm.value.beneficiaryBranch = savedDoc.branch_name || savedDoc.branchName || '';
  quickForm.value.beneficiaryAccountNo = savedDoc.account_number || savedDoc.accountNumber || '';
  quickForm.value.beneficiaryIfsc = savedDoc.ifsc_code || savedDoc.ifscCode || '';
}

const batchConfig = ref({
  bankAccountId: '',
  chequeNo: '',
  paymentDate: new Date().toISOString().split('T')[0],
  defaultPaysys: 'NEFT',
  narration: ''
});

const quickForm = ref({
  accountHead: '',
  accountType: 'EXPENSE',
  partyId: null as string | null,
  beneficiaryName: '',
  beneficiaryAccountNo: '',
  beneficiaryIfsc: '',
  beneficiaryBankName: '',
  beneficiaryBranch: '',
  beneficiaryAccountType: '10',
  paysysId: 'NEFT',
  amount: null as number | null,
  narration: ''
});

const stagedRows = ref<StagedRow[]>([]);

const selectedBankAccount = computed(() => {
  return bankAccounts.value.find(b => b._id === batchConfig.value.bankAccountId);
});

const stagedTotalAmount = computed(() => {
  return stagedRows.value.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
});

const filteredStagedRows = computed(() => {
  if (!stagingSearch.value.trim()) return stagedRows.value;
  const q = stagingSearch.value.trim().toLowerCase();
  return stagedRows.value.filter(r => 
    (r.beneficiaryName && r.beneficiaryName.toLowerCase().includes(q)) ||
    (r.beneficiaryAccountNo && r.beneficiaryAccountNo.includes(q)) ||
    (r.beneficiaryIfsc && r.beneficiaryIfsc.toLowerCase().includes(q)) ||
    (r.beneficiaryBankName && r.beneficiaryBankName.toLowerCase().includes(q)) ||
    (r.narration && r.narration.toLowerCase().includes(q))
  );
});

async function fetchBankAccounts() {
  try {
    const res: any = await api.get('/banking');
    if (res && res.data) {
      const rawAccounts = res.data;
      const enriched = await Promise.all(rawAccounts.map(async (acc: any) => {
        try {
          const balRes = await api.get(`/banking/${acc._id}`);
          return {
            ...acc,
            balance: balRes.data?.balance || 0,
            balanceType: balRes.data?.balanceType || 'DR'
          };
        } catch {
          return { ...acc, balance: 0, balanceType: 'DR' };
        }
      }));
      bankAccounts.value = enriched;
      const firstAcc = bankAccounts.value[0];
      if (!batchConfig.value.bankAccountId && firstAcc) {
        batchConfig.value.bankAccountId = firstAcc._id;
      }
    }
  } catch (err: any) {
    console.error('Failed to load bank accounts:', err);
  }
}

async function fetchCOAAccounts() {
  try {
    const res: any = await api.get('/accounting/coa');
    if (res && res.data) {
      coaAccounts.value = res.data;
    }
  } catch (err: any) {
    console.error('Failed to load COA accounts:', err);
  }
}

async function fetchHistory() {
  historyLoading.value = true;
  try {
    const params: any = {};
    if (historySearch.value) params.search = historySearch.value;
    const res: any = await api.get('/accounting/bulk-payments', { params });
    if (res && res.data && res.data.batches) {
      batchHistory.value = res.data.batches;
    }
  } catch (err: any) {
    console.error('Failed to fetch bulk payment history:', err);
  } finally {
    historyLoading.value = false;
  }
}

function onBeneficiarySelect(accountOrName: any) {
  let account = accountOrName;
  if (typeof accountOrName === 'string') {
    account = coaAccounts.value.find(a => 
      (a.account_name && a.account_name.toLowerCase() === accountOrName.toLowerCase()) || 
      a._id === accountOrName
    );
  }

  if (account) {
    quickForm.value.accountHead = account.account_name || '';
    quickForm.value.beneficiaryName = account.account_name || '';
    quickForm.value.accountType = account.account_type || 'EXPENSE';
    quickForm.value.partyId = account._id || null;

    // Auto-fill Beneficiary Bank Details if available, or RESET TO EMPTY STRING if absent
    quickForm.value.beneficiaryAccountNo = account.account_number ? String(account.account_number).trim() : '';
    quickForm.value.beneficiaryIfsc = account.ifsc_code ? String(account.ifsc_code).trim().toUpperCase() : '';
    quickForm.value.beneficiaryBankName = account.bank_name ? String(account.bank_name).trim() : '';
    quickForm.value.beneficiaryBranch = account.branch_name ? String(account.branch_name).trim() : '';
    quickForm.value.beneficiaryAccountType = account.account_type_code ? String(account.account_type_code).trim() : '10';
  } else {
    // Reset all bank details if unselected or empty
    quickForm.value.beneficiaryAccountNo = '';
    quickForm.value.beneficiaryIfsc = '';
    quickForm.value.beneficiaryBankName = '';
    quickForm.value.beneficiaryBranch = '';
    quickForm.value.beneficiaryAccountType = '10';
    quickForm.value.partyId = null;
  }
}

watch(() => quickForm.value.accountHead, (newHead) => {
  if (!newHead) {
    onBeneficiarySelect(null);
    return;
  }
  const match = coaAccounts.value.find(a => 
    (a.account_name && a.account_name.toLowerCase() === newHead.toLowerCase()) || 
    a._id === newHead
  );
  if (match) {
    onBeneficiarySelect(match);
  }
});

function editStagedRow(index: number) {
  const row = stagedRows.value[index];
  if (!row) return;
  editingRowIndex.value = index;
  quickForm.value = {
    accountHead: row.accountHead,
    accountType: row.accountType || 'EXPENSE',
    partyId: row.partyId || null,
    beneficiaryName: row.beneficiaryName,
    beneficiaryAccountNo: row.beneficiaryAccountNo,
    beneficiaryIfsc: row.beneficiaryIfsc,
    beneficiaryBankName: row.beneficiaryBankName,
    beneficiaryBranch: row.beneficiaryBranch,
    beneficiaryAccountType: row.beneficiaryAccountType || '10',
    paysysId: row.paysysId || 'NEFT',
    amount: row.amount,
    narration: row.narration || ''
  };
}

function cancelRowEdit() {
  editingRowIndex.value = null;
  resetQuickForm();
}

async function addOrUpdateQuickRow() {
  if (!quickForm.value.accountHead) {
    toast.add({ title: 'Please select a Beneficiary / Party', color: 'error' });
    return;
  }
  if (!quickForm.value.beneficiaryAccountNo) {
    toast.add({ title: 'Beneficiary Account Number is required', color: 'error' });
    return;
  }
  if (!quickForm.value.beneficiaryIfsc) {
    toast.add({ title: 'Beneficiary IFSC Code is required', color: 'error' });
    return;
  }
  const amt = Number(quickForm.value.amount);
  if (!amt || isNaN(amt) || amt <= 0) {
    toast.add({ title: 'Please enter a valid payout amount', color: 'error' });
    return;
  }

  let paysys = quickForm.value.paysysId;
  if (batchConfig.value.defaultPaysys === 'AUTO') {
    paysys = amt >= 200000 ? 'RTGS' : 'NEFT';
  } else if (batchConfig.value.defaultPaysys) {
    paysys = batchConfig.value.defaultPaysys;
  }

  const rowData: StagedRow = {
    accountHead: quickForm.value.accountHead,
    accountType: quickForm.value.accountType || 'EXPENSE',
    partyId: quickForm.value.partyId,
    beneficiaryName: quickForm.value.beneficiaryName || quickForm.value.accountHead,
    beneficiaryAccountNo: String(quickForm.value.beneficiaryAccountNo).trim(),
    beneficiaryIfsc: String(quickForm.value.beneficiaryIfsc).trim().toUpperCase(),
    beneficiaryBankName: quickForm.value.beneficiaryBankName || '',
    beneficiaryBranch: quickForm.value.beneficiaryBranch || '',
    beneficiaryAccountType: quickForm.value.beneficiaryAccountType || '10',
    paysysId: paysys,
    amount: amt,
    narration: quickForm.value.narration || ''
  };

  // If user checked saveToMaster and partyId is present, persist to COA master
  if (saveToMaster.value && quickForm.value.partyId) {
    try {
      await api.put(`/accounting/coa/${quickForm.value.partyId}`, {
        bank_name: rowData.beneficiaryBankName,
        account_number: rowData.beneficiaryAccountNo,
        ifsc_code: rowData.beneficiaryIfsc,
        branch_name: rowData.beneficiaryBranch,
        account_type_code: rowData.beneficiaryAccountType
      });
      await fetchCOAAccounts();
      toast.add({ title: 'Master Updated', description: `Saved bank details to ${rowData.beneficiaryName}`, color: 'success' });
    } catch (err: any) {
      console.warn('Failed to update master bank details:', err);
    }
  }

  if (editingRowIndex.value !== null && editingRowIndex.value >= 0) {
    stagedRows.value[editingRowIndex.value] = rowData;
    toast.add({ title: 'Row Updated', color: 'neutral' });
    editingRowIndex.value = null;
  } else {
    stagedRows.value.push(rowData);
  }

  resetQuickForm();
}

function resetQuickForm() {
  quickForm.value = {
    accountHead: '',
    accountType: 'EXPENSE',
    partyId: null,
    beneficiaryName: '',
    beneficiaryAccountNo: '',
    beneficiaryIfsc: '',
    beneficiaryBankName: '',
    beneficiaryBranch: '',
    beneficiaryAccountType: '10',
    paysysId: batchConfig.value.defaultPaysys === 'RTGS' ? 'RTGS' : 'NEFT',
    amount: null,
    narration: ''
  };
  saveToMaster.value = false;
}

function removeStagedRow(index: number) {
  stagedRows.value.splice(index, 1);
}

function clearAllStaged() {
  if (confirm('Are you sure you want to clear all staged payout rows?')) {
    stagedRows.value = [];
  }
}

async function postBatchToLedger() {
  if (!batchConfig.value.bankAccountId) {
    toast.add({ title: 'Please select a Debit Bank Account', color: 'error' });
    return;
  }
  if (!batchConfig.value.chequeNo) {
    toast.add({ title: 'Cheque / Ref Number is required', color: 'error' });
    return;
  }
  if (stagedRows.value.length === 0) {
    toast.add({ title: 'No beneficiaries staged to post', color: 'error' });
    return;
  }

  isPosting.value = true;
  try {
    const payload = {
      bankAccountId: batchConfig.value.bankAccountId,
      chequeNo: batchConfig.value.chequeNo,
      paymentDate: batchConfig.value.paymentDate,
      defaultPaysys: batchConfig.value.defaultPaysys,
      narration: batchConfig.value.narration,
      items: stagedRows.value
    };

    const res: any = await api.post('/accounting/bulk-payments', payload);

    if (res && res.success) {
      toast.add({
        title: 'Bulk Payment Posted',
        description: `Batch ${res.data?.batchNo} with ${stagedRows.value.length} 1-to-1 vouchers recorded successfully`,
        color: 'success'
      });

      // Clear staged rows
      stagedRows.value = [];
      batchConfig.value.chequeNo = '';

      // Refresh history & bank balances
      await fetchHistory();
      await fetchBankAccounts();
    }
  } catch (err: any) {
    toast.add({
      title: 'Failed to post bulk payment',
      description: err.data?.statusMessage || err.message,
      color: 'error'
    });
  } finally {
    isPosting.value = false;
  }
}

async function exportBatchExcel(batchId: string, batchNo: string) {
  try {
    const blob = await api.get(`/accounting/bulk-payments/${batchId}/export`, {
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bank_Report_${batchNo.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    toast.add({ title: 'Failed to export Excel report', description: err.message, color: 'error' });
  }
}

async function cancelBatch(batchId: string, batchNo: string) {
  if (!confirm(`Are you sure you want to cancel Batch ${batchNo} and reverse all its double-entry vouchers?`)) {
    return;
  }

  try {
    const res: any = await api.delete(`/accounting/bulk-payments/${batchId}`);

    if (res && res.success) {
      toast.add({ title: 'Batch Reversed', description: res.message, color: 'success' });
      await fetchHistory();
      await fetchBankAccounts();
    }
  } catch (err: any) {
    toast.add({
      title: 'Failed to cancel batch',
      description: err.message || 'Failed to cancel batch',
      color: 'error'
    });
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (stagedRows.value.length > 0 && batchConfig.value.bankAccountId && !isPosting.value) {
      e.preventDefault();
      postBatchToLedger();
    }
  }
}

onMounted(() => {
  fetchBankAccounts();
  fetchCOAAccounts();
  fetchHistory();
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeydown);
  }
});
</script>
