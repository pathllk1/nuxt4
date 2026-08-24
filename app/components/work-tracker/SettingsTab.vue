<script setup lang="ts">
import { ref } from 'vue';
import { useWorkTracker } from '~/composables/useWorkTracker';
import type { ExpenseCategory } from '~/types/work-tracker';

const state = useWorkTracker();

const newWorkType = ref('');
const newCategoryName = ref('');
const newCategoryIcon = ref('📦');
const uidInput = ref(state.firebaseUserUid.value);

const saveUid = () => {
  if (!uidInput.value.trim()) return;
  state.setFirebaseUserUid(uidInput.value.trim());
};

const resetUid = () => {
  state.resetFirebaseUserUid();
  uidInput.value = state.firebaseUserUid.value;
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
    firebaseUserUid: state.firebaseUserUid.value,
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
    <!-- Cloud Database Profile & Sync -->
    <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs space-y-2.5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
            <span>🔥</span>
            <span>Firebase Cloud Database Sync</span>
          </h3>
          <p class="text-[10px] text-gray-500 font-normal">Active Firestore User Profile Scope (Stored in Browser)</p>
        </div>
        <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
          ONLINE
        </span>
      </div>

      <div class="flex flex-col sm:flex-row gap-2">
        <input
          v-model="uidInput"
          type="text"
          placeholder="Firebase User UID (e.g. 6NCnWG74HMaPDvbICnW2FqusHNj1)"
          class="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold text-gray-800 outline-none"
        />
        <div class="flex items-center gap-2">
          <button
            @click="saveUid"
            class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition border-0 cursor-pointer shadow-xs whitespace-nowrap"
          >
            Save & Re-sync
          </button>
          <button
            @click="resetUid"
            class="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition border border-gray-200 cursor-pointer whitespace-nowrap"
            title="Reset to default UID"
          >
            Reset
          </button>
        </div>
      </div>
      <p class="text-[9px] text-gray-400 font-bold">
        Currently querying: <span class="font-mono text-gray-600 font-black">users/{{ state.firebaseUserUid.value }}/*</span>
      </p>
    </div>

    <!-- Database Seeding & Portability -->
    <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs space-y-2">
      <h3 class="text-xs font-black uppercase tracking-wider text-gray-800">Database Seeding & Portability</h3>
      <p class="text-[10px] text-gray-500 font-normal">Seed default vaults & sample clients into Firestore, or export backup JSON state.</p>
      <div class="flex items-center gap-2 pt-1">
        <button
          @click="state.seedSampleData()"
          class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition border-0 cursor-pointer shadow-xs"
        >
          🌱 Seed Default Vaults & Clients
        </button>
        <button
          @click="exportBackup"
          class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition border-0 cursor-pointer shadow-xs"
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
