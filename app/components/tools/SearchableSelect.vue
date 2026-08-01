<template>
  <div class="relative w-full">
    <div class="flex items-center border rounded-lg bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500">
      <div class="flex-1">
        <input
          ref="inputRef"
          type="text"
          class="w-full px-4 py-2 bg-transparent outline-none text-gray-800 placeholder-gray-400"
          :placeholder="placeholder"
          v-model="searchQuery"
          @focus="isOpen = true"
          @blur="handleBlur"
          @keydown.down.prevent="moveSelection(1)"
          @keydown.up.prevent="moveSelection(-1)"
          @keydown.enter.prevent="selectCurrent"
        />
      </div>
      <div class="px-2 cursor-pointer text-gray-400 hover:text-gray-600" @click="toggleDropdown">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>

    <!-- Dropdown -->
    <div
      v-if="isOpen && filteredOptions.length > 0"
      class="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto"
    >
      <div
        v-for="(option, index) in filteredOptions"
        :key="option.id || option._id || index"
        class="px-4 py-2 cursor-pointer transition-colors duration-150"
        :class="[
          selectedIndex === index ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
        ]"
        @mousedown="selectOption(option)"
      >
        <slot name="option" :option="option">
          {{ getLabel(option) }}
        </slot>
      </div>
    </div>
    
    <div
      v-else-if="isOpen && searchQuery && filteredOptions.length === 0"
      class="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl p-4 text-center text-gray-500 italic"
    >
      No results found for "{{ searchQuery }}"
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps<{
  options: any[];
  modelValue: any;
  placeholder?: string;
  labelKey?: string;
  searchKeys?: string[];
}>();

const emit = defineEmits(['update:modelValue', 'select']);

const searchQuery = ref('');
const isOpen = ref(false);
const selectedIndex = ref(-1);
const inputRef = ref<HTMLInputElement | null>(null);

// Initialize search query if modelValue exists
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    searchQuery.value = getLabel(newVal);
  } else {
    searchQuery.value = '';
  }
}, { immediate: true });

const filteredOptions = computed(() => {
  if (!searchQuery.value || (props.modelValue && searchQuery.value === getLabel(props.modelValue))) {
    return props.options;
  }
  
  const query = searchQuery.value.toLowerCase();
  return props.options.filter(option => {
    if (props.searchKeys) {
      return props.searchKeys.some(key => String(option[key]).toLowerCase().includes(query));
    }
    return getLabel(option).toLowerCase().includes(query);
  });
});

function getLabel(option: any): string {
  if (!option) return '';
  return props.labelKey ? option[props.labelKey] : String(option);
}

function selectOption(option: any) {
  searchQuery.value = getLabel(option);
  emit('update:modelValue', option);
  emit('select', option);
  isOpen.value = false;
  selectedIndex.value = -1;
}

function handleBlur() {
  // Delay to allow mousedown on options
  setTimeout(() => {
    isOpen.value = false;
    // If no option selected, reset search query to current model value
    if (!props.modelValue || searchQuery.value !== getLabel(props.modelValue)) {
      searchQuery.value = props.modelValue ? getLabel(props.modelValue) : '';
    }
  }, 200);
}

function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(() => inputRef.value?.focus());
  }
}

function moveSelection(direction: number) {
  if (!isOpen.value) {
    isOpen.value = true;
    return;
  }
  const count = filteredOptions.value.length;
  if (count === 0) return;
  
  selectedIndex.value = (selectedIndex.value + direction + count) % count;
}

function selectCurrent() {
  if (isOpen.value && selectedIndex.value >= 0) {
    selectOption(filteredOptions.value[selectedIndex.value]);
  } else if (!isOpen.value) {
    isOpen.value = true;
  }
}
</script>
