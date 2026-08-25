<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useWorkTracker } from '~/composables/useWorkTracker';
import type { ExpenseCategory } from '~/types/work-tracker';

const state = useWorkTracker();

onMounted(async () => {
  await state.firebaseAuth.fetchAuthStatus();
});

const newWorkType = ref('');
const newCategoryName = ref('');
const newCategoryIcon = ref('📦');

const handleConnectGoogle = async () => {
  const res = await state.firebaseAuth.signInWithGoogle();
  if (res.success) {
    state.showToast('Google Account connected successfully!', 'success');
    await state.loadAllData();
  }
};

const handleDisconnectGoogle = async () => {
  if (!confirm('Are you sure you want to disconnect your Google Account from Work Tracker?')) return;
  const ok = await state.firebaseAuth.unlinkGoogle();
  if (ok) {
    state.showToast('Google Account disconnected', 'info');
    await state.loadAllData();
  }
};

const addWorkType = () => {
  const t = newWorkType.value.trim();
  if (!t) return;
  state.customWorkTypes.value.push(t);
  if (typeof window !== 'undefined') {
    localStorage.setItem('customWorkTypes', JSON.stringify(state.customWorkTypes.value));
  }
  newWorkType.value = '';
  state.showToast(`Added work type: ${t}`, 'success');
};

const removeWorkType = (name: string) => {
  state.customWorkTypes.value = state.customWorkTypes.value.filter(i => i !== name);
  if (typeof window !== 'undefined') {
    localStorage.setItem('customWorkTypes', JSON.stringify(state.customWorkTypes.value));
  }
};

const addCategory = () => {
  const n = newCategoryName.value.trim();
  if (!n) return;
  const cat: ExpenseCategory = {
    id: n.toLowerCase().replace(/\s+/g, '_'),
    name: n,
    icon: newCategoryIcon.value || '📦',
    color: '#3b82f6'
  };
  state.customExpenseCategories.value.push(cat);
  if (typeof window !== 'undefined') {
    localStorage.setItem('customExpenseCategories', JSON.stringify(state.customExpenseCategories.value));
  }
  newCategoryName.value = '';
  newCategoryIcon.value = '📦';
  state.showToast(`Added category: ${n}`, 'success');
};

const removeCategory = (id: string) => {
  state.customExpenseCategories.value = state.customExpenseCategories.value.filter(i => i.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem('customExpenseCategories', JSON.stringify(state.customExpenseCategories.value));
  }
};

