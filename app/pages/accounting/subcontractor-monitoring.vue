<template>
  <div class="min-h-screen bg-slate-50/80 pb-20 font-sans text-slate-800">
    <!-- Top Full-Width Header Banner -->
    <div class="bg-gradient-to-r from-indigo-700 via-blue-600 to-indigo-800 text-white shadow-md">
      <div class="w-full px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 text-xs font-semibold text-indigo-100 mb-0.5">
              <NuxtLink to="/accounting/ledger" class="hover:underline text-white no-underline">
                Accounting
              </NuxtLink>
              <span>/</span>
              <span class="text-amber-300 font-bold">Works Contract</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-base sm:text-xl font-black tracking-tight flex items-center gap-2">
                <span>🏗️</span>
                <span>Subcontractors & Direct Expenses</span>
              </h1>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                TDS 194C & Float
              </span>
            </div>
            <p class="text-xs text-indigo-100 mt-0.5">
              Live Contractor Float, Statutory TDS u/s 194C, and Off-Core Site Burn Monitoring
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap shrink-0">
            <button
              @click="openRegisterModal"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition shadow-xs cursor-pointer active:scale-95"
            >
              <span>➕ Register Subcontractor</span>
            </button>

            <NuxtLink
              to="/accounting/imprest-approvals"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition text-white no-underline border border-white/20 shadow-xs"
              title="Site Imprest Approvals"
            >
              <span>⚖️</span>
              <span>Imprest Approvals</span>
            </NuxtLink>

            <NuxtLink
              to="/chat"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition text-white no-underline border border-white/20"
              title="Direct Chat with Subcontractors"
            >
              <span>💬</span>
              <span>1-on-1 Chat</span>
            </NuxtLink>

            <button
              @click="loadData"
              :disabled="loading"
              class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition border border-white/20 text-white cursor-pointer"
              title="Refresh contractor data"
            >
              <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Full-Width Content Container -->
    <div class="w-full px-4 sm:px-6 lg:px-8 mt-4 space-y-4">
      <!-- Error Notice -->
      <div v-if="error" class="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex justify-between shadow-xs">
        <div class="flex items-center gap-2">
          <span>⚠️</span>
          <span>{{ error }}</span>
        </div>
        <button @click="error = null" class="font-bold text-red-500 hover:text-red-700">✕</button>
      </div>

      <!-- KPI Summary Cards Grid (6 Columns on Desktop) -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <!-- 1. Total Subcontractors -->
        <div class="p-3.5 rounded-xl bg-white shadow-xs border border-slate-200 bg-gradient-to-br from-white to-slate-50">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Subcontractors
          </span>
          <span class="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-1 block">
            {{ summary.totalSubcontractors || 0 }}
          </span>
          <span class="text-[10px] text-slate-500">Active assigned</span>
        </div>

        <!-- 2. Gross Direct Expenses -->
        <div class="p-3.5 rounded-xl bg-white shadow-xs border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/50">
          <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
            Total Gross Booked
          </span>
          <span class="text-lg sm:text-xl font-black text-indigo-900 font-mono mt-1 block">
            ₹{{ formatCurrency(summary.totalGrossPaid || 0) }}
          </span>
          <span class="text-[10px] text-slate-500">Core Direct Expense</span>
        </div>

        <!-- 3. Statutory TDS 194C -->
        <div class="p-3.5 rounded-xl bg-white shadow-xs border border-amber-200 bg-gradient-to-br from-white to-amber-50/60">
          <span class="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
            🏛️ Total TDS 194C
          </span>
          <span class="text-lg sm:text-xl font-black text-amber-900 font-mono mt-1 block">
            ₹{{ formatCurrency(summary.totalTdsWithheld || 0) }}
          </span>
          <span class="text-[10px] text-amber-700 font-medium">Statutory Tax Withheld</span>
        </div>

        <!-- 4. Net Payouts Disbursed -->
        <div class="p-3.5 rounded-xl bg-white shadow-xs border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50">
          <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
            Total Net Disbursed
          </span>
          <span class="text-lg sm:text-xl font-black text-emerald-800 font-mono mt-1 block">
            ₹{{ formatCurrency(summary.totalNetPaid || 0) }}
          </span>
          <span class="text-[10px] text-slate-500">Bank / Cash Payouts</span>
        </div>

        <!-- 5. Site Expenses Incurred -->
        <div class="p-3.5 rounded-xl bg-white shadow-xs border border-sky-200 bg-gradient-to-br from-white to-sky-50/50">
          <span class="text-[10px] font-bold uppercase tracking-wider text-sky-700 block">
            Site Expenses Incurred
          </span>
          <span class="text-lg sm:text-xl font-black text-sky-900 font-mono mt-1 block">
            ₹{{ formatCurrency(summary.totalSiteExpenses || 0) }}
          </span>
          <span class="text-[10px] text-slate-500">Contractor Burn (Off-Core)</span>
        </div>

        <!-- 6. Live Float Remaining -->
        <div class="p-3.5 rounded-xl bg-white shadow-xs border border-slate-200 bg-gradient-to-br from-white to-slate-50">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Live Float in Hands
          </span>
          <span
            class="text-lg sm:text-xl font-black font-mono mt-1 block"
            :class="(summary.netFloatRemaining || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'"
          >
            ₹{{ formatCurrency(Math.abs(summary.netFloatRemaining || 0)) }}
          </span>
          <span class="text-[10px] font-semibold" :class="(summary.netFloatRemaining || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'">
            {{ (summary.netFloatRemaining || 0) >= 0 ? 'Net in hand' : 'Contractor Deficit' }}
          </span>
        </div>
      </div>

      <!-- Table Section -->
      <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <!-- Search and Filter Bar -->
        <div class="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div class="relative flex-1 max-w-md">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by contractor name, PAN, or account head..."
              class="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
            <span class="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>
          <div class="text-xs text-slate-500 font-medium">
            Showing <strong class="text-slate-800">{{ filteredSubcontractors.length }}</strong> contractor(s)
          </div>
        </div>

        <!-- DESKTOP VIEW: High-Density Compact Table (Hidden on Mobile, Visible on sm:) -->
        <div class="hidden sm:block overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th class="py-2.5 px-3">Subcontractor</th>
                <th class="py-2.5 px-3">PAN & A/C Head</th>
                <th class="py-2.5 px-3 text-right">Gross Paid (₹)</th>
                <th class="py-2.5 px-3 text-right">TDS 194C (₹)</th>
                <th class="py-2.5 px-3 text-right">Net Paid (₹)</th>
                <th class="py-2.5 px-3 text-right">Site Burn (₹)</th>
                <th class="py-2.5 px-3 text-right">Wallet Balance</th>
                <th class="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="loading" class="text-center">
                <td colspan="8" class="p-8 text-slate-400 text-xs">Loading subcontractors data...</td>
              </tr>
              <tr v-else-if="filteredSubcontractors.length === 0" class="text-center">
                <td colspan="8" class="p-8 text-slate-400 text-xs">
                  No subcontractors found. Click "Register Subcontractor" to provision their ledger head.
                </td>
              </tr>
              <tr
                v-for="sub in filteredSubcontractors"
                :key="sub.subcontractorId"
                class="hover:bg-slate-50/80 transition-colors"
              >
                <!-- Subcontractor Name -->
                <td class="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs shrink-0">
                      {{ (sub.name || 'S').charAt(0).toUpperCase() }}
                    </span>
                    <div>
                      <p class="font-bold text-slate-900">{{ sub.name }}</p>
                      <p class="text-[10px] text-slate-400">{{ sub.email }}</p>
                    </div>
                  </div>
                </td>

                <!-- PAN & Ledger Head -->
                <td class="py-2.5 px-3">
                  <span v-if="sub.panNumber" class="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded font-bold text-slate-700">
                    {{ sub.panNumber }}
                  </span>
                  <span v-else class="text-[10px] text-amber-700 font-medium">No PAN (20% TDS)</span>
                  <p class="text-[10px] text-slate-500 truncate max-w-[180px] mt-0.5">
                    {{ sub.linkedLedgerHead }}
                  </p>
                </td>

                <!-- Gross Paid -->
                <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                  ₹{{ formatCurrency(sub.grossPaid) }}
                </td>

                <!-- TDS Withheld -->
                <td class="py-2.5 px-3 text-right font-mono font-bold text-indigo-700 whitespace-nowrap">
                  ₹{{ formatCurrency(sub.tdsWithheld) }}
                </td>

                <!-- Net Paid -->
                <td class="py-2.5 px-3 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                  ₹{{ formatCurrency(sub.netPaid) }}
                </td>

                <!-- Site Burn -->
                <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                  ₹{{ formatCurrency(sub.totalSiteExpense) }}
                  <span class="text-[10px] text-slate-400 block font-normal">({{ sub.slipsCount }} slips)</span>
                </td>

                <!-- Live Wallet Float -->
                <td class="py-2.5 px-3 text-right whitespace-nowrap">
                  <span
                    class="font-mono font-black text-xs block"
                    :class="sub.isDeficit ? 'text-rose-700' : 'text-emerald-700'"
                  >
                    ₹{{ formatCurrency(Math.abs(sub.liveFloat)) }}
                  </span>
                  <span
                    class="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-full"
                    :class="sub.isDeficit ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'"
                  >
                    {{ sub.isDeficit ? 'Deficit' : 'In Hand' }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="py-2.5 px-3 text-center whitespace-nowrap">
                  <div class="flex items-center justify-center gap-1.5">
                    <button
                      @click="openPayoutModal(sub)"
                      class="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer flex items-center gap-1 border-0"
                    >
                      <span>💵 Pay</span>
                    </button>

                    <button
                      @click="openSlipsModal(sub)"
                      class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer border border-slate-200"
                      title="View Site Slips"
                    >
                      <span>🔍 Slips</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MOBILE VIEW: Compact Cards (Visible on Mobile, Hidden on sm:) -->
        <div v-if="filteredSubcontractors.length > 0" class="sm:hidden divide-y divide-slate-100">
          <div
            v-for="sub in filteredSubcontractors"
            :key="sub.subcontractorId"
            class="p-3.5 space-y-2.5"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs shrink-0">
                  {{ (sub.name || 'S').charAt(0).toUpperCase() }}
                </span>
                <div>
                  <h4 class="text-xs font-bold text-slate-900">{{ sub.name }}</h4>
                  <p class="text-[10px] text-slate-400 font-mono">{{ sub.panNumber || 'No PAN' }} • {{ sub.email }}</p>
                </div>
              </div>

              <div class="text-right">
                <span class="text-xs font-black font-mono block" :class="sub.isDeficit ? 'text-rose-700' : 'text-emerald-700'">
                  ₹{{ formatCurrency(Math.abs(sub.liveFloat)) }}
                </span>
                <span class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full" :class="sub.isDeficit ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'">
                  {{ sub.isDeficit ? 'Deficit' : 'In Hand' }}
                </span>
              </div>
            </div>

            <!-- Financial Strip -->
            <div class="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded-lg text-center font-mono text-[10px]">
              <div>
                <span class="text-slate-400 block text-[9px]">GROSS</span>
                <span class="font-bold text-slate-800">₹{{ formatCurrency(sub.grossPaid) }}</span>
              </div>
              <div>
                <span class="text-indigo-600 block text-[9px]">TDS 194C</span>
                <span class="font-bold text-indigo-700">₹{{ formatCurrency(sub.tdsWithheld) }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-[9px]">SITE BURN</span>
                <span class="font-bold text-slate-800">₹{{ formatCurrency(sub.totalSiteExpense) }}</span>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-1">
              <button
                @click="openSlipsModal(sub)"
                class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200"
              >
                🔍 View Slips ({{ sub.slipsCount }})
              </button>
              <button
                @click="openPayoutModal(sub)"
                class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold border-0 shadow-xs"
              >
                💵 Record Payout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payout Modal with Live TDS Preview -->
    <div
      v-if="showPayoutModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-3.5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-sm sm:text-base font-black text-slate-900">
              💵 Process Subcontractor Payout with TDS
            </h3>
            <p class="text-xs text-slate-500">
              Contractor: <strong class="text-slate-800">{{ activeSubcontractor?.name }}</strong>
            </p>
          </div>
          <button @click="showPayoutModal = false" class="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
        </div>

        <form @submit.prevent="handlePayoutSubmit" class="space-y-3 text-xs">
          <!-- Amount -->
          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Disbursement Amount (₹) *
            </label>
            <input
              v-model.number="payoutForm.amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="Enter payment amount"
              class="w-full px-3 py-2 text-lg font-black rounded-xl bg-slate-50 border border-slate-300 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <!-- TDS Mode & Rate -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                TDS Mode u/s 194C
              </label>
              <select
                v-model="payoutForm.tdsMode"
                class="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="DEDUCT">Standard Deduction</option>
                <option value="GROSS_UP">Gross-Up (Sec 195A)</option>
                <option value="NONE">No TDS (None)</option>
              </select>
            </div>

            <div>
              <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                TDS Rate (%)
              </label>
              <input
                v-model.number="payoutForm.ratePercent"
                type="number"
                step="0.1"
                min="0"
                class="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <!-- Interactive Calculation Preview -->
          <div class="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 space-y-1 text-xs">
            <div class="flex justify-between">
              <span class="text-slate-600">Gross Direct Expense to Book:</span>
              <strong class="font-mono text-slate-900">₹{{ formatCurrency(computedPayout.grossAmount) }}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-indigo-800">TDS 194C Withheld (Payable to Govt):</span>
              <strong class="font-mono text-indigo-700">₹{{ formatCurrency(computedPayout.tdsAmount) }}</strong>
            </div>
            <div class="flex justify-between border-t border-indigo-200 pt-1 text-xs font-bold">
              <span class="text-emerald-900">Net Disbursed to Contractor:</span>
              <strong class="font-mono text-emerald-700 text-sm">₹{{ formatCurrency(computedPayout.netPayout) }}</strong>
            </div>
          </div>

          <!-- Payment Mode & Bank Account -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Payment Mode
              </label>
              <select
                v-model="payoutForm.paymentMode"
                class="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="BANK">Bank Transfer / NEFT</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash in Hand</option>
              </select>
            </div>

            <div v-if="payoutForm.paymentMode !== 'CASH'">
              <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Disbursing Bank Account *
              </label>
              <select
                v-model="payoutForm.bankAccountId"
                required
                class="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option v-for="b in bankAccounts" :key="b._id" :value="b._id">
                  {{ b.bank_name || b.account_name }} ({{ b.account_number?.slice(-4) }})
                </option>
              </select>
            </div>
          </div>

          <!-- Date & Narration -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Payment Date
              </label>
              <input
                v-model="payoutForm.paymentDate"
                type="date"
                required
                class="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Narration / Reference
              </label>
              <input
                v-model="payoutForm.narration"
                type="text"
                placeholder="e.g. Stage 1 excavation settlement"
                class="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-2">
            <button
              type="submit"
              :disabled="payoutSubmitting || !payoutForm.amount || payoutForm.amount <= 0"
              class="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-xs shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer border-0"
            >
              <span v-if="payoutSubmitting">Posting Payment to GL...</span>
              <span v-else>Confirm & Post Payout (₹{{ formatCurrency(computedPayout.netPayout) }})</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Slips Drill-Down Modal -->
    <div
      v-if="showSlipsModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl p-5 space-y-3.5 max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-sm sm:text-base font-black text-slate-900">
              📋 Site Slips: {{ activeSubcontractor?.name }}
            </h3>
            <p class="text-xs text-slate-500">
              Off-Core Sandbox (Zero impact on Core General Ledger)
            </p>
          </div>
          <button @click="showSlipsModal = false" class="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
        </div>

        <!-- Modal Total Slips Banner -->
        <div v-if="subcontractorSlips.length > 0" class="flex items-center justify-between p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs">
          <span class="text-indigo-900 font-bold">
            Total Slips ({{ subcontractorSlips.length }} recorded):
          </span>
          <span class="font-black font-mono text-sm text-indigo-700">
            ₹{{ formatCurrency(totalModalSlipsAmount) }}
          </span>
        </div>

        <div class="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[55vh]">
          <div v-if="slipsLoading" class="text-center py-10 text-slate-400 text-xs">
            Loading contractor slips...
          </div>
          <div v-else-if="subcontractorSlips.length === 0" class="text-center py-10 text-slate-400 text-xs">
            No site slips recorded by this contractor yet.
          </div>
          <div
            v-else
            v-for="slip in subcontractorSlips"
            :key="slip._id"
            class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs hover:border-indigo-300 transition"
          >
            <div class="flex items-start gap-2.5">
              <span class="text-xl p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                {{ getCategoryIcon(slip.category) }}
              </span>
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-bold text-slate-900 text-xs">
                    {{ slip.vendorOrPayee || getCategoryLabel(slip.category) }}
                  </span>
                  <span class="text-[10px] text-slate-400 font-mono">• {{ slip.expenseDate }}</span>
                  <span class="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-slate-200 text-slate-700">
                    {{ slip.paymentMode }}
                  </span>
                </div>
                <p v-if="slip.notes" class="text-[11px] text-slate-500 mt-0.5">
                  {{ slip.notes }}
                </p>
                <p v-if="slip.billOrSlipRef" class="text-[10px] text-indigo-700 font-mono mt-0.5 font-bold">
                  Slip #{{ slip.billOrSlipRef }}
                </p>
              </div>
            </div>
            <div class="text-right font-mono font-black text-sm text-slate-900 shrink-0 pl-2">
              ₹{{ formatCurrency(slip.amount) }}
            </div>
          </div>
        </div>

        <div class="border-t border-slate-100 pt-3 text-right">
          <button
            @click="showSlipsModal = false"
            class="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Register Subcontractor Modal -->
    <div
      v-if="showRegisterModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-3.5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 class="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
              <span>🏗️ Register New Subcontractor</span>
            </h3>
            <p class="text-xs text-slate-500">
              Provisions Direct Expense COA & Sandboxed Wallet
            </p>
          </div>
          <button @click="showRegisterModal = false" class="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
        </div>

        <!-- Info Card -->
        <div class="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200 text-[11px] text-indigo-900 leading-snug">
          System will automatically provision a dedicated Direct Expense head <code class="font-mono font-bold bg-indigo-100 px-1 rounded">Subcontract - {{ registerForm.name || 'Contractor' }}</code> in Chart of Accounts (P&L).
        </div>

        <form @submit.prevent="handleRegisterSubmit" class="space-y-3 text-xs">
          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Contractor / Business Name *
            </label>
            <input
              v-model="registerForm.name"
              type="text"
              required
              placeholder="e.g. Vikram Earthmovers & Transport"
              class="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Email Address * (For Portal Login)
            </label>
            <input
              v-model="registerForm.email"
              type="email"
              required
              placeholder="contractor@example.com"
              class="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Password (for new user)
            </label>
            <input
              v-model="registerForm.password"
              type="password"
              placeholder="Minimum 8 characters (auto-generated if blank)"
              class="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Income Tax PAN (Optional, for 194C TDS Rate)
            </label>
            <input
              v-model="registerForm.panNumber"
              type="text"
              placeholder="e.g. ABCDE1234F (1% Indv, 2% Co, 20% None)"
              class="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white uppercase font-mono"
            />
          </div>

          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
              Assigned Sites / Projects (Optional, comma-separated)
            </label>
            <input
              v-model="registerForm.assignedProjectIds"
              type="text"
              placeholder="e.g. Metro-Site-4, Flyover-North"
              class="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div class="pt-2 flex justify-end gap-2">
            <button
              type="button"
              @click="showRegisterModal = false"
              class="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="registerSubmitting || !registerForm.name || !registerForm.email"
              class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-xs transition disabled:opacity-50 cursor-pointer border-0"
            >
              <span v-if="registerSubmitting">Registering...</span>
              <span v-else>Register & Provision</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useAuth } from '../../composables/useAuth';

const { apiFetch, selectedFirmId } = useAuth();

const loading = ref(false);
const error = ref<string | null>(null);
const subcontractors = ref<any[]>([]);
const summary = ref<any>({});
const searchQuery = ref('');

const bankAccounts = ref<any[]>([]);

// Payout Modal State
const showPayoutModal = ref(false);
const payoutSubmitting = ref(false);
const activeSubcontractor = ref<any>(null);

// Register Subcontractor Modal State
const showRegisterModal = ref(false);
const registerSubmitting = ref(false);
const registerForm = reactive({
  name: '',
  email: '',
  password: '',
  panNumber: '',
  assignedProjectIds: ''
});

const openRegisterModal = () => {
  registerForm.name = '';
  registerForm.email = '';
  registerForm.password = '';
  registerForm.panNumber = '';
  registerForm.assignedProjectIds = '';
  showRegisterModal.value = true;
};

const handleRegisterSubmit = async () => {
  if (!registerForm.name || !registerForm.email) return;
  registerSubmitting.value = true;
  try {
    const payload: any = {
      name: registerForm.name.trim(),
      email: registerForm.email.trim().toLowerCase(),
      grade: 'Subcontractor',
      password: registerForm.password || undefined,
      panNumber: registerForm.panNumber ? registerForm.panNumber.trim().toUpperCase() : undefined
    };
    if (registerForm.assignedProjectIds) {
      payload.assignedProjectIds = registerForm.assignedProjectIds
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    const res: any = await apiFetch(`/api/firms/${selectedFirmId.value}/members`, {
      method: 'POST',
      body: payload
    });

    showRegisterModal.value = false;
    await loadData();
    alert(res?.message || 'Subcontractor registered successfully! Direct Expense head auto-provisioned in Chart of Accounts.');
  } catch (err: any) {
    alert(err?.data?.statusMessage || err?.message || 'Failed to register subcontractor');
  } finally {
    registerSubmitting.value = false;
  }
};

const payoutForm = reactive({
  amount: 0,
  tdsMode: 'DEDUCT',
  ratePercent: 1,
  paymentMode: 'BANK',
  bankAccountId: '',
  paymentDate: new Date().toISOString().split('T')[0],
  narration: ''
});

// Slips Drill-Down Modal State
const showSlipsModal = ref(false);
const slipsLoading = ref(false);
const subcontractorSlips = ref<any[]>([]);

const CATEGORY_MAP: Record<string, { label: string; icon: string }> = {
  LABOR: { label: 'Labor', icon: '👷' },
  MATERIAL: { label: 'Material', icon: '🧱' },
  FUEL_DIESEL: { label: 'Fuel/Diesel', icon: '⛽' },
  MACHINERY_RENTAL: { label: 'Machinery', icon: '🚜' },
  TRANSPORT: { label: 'Transport', icon: '🚚' },
  FOOD_WELFARE: { label: 'Food/Tea', icon: '☕' },
  REPAIRS: { label: 'Repairs', icon: '🔧' },
  OTHER: { label: 'Other', icon: '📦' }
};

const getCategoryIcon = (cat: string) => CATEGORY_MAP[cat]?.icon || '📦';
const getCategoryLabel = (cat: string) => CATEGORY_MAP[cat]?.label || cat;

const totalModalSlipsAmount = computed(() => {
  return subcontractorSlips.value.reduce((acc, curr: any) => acc + (curr.amount || 0), 0);
});

const formatCurrency = (val: number) => {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const filteredSubcontractors = computed(() => {
  if (!searchQuery.value) return subcontractors.value;
  const q = searchQuery.value.toLowerCase();
  return subcontractors.value.filter(s =>
    s.name?.toLowerCase().includes(q) ||
    s.panNumber?.toLowerCase().includes(q) ||
    s.linkedLedgerHead?.toLowerCase().includes(q)
  );
});

// Live Payout Calculation Preview
const computedPayout = computed(() => {
  const amount = Number(payoutForm.amount) || 0;
  const rate = Number(payoutForm.ratePercent) || 0;
  const r = rate / 100;

  if (amount <= 0 || r <= 0 || payoutForm.tdsMode === 'NONE') {
    return { grossAmount: amount, tdsAmount: 0, netPayout: amount };
  }

  if (payoutForm.tdsMode === 'GROSS_UP') {
    const gross = amount / (1 - r);
    const tds = gross - amount;
    return {
      grossAmount: Number(gross.toFixed(2)),
      tdsAmount: Number(tds.toFixed(2)),
      netPayout: amount
    };
  } else {
    const tds = amount * r;
    const net = amount - tds;
    return {
      grossAmount: amount,
      tdsAmount: Number(tds.toFixed(2)),
      netPayout: Number(net.toFixed(2))
    };
  }
});

const loadData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await apiFetch<any>('/api/accounting/subcontractor-wallets');
    if (res && res.success) {
      subcontractors.value = res.subcontractors || [];
      summary.value = res.summary || {};
    }

    // Also fetch bank accounts for payouts
    const bankRes = await apiFetch<any>('/api/banking');
    if (bankRes && bankRes.data) {
      bankAccounts.value = bankRes.data;
      if (bankAccounts.value.length > 0 && !payoutForm.bankAccountId) {
        payoutForm.bankAccountId = bankAccounts.value[0]._id;
      }
    }
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || 'Failed to load subcontractor data';
  } finally {
    loading.value = false;
  }
};

const openPayoutModal = (sub: any) => {
  activeSubcontractor.value = sub;
  payoutForm.amount = 0;
  payoutForm.tdsMode = 'DEDUCT';

  // Determine standard rate based on PAN
  const pan = sub.panNumber || '';
  if (!pan) {
    payoutForm.ratePercent = 20; // 206AA
  } else {
    const fourth = pan.charAt(3)?.toUpperCase();
    payoutForm.ratePercent = (fourth === 'P' || fourth === 'H') ? 1 : 2;
  }

  payoutForm.paymentDate = new Date().toISOString().split('T')[0];
  payoutForm.narration = `Subcontract payout to ${sub.name}`;
  showPayoutModal.value = true;
};

const handlePayoutSubmit = async () => {
  if (!payoutForm.amount || payoutForm.amount <= 0) return;
  payoutSubmitting.value = true;

  try {
    await apiFetch('/api/accounting/subcontractor-payout', {
      method: 'POST',
      body: {
        firmId: selectedFirmId.value,
        subcontractorUserId: activeSubcontractor.value.subcontractorId,
        amount: payoutForm.amount,
        tdsMode: payoutForm.tdsMode,
        ratePercent: payoutForm.ratePercent,
        paymentMode: payoutForm.paymentMode,
        bankAccountId: payoutForm.paymentMode !== 'CASH' ? payoutForm.bankAccountId : undefined,
        paymentDate: payoutForm.paymentDate,
        narration: payoutForm.narration
      }
    });

    showPayoutModal.value = false;
    await loadData();
    alert('Payout posted successfully to Core GL with TDS deduction!');
  } catch (err: any) {
    alert(err?.data?.statusMessage || err?.message || 'Failed to process payout');
  } finally {
    payoutSubmitting.value = false;
  }
};

const openSlipsModal = async (sub: any) => {
  activeSubcontractor.value = sub;
  showSlipsModal.value = true;
  slipsLoading.value = true;
  try {
    const res = await apiFetch<any>(`/api/subcontractor/expenses?subcontractorId=${sub.subcontractorId}`);
    if (res && res.success) {
      subcontractorSlips.value = res.expenses || [];
    }
  } catch (err) {
    subcontractorSlips.value = [];
  } finally {
    slipsLoading.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>
