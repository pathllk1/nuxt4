<template>
  <Teleport to="body">
    <div 
      v-if="isOpen" 
      class="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      @click.self="closeDrawer"
      @keydown.esc="closeDrawer"
    >
      <div 
        class="w-full max-w-5xl h-full bg-slate-50 dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-slide-left"
        role="dialog"
        aria-modal="true"
        aria-label="System Guidelines"
      >
        <!-- Header -->
        <header class="bg-white dark:bg-zinc-850 px-8 py-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-lg">
              📖
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">System Guidelines & Reference</h1>
                <span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded font-mono text-[9px] font-bold">Ctrl + ,</span>
              </div>
              <p class="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Interactive documentation and keyboard shortcuts</p>
            </div>
          </div>

          <button 
            type="button"
            @click="closeDrawer" 
            class="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
          >
            Close (ESC)
          </button>
        </header>

        <!-- Body with Sidebar Layout -->
        <div class="flex-1 flex overflow-hidden">
          <!-- Left Sidebar Menu -->
          <aside class="w-64 bg-white dark:bg-zinc-850 border-r border-slate-200 dark:border-zinc-800 p-4 space-y-2 shrink-0 overflow-y-auto">
            <div class="px-3 py-1.5 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
              Guideline Modules
            </div>

            <button
              v-for="item in menuItems"
              :key="item.id"
              type="button"
              @click="activeTab = item.id"
              class="w-full px-4 py-3 rounded-2xl text-left font-bold text-xs flex items-center justify-between transition-all"
              :class="[
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              ]"
            >
              <div class="flex items-center gap-2.5">
                <span class="text-base">{{ item.icon }}</span>
                <span>{{ item.title }}</span>
              </div>
              <span 
                v-if="item.badge" 
                class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                :class="activeTab === item.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-400'"
              >
                {{ item.badge }}
              </span>
            </button>
          </aside>

          <!-- Right Content Area -->
          <main class="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50 dark:bg-zinc-900/50">
            <SalesGuideline v-if="activeTab === 'sales'" />
            <InventoryGuideline v-else-if="activeTab === 'inventory'" />
          </main>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';
import SalesGuideline from './SalesGuideline.vue';
import InventoryGuideline from './InventoryGuideline.vue';

const isOpen = ref(false);
const activeTab = ref('sales');
const { saveFocus, restoreFocus } = useKeyboardNavigation();

const menuItems = [
  { id: 'sales', title: 'Sales Billing Guide', icon: '🧾', badge: 'Core' },
  { id: 'inventory', title: 'Stock & Batches', icon: '📦', badge: 'Items' }
];

function toggleDrawer() {
  if (isOpen.value) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

function openDrawer() {
  saveFocus();
  isOpen.value = true;
}

function closeDrawer() {
  isOpen.value = false;
  restoreFocus();
}

function handleGlobalShortcut(e: KeyboardEvent) {
  // Shortcut: Ctrl + , (Control + Comma)
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault();
    toggleDrawer();
  }
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('keydown', handleGlobalShortcut);
  }
});

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleGlobalShortcut);
  }
});
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.animate-slide-left {
  animation: slideLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideLeft {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
:deep(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #3f3f46;
}
</style>