const exportBackup = () => {
  const dump = {
    firebaseEmail: state.firebaseAuth.linkedEmail.value,
    firebaseUid: state.firebaseAuth.linkedUid.value,
    clients: state.clients.value,
    works: state.works.value,
    payments: state.payments.value,
    wallets: state.wallets.value,
    transfers: state.transfers.value,
    expenses: state.expenses.value,
    receipts: state.receipts.value,
    budgets: state.budgets.value,
    adjustments: state.adjustments.value,
    recurringTemplates: state.recurringTemplates.value,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Work_Tracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
</script>

<template>
  <div class="space-y-3 font-sans text-xs w-full">
    <!-- Google Account & Cloud Database Sync -->
    <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
            <span>🔥</span>
            <span>Google Cloud Database Profile</span>
          </h3>
          <p class="text-[10px] text-gray-500 font-normal">
            Cryptographic identity & private Firestore vault isolation
          </p>
        </div>
        <span
          v-if="state.firebaseAuth.isLinked.value"
          class="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200"
        >
          CONNECTED
        </span>
        <span
          v-else
          class="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200"
        >
          NOT CONNECTED
        </span>
      </div>

      <!-- Connected State Card -->
      <div
        v-if="state.firebaseAuth.isLinked.value"
        class="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">
            👤
          </div>
          <div>
            <div class="text-xs font-bold text-gray-900">
              {{ state.firebaseAuth.linkedEmail.value || 'Google User' }}
            </div>
            <div class="text-[10px] font-mono text-gray-400">
              UID: {{ state.firebaseAuth.linkedUid.value }}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="handleConnectGoogle"
            :disabled="state.firebaseAuth.isAuthenticating.value"
            class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition border border-gray-200 cursor-pointer shadow-xs whitespace-nowrap"
          >
            Switch Account
          </button>
          <button
            @click="handleDisconnectGoogle"
            :disabled="state.firebaseAuth.isAuthenticating.value"
            class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition border border-rose-200 cursor-pointer shadow-xs whitespace-nowrap"
          >
            Disconnect
          </button>
        </div>
      </div>

      <!-- Disconnected State Prompt -->
      <div
        v-else
        class="bg-amber-50 border border-amber-200 p-3.5 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div>
          <div class="text-xs font-bold text-amber-900">
            No Google account connected
          </div>
          <div class="text-[10px] text-amber-700">
            Connect with Google to activate multi-tenant cloud storage and access your work orders and wallets.
          </div>
        </div>

        <button
          @click="handleConnectGoogle"
          :disabled="state.firebaseAuth.isAuthenticating.value"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition border-0 cursor-pointer shadow-xs whitespace-nowrap flex items-center gap-2"
        >
          <span>Sign in with Google</span>
        </button>
      </div>

      <p class="text-[9px] text-gray-400 font-medium">
        All financial records and work ledger items are scoped strictly to your authenticated Google UID in Firestore.
      </p>
    </div>

    <!-- Database Seeding & Portability -->
    <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs space-y-2">
      <h3 class="text-xs font-black uppercase tracking-wider text-gray-800">Database Seeding & Portability</h3>
      <p class="text-[10px] text-gray-500 font-normal">Seed default vaults & sample clients into Firestore, or export backup JSON state.</p>
      <div class="flex items-center gap-2 pt-1">
        <button
          @click="state.seedSampleData()"
          :disabled="!state.firebaseAuth.isLinked.value"
          class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition border-0 cursor-pointer shadow-xs disabled:opacity-50"
        >
          🌱 Seed Default Vaults & Clients
        </button>
        <button
          @click="exportBackup"
          :disabled="!state.firebaseAuth.isLinked.value"
          class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition border-0 cursor-pointer shadow-xs disabled:opacity-50"
        >
          💾 Export JSON
        </button>
      </div>
    </div>

    <!-- Custom Work Types -->
    <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs space-y-2.5">
      <div>
        <h3 class="text-xs font-black uppercase tracking-wider text-gray-800">Custom Work Types</h3>
        <p class="text-[10px] text-gray-500 font-normal">Configure custom service headers and task classifications</p>
      </div>

      <div class="flex gap-2">
        <input
          v-model="newWorkType"
          type="text"
          placeholder="e.g. Electrical CAD Design"
          class="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none"
        />
        <button
          @click="addWorkType"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition border-0 cursor-pointer shadow-xs"
        >
          Add Type
        </button>
      </div>

      <div class="flex flex-wrap gap-1.5 pt-1">
        <span
          v-for="t in state.customWorkTypes.value"
          :key="t"
          class="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-[10px] font-bold text-gray-700 flex items-center gap-1.5"
        >
          <span>{{ t }}</span>
          <button @click="removeWorkType(t)" class="text-gray-400 hover:text-rose-600 bg-transparent border-0 cursor-pointer text-xs">✕</button>
        </span>
      </div>
    </div>

    <!-- Custom Expense Categories -->
    <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs space-y-2.5">
      <div>
        <h3 class="text-xs font-black uppercase tracking-wider text-gray-800">Custom Expense Categories</h3>
        <p class="text-[10px] text-gray-500 font-normal">Configure operational expense categories with custom icons</p>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <input
          v-model="newCategoryName"
          type="text"
          placeholder="Category Name"
          class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none"
        />
        <input
          v-model="newCategoryIcon"
          type="text"
          placeholder="Emoji Icon (e.g. 🛠️)"
          class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none"
        />
        <button
          @click="addCategory"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition border-0 cursor-pointer shadow-xs"
        >
          Add Category
        </button>
      </div>

      <div class="flex flex-wrap gap-1.5 pt-1">
        <span
          v-for="c in state.customExpenseCategories.value"
          :key="c.id"
          class="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-[10px] font-bold text-gray-700 flex items-center gap-1.5"
        >
          <span>{{ c.icon }}</span>
          <span>{{ c.name }}</span>
          <button @click="removeCategory(c.id)" class="text-gray-400 hover:text-rose-600 bg-transparent border-0 cursor-pointer text-xs">✕</button>
        </span>
      </div>
    </div>
  </div>
</template>
