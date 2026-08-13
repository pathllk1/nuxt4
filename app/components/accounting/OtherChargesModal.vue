<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" @keydown="handleGlobalKeydown">
    <div ref="modalContainerRef" class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 animate-scale-in">
       <header class="bg-gradient-to-r from-blue-700 to-indigo-800 px-8 py-6 text-white flex justify-between items-center">
          <div>
             <h2 class="text-2xl font-black uppercase tracking-tighter">Other Charges</h2>
             <p class="text-xs font-bold opacity-80 uppercase tracking-widest mt-1">Insert/Ctrl+N: Add Line • Delete: Remove • F8: Apply • ESC: Close</p>
          </div>
          <button @click="$emit('update:modelValue', false)" class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
       </header>

       <div class="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar charges-container">
          <div v-for="(charge, index) in otherCharges" :key="index" :data-charge-row="index" class="bg-slate-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-slate-100 dark:border-zinc-700 flex items-start gap-4 group">
             <div class="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="relative">
                   <label class="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Charge Name</label>
                   <input 
                     type="text" 
                     v-model="charge.name" 
                     @focus="onNameFocus(index)" 
                     @blur="onBlur(index)"
                     @keydown="onNameInputKeydown($event, index)"
                     @keydown.backspace="onInputBackspace($event)"
                     placeholder="e.g. Freight" 
                     class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-900 dark:text-white name-input" 
                   />
                   <!-- Suggestions Dropdown -->
                   <div v-if="focusedIndex === index && filteredSuggestions(charge.name).length > 0" class="absolute left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-700">
                      <button 
                        v-for="(sug, sIdx) in filteredSuggestions(charge.name)" 
                        :key="sug.name" 
                        type="button"
                        @mousedown="selectSuggestion(index, sug)"
                        class="w-full px-4 py-2.5 text-left text-xs transition-colors flex items-center justify-between font-bold"
                        :class="[
                          suggestionSelectedIndex === sIdx ? 'bg-blue-600 text-white font-extrabold' : 'hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-800 dark:text-white'
                        ]"
                      >
                         <span>{{ sug.name }}</span>
                         <span class="text-[10px] font-bold font-mono" :class="suggestionSelectedIndex === sIdx ? 'text-white' : 'text-slate-400'">GST {{ sug.grate }}%</span>
                      </button>
                   </div>
                </div>
                <div>
                   <label class="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">HSN/SAC</label>
                   <input type="text" v-model="charge.hsnSac" placeholder="e.g. 9965" @keydown.enter.prevent="onInputEnter($event, index, 'hsn')" @keydown.backspace="onInputBackspace($event)" class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono font-bold uppercase text-slate-900 dark:text-white" />
                </div>
                <div>
                   <label class="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Amount (₹)</label>
                   <input type="number" step="any" v-model="charge.amount" @keydown.enter.prevent="onInputEnter($event, index, 'amount')" @keydown.backspace="onInputBackspace($event)" class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-right font-mono text-slate-900 dark:text-white" />
                </div>
                <div>
                   <label class="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">GST %</label>
                   <input type="number" step="any" v-model="charge.grate" @keydown.enter.prevent="onInputEnter($event, index, 'last')" @keydown.backspace="onInputBackspace($event)" class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-right font-mono text-slate-900 dark:text-white" />
                </div>
             </div>
             <button @click="removeCharge(index)" type="button" class="mt-6 text-slate-300 hover:text-red-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
             </button>
          </div>

          <button @click="addCharge" type="button" class="w-full py-4 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-400 font-black uppercase text-xs tracking-widest hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-all">
             + Add Another Charge Line (Insert / Ctrl+N)
          </button>
       </div>

       <div class="p-8 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex justify-between items-center">
          <div class="flex flex-col">
             <span class="text-[10px] font-black text-slate-400 uppercase">Total Charges</span>
             <span class="text-xl font-black text-blue-900 dark:text-blue-400 font-mono">₹{{ totalAmount.toLocaleString() }}</span>
          </div>
          <button @click="$emit('update:modelValue', false)" type="button" class="px-10 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all transform active:scale-95">
             Apply Charges (F8)
          </button>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useApi } from '@/utils/api';
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';

const props = defineProps<{
  modelValue: boolean;
  otherCharges: any[];
}>();

const emit = defineEmits(['update:modelValue']);
const api = useApi();
const { handleEnterKey, handleBackspaceKey } = useKeyboardNavigation();

