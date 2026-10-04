<template>
  <div class="min-h-screen bg-slate-50/80 pb-16 font-sans text-slate-800">
    <!-- Top Full-Width Header Banner -->
    <div class="bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-800 text-white shadow-md">
      <div class="w-full px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/field/wallet"
            class="p-2 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 transition text-white no-underline border border-white/20 shadow-xs flex items-center justify-center"
            title="Back to Field Wallet"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </NuxtLink>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-base sm:text-lg font-black tracking-tight">Record Site Daily Expense</h1>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                Imprest Slip
              </span>
            </div>
            <p class="text-xs text-emerald-100 mt-0.5">Submit petty cash voucher for head-office audit & reimbursement</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <NuxtLink
            to="/chat"
            class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition text-white no-underline border border-white/20"
          >
            <span>💬</span>
            <span>1-on-1 Chat</span>
          </NuxtLink>

          <NuxtLink
            to="/field/claims"
            class="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition text-white no-underline border border-white/25 shadow-xs"
          >
            <span>📋</span>
            <span>My Claims</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Main Full-Width Form Workspace -->
    <div class="w-full px-4 sm:px-6 lg:px-8 mt-4">
      <!-- Error & Success Alerts -->
      <div v-if="formError" class="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2">
          <span>⚠️</span>
          <span>{{ formError }}</span>
        </div>
        <button type="button" @click="formError = null" class="font-bold text-red-500 hover:text-red-700">✕</button>
      </div>

      <div v-if="successMsg" class="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs">
        <span>✅</span>
        <span>{{ successMsg }}</span>
      </div>

      <form @submit.prevent="handleSubmit">
        <!-- 2-Column Desktop Grid (8 cols input form, 4 cols live voucher ticket & submit) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <!-- Left Column (8 cols): Input Steps -->
          <div class="lg:col-span-8 space-y-4">
            <!-- Step 1: Category Selection Grid -->
            <div class="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
              <div class="flex items-center justify-between mb-3">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>1. Select Expense Category</span>
                  <span class="text-red-500">*</span>
                </label>
                <span class="text-[11px] text-slate-400">Head-office account auto-mapped</span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2">
                <button
                  v-for="cat in categories"
                  :key="cat.value"
                  type="button"
                  @click="form.category = cat.value"
                  class="p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer"
                  :class="form.category === cat.value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-xs ring-2 ring-emerald-500/20 font-bold'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium'"
                >
                  <span class="text-xl shrink-0">{{ cat.icon }}</span>
                  <div class="min-w-0">
                    <span class="text-xs leading-tight block truncate">{{ cat.label }}</span>
                    <span class="text-[10px] text-slate-400 block font-normal truncate">{{ cat.subtext }}</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Step 2: Amount, Payment Mode & Date in Compact Multi-Column Grid -->
            <div class="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>2. Amount & Payment Details</span>
                  <span class="text-red-500">*</span>
                </label>
                <span class="text-xs text-slate-400 font-mono">Currency: INR (₹)</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <!-- Amount Input -->
                <div class="sm:col-span-6 space-y-2">
                  <label class="block text-xs font-bold text-slate-700">
                    Expense Amount (₹) <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">₹</span>
                    <input
                      v-model.number="form.amount"
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="0.00"
                      required
                      class="w-full pl-9 pr-3 py-2.5 text-xl font-black rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                      :class="{ 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20': isCashLimitExceeded }"
                    />
                  </div>

                  <!-- Quick Increment Chips -->
                  <div class="flex flex-wrap gap-1.5 pt-1">
                    <button
                      v-for="amt in [100, 200, 500, 1000, 2000, 5000]"
                      :key="amt"
                      type="button"
                      @click="addAmount(amt)"
                      class="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
                    >
                      +₹{{ amt }}
                    </button>
                    <button
                      v-if="form.amount"
                      type="button"
                      @click="form.amount = 0"
                      class="px-2 py-0.5 text-[11px] font-bold rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer border border-red-200"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <!-- Payment Mode & Date in 6 cols -->
                <div class="sm:col-span-6 space-y-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">
                      Payment Mode <span class="text-red-500">*</span>
                    </label>
                    <div class="grid grid-cols-3 gap-1.5">
                      <button
                        v-for="mode in paymentModes"
                        :key="mode.value"
                        type="button"
                        @click="form.paymentMode = mode.value"
                        class="py-2 px-2 rounded-xl border text-center text-xs font-bold transition cursor-pointer"
                        :class="form.paymentMode === mode.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'"
                      >
                        {{ mode.label }}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1.5">
                      Expense Date <span class="text-red-500">*</span>
                    </label>
                    <input
                      v-model="form.expenseDate"
                      type="date"
                      required
                      class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <!-- Statutory Cash Limit Warning (Section 40A(3)) -->
              <div
                v-if="isCashLimitExceeded"
                class="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5 shadow-xs"
              >
                <span class="text-base shrink-0">⚠️</span>
                <div>
                  <p class="font-bold">Sec 40A(3) Income Tax Statutory Alert:</p>
                  <p class="mt-0.5 leading-relaxed text-[11px]">
                    Cash payment exceeds ₹10,000 per vendor/day. Income Tax disallows deductions for cash beyond ₹10,000. Switch to <strong>UPI</strong> or <strong>Bank Transfer</strong>, or submit split vouchers with office approval.
                  </p>
                </div>
              </div>
            </div>

            <!-- Step 3: Payee, Project Tag & Narration Details -->
            <div class="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div class="flex items-center justify-between border-b border-slate-100 pb-2">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>3. Payee & Purpose Details</span>
                  <span class="text-red-500">*</span>
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    Payee / Vendor / Worker Name
                  </label>
                  <input
                    v-model="form.partyOrPayeeName"
                    type="text"
                    placeholder="e.g. Ramesh Hardware, Raju (Mason)"
                    class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">
                    Project / Site / Milestone Tag (Optional)
                  </label>
                  <input
                    v-model="form.projectId"
                    type="text"
                    placeholder="e.g. Tower-B, Site-42, Foundation Slab"
                    class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Narration / Purpose Details <span class="text-red-500">*</span>
                </label>
                <textarea
                  v-model="form.narration"
                  rows="2"
                  required
                  placeholder="Detail what was purchased or paid for (e.g. 5 bags OPC cement, worker evening refreshments, emergency tempo freight)"
                  class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Right Column (4 cols): Live Slip Preview Ticket & Quick Submit Action -->
          <div class="lg:col-span-4 space-y-4">
            <!-- Digital Voucher Ticket Card -->
            <div class="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden border border-teal-500/30">
              <div class="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <div class="flex items-center gap-2">
                  <span class="text-lg">🧾</span>
                  <div>
                    <h3 class="text-xs font-black uppercase tracking-wider text-teal-300">
                      Imprest Slip Preview
                    </h3>
                    <p class="text-[10px] text-white/60">Real-time office voucher</p>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/20 text-teal-300 border border-teal-400/30 font-bold">
                  DRAFT
                </span>
              </div>

              <!-- Ticket Content -->
              <div class="space-y-2.5 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-white/60">Category:</span>
                  <span class="font-bold flex items-center gap-1 text-white">
                    <span>{{ activeCategoryIcon }}</span>
                    <span>{{ activeCategoryLabel }}</span>
                  </span>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-white/60">Amount:</span>
                  <span class="text-lg font-black text-amber-300 font-mono">
                    {{ formatRupees(form.amount || 0) }}
                  </span>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-white/60">Mode:</span>
                  <span class="font-bold text-white uppercase">{{ form.paymentMode }}</span>
                </div>

                <div class="flex items-center justify-between">
                  <span class="text-white/60">Date:</span>
                  <span class="text-white font-mono">{{ form.expenseDate }}</span>
                </div>

                <div v-if="form.partyOrPayeeName" class="flex items-center justify-between truncate">
                  <span class="text-white/60">Payee:</span>
                  <span class="font-semibold text-white truncate max-w-[150px]">{{ form.partyOrPayeeName }}</span>
                </div>

                <div v-if="form.projectId" class="flex items-center justify-between">
                  <span class="text-white/60">Project:</span>
                  <span class="font-semibold text-cyan-300">{{ form.projectId }}</span>
                </div>

                <div class="pt-2 border-t border-white/10">
                  <p class="text-[10px] text-white/50 uppercase font-bold">Narration:</p>
                  <p class="text-xs text-white/90 italic mt-0.5 line-clamp-2">
                    "{{ form.narration || 'No details specified yet...' }}"
                  </p>
                </div>
              </div>

              <!-- Cash In-Hand Impact Simulator -->
              <div class="mt-4 p-3 rounded-xl bg-white/10 border border-white/10 space-y-1">
                <div class="flex items-center justify-between text-[11px] text-white/70">
                  <span>Current Imprest Cash:</span>
                  <span class="font-mono font-bold">{{ formatRupees(wallet?.balance || 0) }}</span>
                </div>
                <div class="flex items-center justify-between text-[11px] text-white/70">
                  <span>This Claim Amount:</span>
                  <span class="font-mono text-amber-300">-{{ formatRupees(form.amount || 0) }}</span>
                </div>
                <div class="flex items-center justify-between text-xs font-bold pt-1 border-t border-white/10 text-emerald-300">
                  <span>Projected Balance:</span>
                  <span class="font-mono">{{ formatRupees(projectedRemainingBalance) }}</span>
                </div>
              </div>

              <!-- Submit Button inside Sticky Column -->
              <div class="mt-4 pt-2">
                <button
                  type="submit"
                  :disabled="submitting || !form.category || !form.amount"
                  class="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm shadow-md transition transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer border-0"
                >
                  <svg v-if="submitting" class="w-4 h-4 animate-spin text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span v-if="submitting">Submitting Claim...</span>
                  <span v-else>🚀 Submit Slip for Audit</span>
                </button>
              </div>
            </div>

            <!-- Helpful Field Tips Card -->
            <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs text-xs space-y-2">
              <h4 class="font-bold text-slate-700 flex items-center gap-1.5">
                <span>💡</span>
                <span>Site Engineer Quick Tips</span>
              </h4>
              <ul class="text-[11px] text-slate-500 space-y-1 pl-4 list-disc">
                <li>Once submitted, claims are reviewed by the office accountant/checker.</li>
                <li>Upon approval, a Journal/Payment voucher is auto-posted in ERP.</li>
                <li>Your live imprest balance reconciles automatically upon approval.</li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from '#app';
import { useSiteWallet } from '~/composables/useSiteWallet';

definePageMeta({
  layout: 'default'
});

const router = useRouter();
const { wallet, fetchWallet, submitExpense } = useSiteWallet();

const submitting = ref(false);
const formError = ref<string | null>(null);
const successMsg = ref<string | null>(null);

const categories = [
  { value: 'LABOUR', label: 'Daily Labour', icon: '👷', subtext: 'Masons, Helpers, Daily wage' },
  { value: 'WELFARE', label: 'Tea & Refreshment', icon: '☕', subtext: 'Site tea, Tiffin, Snacks' },
  { value: 'MATERIAL', label: 'Site Material', icon: '🧱', subtext: 'Hardware, Cement, Sand' },
  { value: 'TRANSPORT', label: 'Cartage / Tempo', icon: '🚚', subtext: 'Local freight, Delivery' },
  { value: 'FUEL', label: 'Fuel & Diesel', icon: '⛽', subtext: 'Generator, Machine diesel' },
  { value: 'REPAIRS', label: 'Site Repairs', icon: '🔧', subtext: 'Tools, Mixer, Machinery' },
  { value: 'OTHER', label: 'General / Sundry', icon: '📦', subtext: 'Miscellaneous site items' }
];

const paymentModes = [
  { value: 'CASH', label: '💵 Cash' },
  { value: 'UPI', label: '📱 UPI' },
  { value: 'NEFT', label: '🏦 Bank' }
];

const todayStr = new Date().toISOString().split('T')[0];

const form = reactive({
  category: 'LABOUR',
  amount: null as number | null,
  paymentMode: 'CASH',
  expenseDate: todayStr,
  partyOrPayeeName: '',
  projectId: '',
  narration: ''
});

const isCashLimitExceeded = computed(() => {
  return form.paymentMode === 'CASH' && (form.amount || 0) > 10000;
});

const activeCategoryIcon = computed(() => {
  return categories.find(c => c.value === form.category)?.icon || '📦';
});

const activeCategoryLabel = computed(() => {
  return categories.find(c => c.value === form.category)?.label || 'General';
});

const projectedRemainingBalance = computed(() => {
  const current = wallet.value?.balance || 0;
  return current - (form.amount || 0);
});

const addAmount = (amt: number) => {
  form.amount = (form.amount || 0) + amt;
};

const formatRupees = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const handleSubmit = async () => {
  formError.value = null;
  successMsg.value = null;

  if (!form.category) {
    formError.value = 'Please select an expense category';
    return;
  }

  if (!form.amount || form.amount <= 0) {
    formError.value = 'Please enter a valid amount greater than 0';
    return;
  }

  if (!form.narration || form.narration.trim().length === 0) {
    formError.value = 'Please enter narration details';
    return;
  }

  submitting.value = true;
  try {
    const res = await submitExpense({
      category: form.category,
      amount: Number(form.amount),
      paymentMode: form.paymentMode,
      expenseDate: form.expenseDate || String(new Date().toISOString().split('T')[0] ?? ''),
      partyOrPayeeName: form.partyOrPayeeName?.trim() || null,
      projectId: form.projectId?.trim() || null,
      narration: form.narration.trim()
    });

    if (res?.success) {
      successMsg.value = 'Expense claim submitted successfully! Staged for office review.';
      setTimeout(() => {
        router.push('/field/claims');
      }, 1100);
    }
  } catch (err: any) {
    formError.value = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Failed to submit expense';
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  fetchWallet();
});
</script>
