<template>
  <div class="max-w-2xl mx-auto space-y-5">
    
    <!-- Top Bar: Navigation & Page Header -->
    <div class="flex items-center justify-between bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700">
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/subcontractor/wallet"
          class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center no-underline"
          title="Back to Wallet"
        >
          ←
        </NuxtLink>
        <div>
          <h1 class="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {{ isEditing ? '✏️ Edit Site Slip' : '➕ Record Site Slip' }}
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Contractor site sandbox (Zero impact on Core Books / GL)
          </p>
        </div>
      </div>

      <NuxtLink
        to="/subcontractor/expenses"
        class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline no-underline"
      >
        View All Slips →
      </NuxtLink>
    </div>

    <!-- Error Notice -->
    <div v-if="error" class="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex justify-between shadow-sm">
      <div class="flex items-center gap-2">
        <span>⚠️</span>
        <span>{{ error }}</span>
      </div>
      <button @click="error = null" class="font-bold text-red-500 hover:text-red-700 cursor-pointer">✕</button>
    </div>

    <!-- Expense Slip Form -->
    <form @submit.prevent="handleSubmit" class="space-y-5">
      
      <!-- Amount Card -->
      <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-6 sm:p-8 text-center">
        <label class="text-xs uppercase font-bold tracking-wider text-slate-400 block mb-2">
          Slip Expense Amount (₹) *
        </label>
        
        <div class="flex items-center justify-center gap-1.5">
          <span class="text-3xl sm:text-4xl font-black text-slate-400">₹</span>
          <input
            v-model.number="form.amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            class="w-56 sm:w-72 text-center text-4xl sm:text-5xl font-black text-slate-900 dark:text-white bg-transparent outline-none border-b-2 border-indigo-500 focus:border-amber-400 transition"
          />
        </div>

        <!-- Quick Increment Pills -->
        <div class="flex items-center justify-center gap-2 mt-4 flex-wrap">
          <button
            v-for="inc in [500, 1000, 2000, 5000]"
            :key="inc"
            type="button"
            @click="addAmount(inc)"
            class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition active:scale-95 cursor-pointer"
          >
            +₹{{ inc }}
          </button>
          <button
            type="button"
            @click="form.amount = 0"
            class="px-3 py-1.5 rounded-xl text-slate-400 text-xs hover:text-red-500 transition cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Category Selector Grid -->
      <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 sm:p-6">
        <label class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-3">
          Select Category *
        </label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            v-for="cat in CATEGORIES"
            :key="cat.key"
            type="button"
            @click="form.category = cat.key"
            class="p-3 rounded-2xl border text-left flex items-center gap-2.5 transition active:scale-95 cursor-pointer"
            :class="form.category === cat.key ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700/50'"
          >
            <span class="text-xl sm:text-2xl">{{ cat.icon }}</span>
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{{ cat.label }}</span>
          </button>
        </div>
      </div>

      <!-- Date & Payment Mode -->
      <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 sm:p-6 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Expense Date *
            </label>
            <input
              v-model="form.expenseDate"
              type="date"
              required
              class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div>
            <label class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Payment Mode *
            </label>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="mode in ['CASH', 'UPI', 'BANK']"
                :key="mode"
                type="button"
                @click="form.paymentMode = mode as any"
                class="py-2.5 rounded-2xl text-xs font-bold border transition text-center cursor-pointer"
                :class="form.paymentMode === mode ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'"
              >
                {{ mode }}
              </button>
            </div>
          </div>
        </div>

        <!-- Vendor / Payee Name -->
        <div>
          <label class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
            Vendor / Payee / Driver / Coolie Name
          </label>
          <input
            v-model="form.vendorOrPayee"
            type="text"
            placeholder="e.g. HPCL Petrol Bunk, Babu Coolie Leader, Sri Balaji Hardware"
            class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <!-- Bill / Slip Ref & Notes -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Chit / Slip / Bill No (Optional)
            </label>
            <input
              v-model="form.billOrSlipRef"
              type="text"
              placeholder="e.g. Slip #492"
              class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 font-mono transition"
            />
          </div>
          <div>
            <label class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Notes / Scope of Expense
            </label>
            <input
              v-model="form.notes"
              type="text"
              placeholder="e.g. 100L Diesel for JCB #02"
              class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
        </div>
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        :disabled="isSubmitting || !form.amount || form.amount <= 0"
        class="w-full py-4 rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm sm:text-base shadow-xl hover:shadow-2xl transition transform active:scale-98 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
      >
        <span v-if="isSubmitting">Saving Site Slip...</span>
        <span v-else>{{ isEditing ? '💾 Update Site Slip' : '💾 Save Slip in My Wallet' }}</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from '#app';