const modalContainerRef = ref<HTMLElement | null>(null);
const historicalTypes = ref<any[]>([]);
const focusedIndex = ref<number | null>(null);

const totalAmount = computed(() => {
  return props.otherCharges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
});

async function fetchHistoricalTypes() {
  try {
    const res = await api.get('/accounting/other-charges/types');
    if (res.success) {
      historicalTypes.value = res.data;
    }
  } catch (err) {
    console.error('Failed to fetch other charges types:', err);
  }
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    fetchHistoricalTypes();
    if (!props.otherCharges.length) addCharge();
    nextTick(() => {
      const firstInput = modalContainerRef.value?.querySelector('input.name-input') as HTMLElement;
      firstInput?.focus();
      (firstInput as HTMLInputElement)?.select();
    });
  }
});

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
    e.preventDefault();
    e.stopPropagation();
    addCharge();
  } else if (e.key === 'F8') {
    e.preventDefault();
    e.stopPropagation();
    emit('update:modelValue', false);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('update:modelValue', false);
  }
}

function onInputEnter(e: KeyboardEvent, index: number, fieldType: string) {
  if (!modalContainerRef.value) return;
  if (fieldType === 'last') {
    if (index === props.otherCharges.length - 1) {
      addCharge();
    } else {
      handleEnterKey(e, modalContainerRef.value);
    }
  } else {
    handleEnterKey(e, modalContainerRef.value);
  }
}

function onInputBackspace(e: KeyboardEvent) {
  if (modalContainerRef.value) {
    handleBackspaceKey(e, modalContainerRef.value);
  }
}

const suggestionSelectedIndex = ref(0);

function onNameFocus(index: number) {
  focusedIndex.value = index;
  suggestionSelectedIndex.value = 0;
}

function onNameInputKeydown(e: KeyboardEvent, index: number) {
  const suggestions = filteredSuggestions(props.otherCharges[index]?.name || '');
  const isDropdownVisible = focusedIndex.value === index && suggestions.length > 0;

  if (e.key === 'ArrowDown') {
    if (isDropdownVisible) {
      e.preventDefault();
      suggestionSelectedIndex.value = (suggestionSelectedIndex.value + 1) % suggestions.length;
      return;
    }
  } else if (e.key === 'ArrowUp') {
    if (isDropdownVisible) {
      e.preventDefault();
      suggestionSelectedIndex.value = (suggestionSelectedIndex.value - 1 + suggestions.length) % suggestions.length;
      return;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (isDropdownVisible && suggestionSelectedIndex.value < suggestions.length) {
      const selected = suggestions[suggestionSelectedIndex.value];
      selectSuggestion(index, selected);
      return;
    }
    onInputEnter(e, index, 'name');
  }
}

function filteredSuggestions(name: string) {
  const query = (name || '').toLowerCase().trim();
  if (!query) return historicalTypes.value;
  return historicalTypes.value.filter(s => 
    s.name.toLowerCase().includes(query)
  );
}

function onBlur(index: number) {
  setTimeout(() => {
    if (focusedIndex.value === index) {
      focusedIndex.value = null;
    }
  }, 200);
}

function selectSuggestion(index: number, sug: any) {
  props.otherCharges[index].name = sug.name;
  props.otherCharges[index].hsnSac = sug.hsnSac || '';
  props.otherCharges[index].grate = sug.grate || 0;
  focusedIndex.value = null;

  // Auto-focus Amount input of this charge row!
  nextTick(() => {
    const row = modalContainerRef.value?.querySelector(`[data-charge-row="${index}"]`) as HTMLElement;
    const amountInput = row?.querySelectorAll('input')[2] as HTMLElement;
    if (amountInput) {
      amountInput.focus();
      (amountInput as HTMLInputElement).select();
    }
  });
}

function addCharge() {
  props.otherCharges.push({ name: '', hsnSac: '', amount: 0, grate: 18 });
  nextTick(() => {
    const lastRowIndex = props.otherCharges.length - 1;
    const nameInput = modalContainerRef.value?.querySelector(`[data-charge-row="${lastRowIndex}"] input.name-input`) as HTMLElement;
    if (nameInput) {
      nameInput.focus();
      (nameInput as HTMLInputElement).select();
    }
  });
}

function removeCharge(index: number) {
  props.otherCharges.splice(index, 1);
}
</script>
