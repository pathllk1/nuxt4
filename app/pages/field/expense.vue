<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 pb-16">
    <!-- Header -->
    <div class="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-md">
      <div class="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/field/wallet"
            class="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer text-white no-underline"
            title="Back to Wallet"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </NuxtLink>
          <div>
            <h1 class="text-xl font-extrabold tracking-tight">Log Field Expense</h1>
            <p class="text-xs text-emerald-100">Submit site expenditure for office approval</p>
          </div>
        </div>

        <NuxtLink
          to="/field/claims"
          class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition text-white no-underline"
        >
          View Claims
        </NuxtLink>
      </div>
    </div>

    <!-- Form Container -->
    <div class="max-w-2xl mx-auto px-4 mt-6">
      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Error Banner -->
        <div v-if="formError" class="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <span>{{ formError }}</span>
          <button type="button" @click="formError = null" class="font-bold text-red-500 hover:text-red-700">✕</button>
        </div>

        <!-- Success Banner -->
        <div v-if="successMsg" class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span>✅</span>
            <span>{{ successMsg }}</span>
          </div>
        </div>

        <!-- Step 1: Category Selection Grid -->
        <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Select Expense Category <span class="text-red-500">*</span>
          </label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <button
              v-for="cat in categories"
              :key="cat.value"
              type="button"
              @click="form.category = cat.value"
              class="p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer"
              :class="form.category === cat.value
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'"
            >
              <span class="text-xl shrink-0">{{ cat.icon }}</span>
              <span class="text-xs font-bold leading-tight">{{ cat.label }}</span>
            </button>
          </div>
        </div>

        <!-- Step 2: Amount & Sec 40A(3) Guard -->
        <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700">
          <div class="flex items-center justify-between mb-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Expense Amount (₹) <span class="text-red-500">*</span>
            </label>
            <span class="text-xs text-slate-400">Indian Rupees</span>
          </div>

          <div class="relative">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">₹</span>
            <input
              v-model.number="form.amount"
              type="number"
              step="0.01"
              min="1"
              placeholder="0.00"
              required
              class="w-full pl-10 pr-4 py-3.5 text-2xl font-black rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              :class="{ 'border-amber-400 ring-2 ring-amber-400/20': isCashLimitExceeded }"
            />
          </div>

          <!-- Quick Increment Buttons -->
          <div class="flex flex-wrap gap-2 mt-3">
            <button
              v-for="amt in [100, 200, 500, 1000, 2000, 5000]"
              :key="amt"
              type="button"
              @click="addAmount(amt)"
              class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              +₹{{ amt }}
            </button>
            <button
              v-if="form.amount"
              type="button"
              @click="form.amount = 0"
              class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 hover:bg-red-100 transition cursor-pointer"
            >
              Reset
            </button>
          </div>

          <!-- Statutory Cash Limit Warning (Section 40A(3)) -->
          <div
            v-if="isCashLimitExceeded"
            class="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 text-xs flex gap-2.5"
          >
            <span class="text-base shrink-0">⚠️</span>
            <div>
              <p class="font-bold">Sec 40A(3) Income Tax Statutory Warning:</p>
              <p class="mt-0.5 leading-relaxed">
                Cash expenditure exceeding ₹10,000 per person per day is disallowed for tax deductions. Please switch the payment mode to <strong>UPI</strong> or <strong>NEFT</strong>, or obtain an authorized voucher splitting note.
              </p>
            </div>
          </div>
        </div>

        <!-- Step 3: Payment Mode & Date -->
        <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700 space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Payment Mode <span class="text-red-500">*</span>
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="mode in paymentModes"
                :key="mode.value"
                type="button"
                @click="form.paymentMode = mode.value"
                class="py-2.5 px-3 rounded-xl border text-center text-xs font-bold transition cursor-pointer"
                :class="form.paymentMode === mode.value
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'"
              >
                {{ mode.label }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Expense Date <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.expenseDate"
                type="date"
                required
                class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Payee / Vendor / Person Name
              </label>
              <input
                v-model="form.partyOrPayeeName"
                type="text"
                placeholder="e.g. Ramesh Hardware, Raju (Worker)"
                class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Project / Site Tag (Optional)
            </label>
            <input
              v-model="form.projectId"
              type="text"
              placeholder="e.g. Tower-B, Site-42, Foundation"
              class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <!-- Step 4: Narration & Proof Description -->
        <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Narration / Purpose Details <span class="text-red-500">*</span>
          </label>
          <textarea
            v-model="form.narration"
            rows="3"
            required
            placeholder="Describe what this expense was for (e.g. 5 bags cement, worker evening tea, emergency tempo freight)"
            class="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          ></textarea>
        </div>

        <!-- Submit Button -->
        <div class="pt-2">
          <button
            type="submit"
            :disabled="submitting || !form.category || !form.amount"
            class="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-base shadow-lg transition transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer border-0"
          >
            <svg v-if="submitting" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span v-if="submitting">Submitting Claim...</span>
            <span v-else>🚀 Submit Claim for Review</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter } from '#app';
import { useSiteWallet } from '~/composables/useSiteWallet';

definePageMeta({
  layout: 'default'
});

const router = useRouter();
const { submitExpense } = useSiteWallet();

const submitting = ref(false);
const formError = ref<string | null>(null);
const successMsg = ref<string | null>(null);

const categories = [
  { value: 'LABOUR', label: 'Daily Labour', icon: '👷' },
  { value: 'WELFARE', label: 'Tea & Tiffin', icon: '☕' },
  { value: 'MATERIAL', label: 'Site Material', icon: '🧱' },
  { value: 'TRANSPORT', label: 'Transport / Tempo', icon: '🚚' },
  { value: 'FUEL', label: 'Fuel & Diesel', icon: '⛽' },
  { value: 'REPAIRS', label: 'Site Repairs', icon: '🔧' },
  { value: 'OTHER', label: 'Other Expense', icon: '📦' }
];

const paymentModes = [
  { value: 'CASH', label: '💵 Cash' },
  { value: 'UPI', label: '📱 UPI' },
  { value: 'NEFT', label: '🏦 Bank / NEFT' }
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

const addAmount = (amt: number) => {
  form.amount = (form.amount || 0) + amt;
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
      }, 1200);
    }
  } catch (err: any) {
    formError.value = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Failed to submit expense';
  } finally {
    submitting.value = false;
  }
};
</script>