import { useSubcontractorWallet, type SubcontractorSlip } from '../../composables/useSubcontractorWallet';

definePageMeta({
  layout: 'subcontractor'
});

const router = useRouter();
const route = useRoute();
const { addSlip, updateSlip, expensesList, fetchExpenses } = useSubcontractorWallet();

const isEditing = ref(false);
const editingId = ref<string | null>(null);
const isSubmitting = ref(false);
const error = ref<string | null>(null);

const CATEGORIES: Array<{ key: SubcontractorSlip['category']; label: string; icon: string }> = [
  { key: 'LABOR', label: 'Labor / Coolie', icon: '👷' },
  { key: 'FUEL_DIESEL', label: 'Fuel / Diesel', icon: '⛽' },
  { key: 'MATERIAL', label: 'Local Material', icon: '🧱' },
  { key: 'MACHINERY_RENTAL', label: 'Machinery Hire', icon: '🚜' },
  { key: 'TRANSPORT', label: 'Transport / Freight', icon: '🚚' },
  { key: 'FOOD_WELFARE', label: 'Tea & Food', icon: '☕' },
  { key: 'REPAIRS', label: 'Site Repairs', icon: '🔧' },
  { key: 'OTHER', label: 'Other', icon: '📦' }
];

const form = reactive<{
  amount: number;
  category: SubcontractorSlip['category'];
  expenseDate: string;
  paymentMode: 'CASH' | 'UPI' | 'BANK';
  vendorOrPayee: string;
  notes: string;
  billOrSlipRef: string;
}>({
  amount: 0,
  category: 'LABOR',
  expenseDate: new Date().toISOString().split('T')[0],
  paymentMode: 'CASH',
  vendorOrPayee: '',
  notes: '',
  billOrSlipRef: ''
});

const addAmount = (val: number) => {
  form.amount = Number(((form.amount || 0) + val).toFixed(2));
};

onMounted(async () => {
  const queryId = route.query.id as string;
  if (queryId) {
    isEditing.value = true;
    editingId.value = queryId;
    if (expensesList.value.length === 0) {
      await fetchExpenses();
    }
    const found = expensesList.value.find((e: any) => e._id === queryId);
    if (found) {
      form.amount = found.amount;
      form.category = found.category;
      form.expenseDate = found.expenseDate;
      form.paymentMode = found.paymentMode;
      form.vendorOrPayee = found.vendorOrPayee || '';
      form.notes = found.notes || '';
      form.billOrSlipRef = found.billOrSlipRef || '';
    }
  }
});

const handleSubmit = async () => {
  if (!form.amount || form.amount <= 0) {
    error.value = 'Please enter an amount greater than zero';
    return;
  }

  isSubmitting.value = true;
  error.value = null;

  try {
    if (isEditing.value && editingId.value) {
      await updateSlip(editingId.value, form);
    } else {
      await addSlip(form);
    }
    router.push('/subcontractor/wallet');
  } catch (err: any) {
    error.value = err?.data?.statusMessage || err?.message || 'Failed to save slip';
  } finally {
    isSubmitting.value = false;
  }
};
</script>
