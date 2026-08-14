<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 w-full mx-auto space-y-4 animate-fadeIn">
    <!-- Top Action Bar -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
      <div class="flex items-center gap-2">
        <UButton 
          icon="i-lucide-arrow-left" 
          color="neutral" 
          variant="ghost" 
          size="xs" 
          to="/labor" 
          class="cursor-pointer"
        />
        <div>
          <div class="flex items-center gap-1.5">
            <h1 class="text-base font-bold text-gray-900 dark:text-white uppercase tracking-tight">
              {{ period?.leader_name || 'Work Period Worksheet' }}
            </h1>
            <UBadge 
              :color="period?.status === 'Open' ? 'success' : 'neutral'" 
              variant="subtle" 
              size="xs"
              class="uppercase font-bold text-[8px] px-1.5 py-0.5"
            >
              {{ period?.status }}
            </UBadge>
          </div>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            {{ formatDateRange(period?.start_date, period?.end_date) }} • ID: {{ period?.id?.substring(0, 8) }}
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <UButton 
          icon="i-lucide-file-spreadsheet" 
          label="Export Excel" 
          color="neutral" 
          variant="outline" 
          size="xs" 
          class="font-bold cursor-pointer"
          @click="handleExportExcel" 
        />
        <UButton 
          v-if="period?.status === 'Open'"
          icon="i-lucide-save" 
          label="Save & Sync Sheet" 
          color="primary" 
          variant="solid"
          size="xs" 
          class="font-bold cursor-pointer"
          :loading="savingData"
          @click="handleSync" 
        />
        <UButton 
          v-if="period?.status === 'Open'"
          icon="i-lucide-banknotes" 
          label="Record Advance" 
          color="warning" 
          variant="soft" 
          size="xs" 
          class="font-bold cursor-pointer"
          @click="openAdvanceModal" 
        />
        <UButton 
          v-if="period?.status === 'Open'"
          icon="i-lucide-check-circle-2" 
          label="Final Settlement" 
          color="success" 
          variant="solid" 
          size="xs" 
          class="font-bold cursor-pointer"
          @click="openSettlementModal" 
        />
      </div>
    </div>

    <!-- General Ledger Advance Detection & Allocation Banner -->
    <div 
      v-if="hasUnallocatedLedgerAdvance && period?.status === 'Open'" 
      class="p-3.5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border-2 border-amber-400/80 dark:border-amber-700/80 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs animate-fadeIn"
    >
      <div class="flex items-start gap-3">
        <span class="text-2xl shrink-0 mt-0.5">💡</span>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-black uppercase tracking-wide text-amber-950 dark:text-amber-200">
              Core Ledger Advance Found: ₹{{ formatINR(leaderLedgerBalance.current_balance) }} DR
            </span>
            <span class="text-[9px] bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 font-extrabold px-1.5 py-0.5 rounded uppercase">
              General Accounting
            </span>
          </div>
          <p class="text-[11px] text-amber-900/80 dark:text-amber-300/90 mt-0.5">
            {{ period?.leader_name }} has ₹{{ formatINR(leaderLedgerBalance.current_balance) }} unallocated advance in the core ledger. Allocate to this period to deduct against wages and prevent cash overpayment.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
        <UButton 
          icon="i-lucide-zap"
          :label="`⚡ Allocate ₹${formatINR(Math.min(netPayable, leaderLedgerBalance.current_balance))} to Period`"
          color="warning"
          variant="solid"
          size="xs"
          class="font-black cursor-pointer shadow-sm text-xs"
          :loading="allocating"
          @click="handleQuickAllocate"
        />
      </div>
    </div>

    <!-- Financial Snapshot Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <p class="text-[9px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">Total Wages</p>
        <p class="text-base font-black text-gray-900 dark:text-white mt-0.5">₹{{ formatINR(sumWages) }}</p>
        <p class="text-[8px] text-gray-400 mt-0.5">{{ localWorkers.length }} workers listed</p>
      </div>
      <div class="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <p class="text-[9px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">Misc Expenses</p>
        <p class="text-base font-black text-gray-900 dark:text-white mt-0.5">₹{{ formatINR(sumExpenses) }}</p>
        <p class="text-[8px] text-gray-400 mt-0.5">{{ localExpenses.length }} items logged</p>
      </div>
      <div class="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-[9px] font-bold uppercase text-amber-500 tracking-wider">Advances Issued</p>
          <span v-if="hasUnallocatedLedgerAdvance" class="text-[8px] text-blue-600 dark:text-blue-400 font-bold">
            +₹{{ formatINR(leaderLedgerBalance.current_balance) }} in Ledger
          </span>
        </div>
        <p class="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">₹{{ formatINR(sumAdvances) }}</p>
        <p class="text-[8px] text-amber-500/80 mt-0.5">{{ advances.length }} advance vouchers</p>
      </div>
      <div class="p-3 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-xl text-white shadow-sm">
        <p class="text-[9px] font-bold uppercase tracking-wider opacity-90">Net Payable</p>
        <p class="text-base font-black mt-0.5">₹{{ formatINR(netPayable) }}</p>
        <p class="text-[8px] opacity-90 mt-0.5">{{ period?.status === 'Settled' ? 'Settled & Paid' : 'Pending Settlement' }}</p>
      </div>
    </div>

    <!-- Attendance Worksheet Table Grid -->
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div class="px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
        <h3 class="font-bold text-gray-800 dark:text-gray-100 text-xs flex items-center gap-1.5">
          <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5 text-teal-500" />
          Worker Attendance Sheet
        </h3>
        <UButton 
          v-if="period?.status === 'Open'"
          icon="i-lucide-plus" 
          label="Add Worker Row" 
          size="xs" 
          color="primary" 
          variant="outline"
          class="font-bold cursor-pointer text-[10px]" 
          @click="addWorkerRow" 
        />
      </div>

      <div class="overflow-auto max-h-[60vh] relative custom-scrollbar border-b border-gray-200 dark:border-gray-800">
        <table class="w-full text-left border-collapse text-xs">
          <thead class="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 shadow-xs">
            <tr>
              <th class="px-2.5 py-2 font-bold text-gray-600 dark:text-gray-300 min-w-[180px] text-[10px] sticky left-0 z-30 bg-gray-100 dark:bg-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Labor Name</th>
              <th class="px-2.5 py-2 font-bold text-gray-600 dark:text-gray-300 w-20 text-[10px]">Daily Wage</th>
              <th 
                v-for="d in dates" 
                :key="dateKey(d)" 
                class="px-1 py-1.5 font-bold text-center w-7 text-[10px]"
                :class="[isWeekend(d) ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600' : 'text-gray-600 dark:text-gray-300']"
              >
                <div class="text-[8px] uppercase opacity-75">{{ formatWeekday(d) }}</div>
                <div>{{ d.getDate() }}</div>
              </th>
              <th class="px-2.5 py-2 font-bold text-gray-600 dark:text-gray-300 w-20 text-right text-[10px]">Days</th>
              <th class="px-2.5 py-2 font-bold text-gray-600 dark:text-gray-300 w-24 text-right text-[10px]">Total Wages</th>
              <th v-if="period?.status === 'Open'" class="px-2 py-2 text-center w-8"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-if="localWorkers.length === 0">
              <td :colspan="dates.length + 5" class="py-8 text-center text-gray-400 italic text-xs">
                No workers added yet. Click "Add Worker Row" above to start logging attendance.
              </td>
            </tr>
            <tr v-else v-for="(w, wIdx) in localWorkers" :key="w.id || wIdx" class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 group">
              <!-- Worker Name (Sticky Column 1) -->
              <td class="px-2.5 py-1.5 sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                <input 
                  v-if="period?.status === 'Open'"
                  v-model="w.labor_name" 
                  type="text" 
                  placeholder="Enter worker name"
                  class="w-full bg-transparent border-0 border-b border-dashed border-gray-300 dark:border-gray-700 focus:border-teal-500 focus:ring-0 text-xs font-semibold text-gray-900 dark:text-white px-1 py-0.5"
                />
                <span v-else class="font-semibold text-xs text-gray-900 dark:text-white">{{ w.labor_name }}</span>
              </td>

              <!-- Daily Wage -->
              <td class="px-2.5 py-1.5 bg-white dark:bg-gray-900 group-hover:bg-gray-50">
                <input 
                  v-if="period?.status === 'Open'"
                  v-model.number="w.daily_wage" 
                  type="number" 
                  min="0"
                  placeholder="0"
                  class="w-full bg-transparent border-0 border-b border-dashed border-gray-300 dark:border-gray-700 focus:border-teal-500 focus:ring-0 text-xs font-semibold text-gray-900 dark:text-white px-1 py-0.5"
                />
                <span v-else class="font-semibold text-xs text-gray-900 dark:text-white">₹{{ w.daily_wage }}</span>
              </td>

              <!-- Attendance Cells -->
              <td 
                v-for="d in dates" 
                :key="dateKey(d)" 
                class="px-0.5 py-1.5 text-center"
              >
                <button 
                  type="button"
                  :disabled="period?.status !== 'Open'"
                  class="w-5 h-5 rounded text-[9px] font-bold transition flex items-center justify-center mx-auto cursor-pointer"
                  :class="getCellClass(w.attendance[dateKey(d)])"
                  @click="cycleCell(wIdx, dateKey(d))"
                >
                  {{ getCellLabel(w.attendance[dateKey(d)]) }}
                </button>
              </td>

              <!-- Total Present Days -->
              <td class="px-2.5 py-1.5 text-right font-bold text-xs text-gray-700 dark:text-gray-300">
                {{ calculateWorkerPresentDays(w) }}
              </td>

              <!-- Total Wages -->
              <td class="px-2.5 py-1.5 text-right font-extrabold text-xs text-gray-900 dark:text-white">
                ₹{{ formatINR(calculateWorkerTotal(w)) }}
              </td>

              <!-- Delete Row Button -->
              <td v-if="period?.status === 'Open'" class="px-2 py-2 text-center">
                <UButton 
                  icon="i-lucide-trash-2" 
                  variant="ghost" 
                  color="error" 
                  size="xs" 
                  class="cursor-pointer"
                  @click="removeWorkerRow(wIdx)" 
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Expenses & Advances Bottom Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Miscellaneous Expenses Panel -->
      <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-3.5 space-y-3">
        <div class="flex justify-between items-center">
          <h3 class="font-bold text-gray-800 dark:text-gray-100 text-xs flex items-center gap-1.5">
            <UIcon name="i-lucide-receipt" class="w-3.5 h-3.5 text-teal-500" />
            Miscellaneous Period Expenses
          </h3>
          <UButton 
            v-if="period?.status === 'Open'"
            icon="i-lucide-plus" 
            label="Add Expense" 
            size="xs" 
            color="neutral" 
            variant="outline"
            class="font-bold cursor-pointer text-[10px]" 
            @click="addExpenseRow" 
          />
        </div>

        <div class="space-y-1.5">
          <div v-if="localExpenses.length === 0" class="text-xs text-gray-400 italic text-center py-4">
            No period expenses logged.
          </div>
          <div 
            v-else 
            v-for="(exp, eIdx) in localExpenses" 
            :key="eIdx" 
            class="flex items-center gap-2.5 p-1.5 bg-gray-50 dark:bg-gray-800/40 rounded-lg text-xs"
          >
            <input 
              v-if="period?.status === 'Open'"
              v-model="exp.description" 
              type="text" 
              placeholder="Expense description"
              class="flex-1 bg-transparent text-xs font-semibold text-gray-900 dark:text-white border-0 border-b border-dashed border-gray-300 dark:border-gray-700 focus:ring-0 px-1 py-0.5"
            />
            <span v-else class="flex-1 text-xs font-semibold text-gray-900 dark:text-white">{{ exp.description }}</span>

            <input 
              v-if="period?.status === 'Open'"
              v-model.number="exp.amount" 
              type="number" 
              placeholder="Amount"
              class="w-20 bg-transparent text-xs font-bold text-gray-900 dark:text-white border-0 border-b border-dashed border-gray-300 dark:border-gray-700 focus:ring-0 text-right px-1 py-0.5"
            />
            <span v-else class="text-xs font-bold text-gray-900 dark:text-white">₹{{ exp.amount }}</span>

            <UButton 
              v-if="period?.status === 'Open'"
              icon="i-lucide-x" 
              variant="ghost" 
              color="error" 
              size="xs" 
              class="cursor-pointer"
              @click="removeExpenseRow(eIdx)" 
            />
          </div>
        </div>
      </div>

      <!-- Advances Issued Panel -->
      <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-3.5 space-y-3">
        <div class="flex justify-between items-center">
          <h3 class="font-bold text-gray-800 dark:text-gray-100 text-xs flex items-center gap-1.5">
            <UIcon name="i-lucide-hand-coins" class="w-3.5 h-3.5 text-amber-500" />
            Advances & Mid-Period Payments
          </h3>
          <UButton 
            v-if="period?.status === 'Open'"
            icon="i-lucide-plus" 
            label="Issue Advance" 
            size="xs" 
            color="warning" 
            variant="outline"
            class="font-bold cursor-pointer text-[10px]" 
            @click="openAdvanceModal" 
          />
        </div>

        <div class="space-y-1.5">
          <div v-if="advances.length === 0" class="text-xs text-gray-400 italic text-center py-4">
            No advances paid for this work period.
          </div>
          <div 
            v-else 
            v-for="adv in advances" 
            :key="adv.id" 
            class="flex items-center justify-between p-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30 text-xs"
          >
            <div>
              <div class="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <span>Advance Issued</span>
                <span v-if="adv.ledger_voucher_group_id === 'ALLOCATED_FROM_LEDGER'" class="text-[8px] font-extrabold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded">
                  ⚡ Allocated from Ledger
                </span>
              </div>
              <div class="text-[9px] text-amber-600 dark:text-amber-400">
                Paid on {{ formatDate(adv.payment_date) }} • {{ adv.paid_from_bank_account_id ? 'Bank Account' : (adv.ledger_voucher_group_id === 'ALLOCATED_FROM_LEDGER' ? 'General Ledger Advance' : 'Cash') }}
              </div>
            </div>
            <div class="text-xs font-black text-amber-700 dark:text-amber-300">
              ₹{{ formatINR(adv.amount) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Record Advance Modal -->
    <UModal v-model:open="isAdvanceModalOpen">
      <template #content>
        <div class="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
          <div class="border-b border-gray-100 dark:border-gray-800 pb-3 flex justify-between items-center">
            <h3 class="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Record Advance Payment
            </h3>
            <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" @click="isAdvanceModalOpen = false" />
          </div>

          <form @submit.prevent="submitAdvance" class="space-y-4 text-xs">
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Advance Amount (INR)*</label>
              <UInput v-model.number="advanceForm.amount" type="number" min="1" step="0.01" size="sm" class="w-full font-semibold" required />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Payment Date*</label>
              <UInput v-model="advanceForm.payment_date" type="date" size="sm" class="w-full font-semibold cursor-pointer" required />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Payment Mode*</label>
              <USelect v-model="advanceForm.payment_mode" :items="['CASH', 'BANK', 'CHEQUE', 'UPI']" size="sm" class="w-full font-semibold cursor-pointer" />
            </div>
            <div v-if="advanceForm.payment_mode !== 'CASH'" class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Paid From Bank Account*</label>
              <USelect v-model="advanceForm.bank_account_id" :items="bankAccountOptions" size="sm" class="w-full font-semibold cursor-pointer" />
            </div>

            <div class="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
              <UButton label="Cancel" variant="ghost" color="neutral" size="sm" @click="isAdvanceModalOpen = false" />
              <UButton type="submit" label="Post Advance" color="warning" variant="solid" size="sm" class="font-bold cursor-pointer" :loading="postingAdvance" />
            </div>
          </form>
        </div>
      </template>
    </UModal>

    <!-- Final Settlement Modal -->
    <UModal v-model:open="isSettlementModalOpen">
      <template #content>
        <div class="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
          <div class="border-b border-gray-100 dark:border-gray-800 pb-3 flex justify-between items-center">
            <h3 class="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Execute Final Period Settlement
            </h3>
            <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" @click="isSettlementModalOpen = false" />
          </div>

          <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl space-y-2 text-xs border border-gray-100 dark:border-gray-800">
            <div class="flex justify-between text-gray-500">
              <span>Gross Wages:</span>
              <span class="font-bold text-gray-900 dark:text-white">₹{{ formatINR(sumWages) }}</span>
            </div>
            <div class="flex justify-between text-gray-500">
              <span>Misc Expenses:</span>
              <span class="font-bold text-gray-900 dark:text-white">₹{{ formatINR(sumExpenses) }}</span>
            </div>
            <div class="flex justify-between text-amber-600">
              <span>Less Advances:</span>
              <span class="font-bold">- ₹{{ formatINR(sumAdvances) }}</span>
            </div>
            <div class="flex justify-between text-sm font-black text-teal-600 dark:text-teal-400 border-t border-gray-200 dark:border-gray-700 pt-2">
              <span>Calculated Net Payable:</span>
              <span>₹{{ formatINR(netPayable) }}</span>
            </div>
          </div>

          <!-- Unallocated Ledger Advance Notice in Modal -->
          <div v-if="hasUnallocatedLedgerAdvance" class="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-xs space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-amber-900 dark:text-amber-200 text-[11px]">
                Available Core Ledger Advance: ₹{{ formatINR(leaderLedgerBalance.current_balance) }} DR
              </span>
              <UButton 
                label="Set Payout ₹0 (Adjust Advance)" 
                size="xs" 
                color="warning" 
                variant="soft" 
                class="text-[10px] font-bold cursor-pointer"
                @click="settlementForm.paid_amount = 0; settlementForm.adjustment_reason = 'Adjusted against Core Ledger Advance'"
              />
            </div>
            <p class="text-[10px] text-amber-800 dark:text-amber-400">
              Setting actual paid amount to ₹0 will clear the ₹{{ formatINR(netPayable) }} wage liability against the leader's ₹{{ formatINR(leaderLedgerBalance.current_balance) }} general advance without disbursing additional cash.
            </p>
          </div>

          <form @submit.prevent="submitSettlement" class="space-y-4 text-xs">
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actual Cash/Bank Payout (INR)*</label>
              <UInput v-model.number="settlementForm.paid_amount" type="number" min="0" step="0.01" size="sm" class="w-full font-black text-sm" required />
            </div>
            <div v-if="Math.abs(netPayable - (settlementForm.paid_amount || 0)) > 0.01" class="space-y-1">
              <label class="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Adjustment Reason (Discount/Advance/Discrepancy)</label>
              <UInput v-model="settlementForm.adjustment_reason" placeholder="Explain adjustment rationale..." size="sm" class="w-full font-semibold" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Payment Date*</label>
              <UInput v-model="settlementForm.payment_date" type="date" size="sm" class="w-full font-semibold cursor-pointer" required />
            </div>
            <div class="space-y-1" v-if="settlementForm.paid_amount > 0">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Payment Mode*</label>
              <USelect v-model="settlementForm.payment_mode" :items="['CASH', 'BANK', 'CHEQUE', 'UPI']" size="sm" class="w-full font-semibold cursor-pointer" />
            </div>
            <div v-if="settlementForm.paid_amount > 0 && settlementForm.payment_mode !== 'CASH'" class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Paid From Bank Account*</label>
              <USelect v-model="settlementForm.bank_account_id" :items="bankAccountOptions" size="sm" class="w-full font-semibold cursor-pointer" />
            </div>

            <div class="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
              <UButton label="Cancel" variant="ghost" color="neutral" size="sm" @click="isSettlementModalOpen = false" />
              <UButton type="submit" label="Complete Settlement" color="success" variant="solid" size="sm" class="font-bold cursor-pointer" :loading="settlingPeriod" />
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { useLabor } from '~/composables/useLabor';

definePageMeta({
  layout: 'default'
});

const route = useRoute();
const { 
  fetchPeriodDetails, 
  periodDetails, 
  syncPeriodData, 
  payAdvance, 
  allocateAdvance,
  settlePeriod, 
  exportPeriodExcel 
} = useLabor();

const period = computed(() => periodDetails.value?.period);
const advances = computed(() => periodDetails.value?.advances || []);
const bankAccounts = computed(() => periodDetails.value?.bankAccounts || []);
const leaderLedgerBalance = computed(() => periodDetails.value?.leaderLedgerBalance || { current_balance: 0, current_balance_type: 'DR' });

const hasUnallocatedLedgerAdvance = computed(() => {
  return (leaderLedgerBalance.value.current_balance || 0) > 0 && leaderLedgerBalance.value.current_balance_type === 'DR';
});

const localWorkers = ref<any[]>([]);
const localExpenses = ref<any[]>([]);
const savingData = ref(false);
const allocating = ref(false);

const isAdvanceModalOpen = ref(false);
const postingAdvance = ref(false);
const advanceForm = reactive({
  amount: 0,
  payment_date: new Date().toISOString().split('T')[0],
  payment_mode: 'CASH',
  bank_account_id: ''
});

const isSettlementModalOpen = ref(false);
const settlingPeriod = ref(false);
const settlementForm = reactive({
  paid_amount: 0,
  payment_date: new Date().toISOString().split('T')[0],
  payment_mode: 'CASH',
  bank_account_id: '',
  adjustment_reason: ''
});

const dates = computed(() => {
  if (!period.value?.start_date || !period.value?.end_date) return [];
  const start = new Date(period.value.start_date);
  const end = new Date(period.value.end_date);
  const list: Date[] = [];
  const curr = new Date(start);
  while (curr <= end) {
    list.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return list;
});

const bankAccountOptions = computed(() => {
  return bankAccounts.value.map((b: any) => ({
    label: `${b.account_name} (${b.bank_name || 'Bank'})`,
    value: b._id
  }));
});

const loadDetails = async () => {
  const periodId = route.params.id as string;
  await fetchPeriodDetails(periodId);

  // Set workers
  const rawWorkers = periodDetails.value?.workers || [];
  const rawAttendanceMap = periodDetails.value?.attendance || {};

  localWorkers.value = rawWorkers.map((w: any) => {
    const attObj = rawAttendanceMap[w.id] || {};
    const formattedAtt: Record<string, string> = {};
    Object.entries(attObj).forEach(([dStr, val]) => {
      formattedAtt[dStr] = mapDayValueToStatus(val);
    });

    return {
      id: w.id,
      labor_name: w.labor_name,
      daily_wage: Number(w.daily_wage),
      attendance: formattedAtt
    };
  });

  if (localWorkers.value.length === 0 && period.value?.status === 'Open') {
    addWorkerRow();
  }

  // Set expenses
  localExpenses.value = (periodDetails.value?.expenses || []).map((e: any) => ({
    description: e.description,
    amount: Number(e.amount)
  }));
};

onMounted(loadDetails);

const dateKey = (d: Date): string => d.toISOString().split('T')[0] || '';
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const formatWeekday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateRange = (startStr: string, endStr: string) => {
  if (!startStr || !endStr) return '';
  return `${formatDate(startStr)} to ${formatDate(endStr)}`;
};

const formatINR = (val: number) => {
  return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const mapDayValueToStatus = (val: any) => {
  const v = parseFloat(val);
  if (isNaN(v) || v === 0) return 'L';
  if (v === 0.5) return '½';
  if (v === 1.0) return 'P';
  if (v === 2.0) return '2';
  return String(v);
};

const getCellLabel = (status: string | undefined) => {
  if (!status || status === 'L') return '.';
  if (status === '2') return '2';
  return status;
};

const getCellClass = (status: string | undefined) => {
  if (status === 'P') return 'bg-emerald-500 text-white shadow-inner font-black';
  if (status === 'L') return 'bg-rose-500 text-white shadow-inner font-black';
  if (status === '½') return 'bg-amber-500 text-white shadow-inner font-black';
  if (status === '2' || status === '2.0') return 'bg-purple-600 text-white shadow-inner font-black';
  if (status && status !== 'L') return 'bg-indigo-600 text-white shadow-inner font-black';
  return 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800';
};

const cycleCell = (wIdx: number, dateStr: string) => {
  if (period.value?.status !== 'Open') return;
  const worker = localWorkers.value[wIdx];
  if (!worker) return;
  const curr = worker.attendance[dateStr] || 'L';
  let next = 'L';
  if (curr === 'L') next = 'P';
  else if (curr === 'P') next = '½';
  else if (curr === '½') next = '2';
  else if (curr === '2') next = 'L';
  else next = 'L';
  worker.attendance[dateStr] = next;
};

const calculateWorkerPresentDays = (w: any) => {
  let days = 0;
  dates.value.forEach((d) => {
    const status = w.attendance[dateKey(d)] || 'L';
    if (status === 'P') days += 1.0;
    else if (status === '½') days += 0.5;
    else if (status === '2' || status === '2.0') days += 2.0;
    else if (status !== 'L') days += parseFloat(status) || 0;
  });
  return days;
};

const calculateWorkerTotal = (w: any) => {
  return calculateWorkerPresentDays(w) * (w.daily_wage || 0);
};

const sumWages = computed(() => {
  return localWorkers.value.reduce((acc: number, w: any) => acc + calculateWorkerTotal(w), 0);
});

const sumExpenses = computed(() => {
  return localExpenses.value.reduce((acc: number, e: any) => acc + (Number(e.amount) || 0), 0);
});

const sumAdvances = computed(() => {
  return advances.value.reduce((acc: number, a: any) => acc + Number(a.amount || 0), 0);
});

const netPayable = computed(() => {
  return sumWages.value + sumExpenses.value - sumAdvances.value;
});

const addWorkerRow = () => {
  const emptyAtt: Record<string, string> = {};
  dates.value.forEach((d) => {
    emptyAtt[dateKey(d)] = 'P';
  });
  localWorkers.value.push({
    labor_name: '',
    daily_wage: 500,
    attendance: emptyAtt
  });
};

const removeWorkerRow = (idx: number) => {
  localWorkers.value.splice(idx, 1);
};

const addExpenseRow = () => {
  localExpenses.value.push({ description: '', amount: 0 });
};

const removeExpenseRow = (idx: number) => {
  localExpenses.value.splice(idx, 1);
};

const handleSync = async () => {
  const periodId = route.params.id as string;
  savingData.value = true;
  try {
    const formattedWorkers = localWorkers.value
      .filter((w) => w.labor_name.trim())
      .map((w) => {
        const attPayload: Record<string, number> = {};
        Object.entries(w.attendance).forEach(([dStr, status]) => {
          let numVal = 0;
          if (status === 'P') numVal = 1.0;
          else if (status === '½') numVal = 0.5;
          else if (status === 'L') numVal = 0.0;
          else numVal = parseFloat(status as string) || 0;
          attPayload[dStr] = numVal;
        });

        return {
          id: w.id,
          labor_name: w.labor_name.trim(),
          daily_wage: Number(w.daily_wage) || 0,
          attendance: attPayload
        };
      });

    await syncPeriodData(periodId, {
      workers: formattedWorkers,
      expenses: localExpenses.value.filter((e) => e.description.trim() && Number(e.amount) > 0)
    });

    await loadDetails();
  } catch (err: any) {
    alert(err.message || 'Error syncing attendance sheet');
  } finally {
    savingData.value = false;
  }
};

const openAdvanceModal = () => {
  advanceForm.amount = 0;
  advanceForm.payment_date = new Date().toISOString().split('T')[0];
  advanceForm.payment_mode = 'CASH';
  advanceForm.bank_account_id = bankAccountOptions.value[0]?.value || '';
  isAdvanceModalOpen.value = true;
};

const submitAdvance = async () => {
  if (!advanceForm.amount || advanceForm.amount <= 0) return;
  postingAdvance.value = true;
  try {
    await payAdvance({
      period_id: period.value.id,
      amount: advanceForm.amount,
      payment_date: advanceForm.payment_date,
      payment_mode: advanceForm.payment_mode,
      bank_account_id: advanceForm.payment_mode === 'CASH' ? null : advanceForm.bank_account_id
    });
    isAdvanceModalOpen.value = false;
    await loadDetails();
  } catch (err: any) {
    alert(err.message || 'Error recording advance payment');
  } finally {
    postingAdvance.value = false;
  }
};

const handleQuickAllocate = async () => {
  if (!period.value?.id) return;
  const allocAmount = Math.min(netPayable.value, leaderLedgerBalance.value.current_balance);
  if (allocAmount <= 0) {
    alert('No remaining net payable balance to allocate.');
    return;
  }
  allocating.value = true;
  try {
    await allocateAdvance({
      period_id: period.value.id,
      amount: allocAmount,
      payment_date: new Date().toISOString().split('T')[0]
    });
    await loadDetails();
  } catch (err: any) {
    alert(err.message || 'Error allocating ledger advance');
  } finally {
    allocating.value = false;
  }
};

const openSettlementModal = () => {
  settlementForm.paid_amount = netPayable.value;
  settlementForm.payment_date = new Date().toISOString().split('T')[0];
  settlementForm.payment_mode = 'CASH';
  settlementForm.bank_account_id = bankAccountOptions.value[0]?.value || '';
  settlementForm.adjustment_reason = '';
  isSettlementModalOpen.value = true;
};

const submitSettlement = async () => {
  settlingPeriod.value = true;
  try {
    await settlePeriod({
      period_id: period.value.id,
      paid_amount: settlementForm.paid_amount,
      payment_date: settlementForm.payment_date,
      payment_mode: settlementForm.payment_mode,
      bank_account_id: (settlementForm.paid_amount > 0 && settlementForm.payment_mode !== 'CASH') ? settlementForm.bank_account_id : null,
      adjustment_reason: settlementForm.adjustment_reason
    });
    isSettlementModalOpen.value = false;
    await loadDetails();
  } catch (err: any) {
    alert(err.message || 'Error completing settlement');
  } finally {
    settlingPeriod.value = false;
  }
};

const handleExportExcel = async () => {
  if (!period.value) return;
  try {
    await exportPeriodExcel(period.value.id, period.value.leader_name);
  } catch (err: any) {
    alert(err.message || 'Error downloading Excel report');
  }
};
</script>
