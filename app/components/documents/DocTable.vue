<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-xs flex flex-col">
    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex flex-col items-center justify-center p-12 space-y-3">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 text-teal-500 animate-spin" />
      <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 animate-pulse">Loading documents...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="documents.length === 0" class="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-2">
      <UIcon name="i-lucide-folder-open" class="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto" />
      <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200">No documents found</h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 max-w-xs">No records belong to this firm or match your search criteria.</p>
    </div>

    <!-- Table content -->
    <div v-else class="overflow-auto">
      <table class="w-full text-left border-collapse table-fixed min-w-full">
        <thead>
          <tr class="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            <!-- Mobile expand chevron spacer -->
            <th class="px-3 py-2 sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs z-10 w-[42px] lg:hidden"></th>
            
            <!-- Document Name -->
            <th class="px-4 py-2 sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs z-10 w-[40%] sm:w-[25%] lg:w-[20%]">
              <button @click="$emit('sort', 'name')" class="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer border-0 bg-transparent font-bold text-left p-0 w-full">
                Document Name
                <UIcon 
                  :name="sortBy === 'name' ? (sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down') : 'i-lucide-chevrons-up-down'" 
                  class="w-3.5 h-3.5 shrink-0" 
                  :class="sortBy === 'name' ? 'text-teal-600 dark:text-teal-400' : 'opacity-25'"
                />
              </button>
            </th>

            <!-- Reference Number -->
            <th class="hidden sm:table-cell px-4 py-2 sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs z-10 w-[20%] lg:w-[13%]">
              <button @click="$emit('sort', 'reference_number')" class="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer border-0 bg-transparent font-bold text-left p-0 w-full">
                Ref Number
                <UIcon 
                  :name="sortBy === 'reference_number' ? (sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down') : 'i-lucide-chevrons-up-down'" 
                  class="w-3.5 h-3.5 shrink-0" 
                  :class="sortBy === 'reference_number' ? 'text-teal-600 dark:text-teal-400' : 'opacity-25'"
                />
              </button>
            </th>

            <!-- Description -->
            <th class="hidden lg:table-cell px-4 py-2 sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs z-10 w-[22%]">
              <button @click="$emit('sort', 'description')" class="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer border-0 bg-transparent font-bold text-left p-0 w-full">
                Description
                <UIcon 
                  :name="sortBy === 'description' ? (sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down') : 'i-lucide-chevrons-up-down'" 
                  class="w-3.5 h-3.5 shrink-0" 
                  :class="sortBy === 'description' ? 'text-teal-600 dark:text-teal-400' : 'opacity-25'"
                />
              </button>
            </th>

            <!-- Start Date -->
            <th class="hidden lg:table-cell px-4 py-2 sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs z-10 w-[11%]">
              <button @click="$emit('sort', 'start_date')" class="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer border-0 bg-transparent font-bold text-left p-0 w-full">
                Start Date
                <UIcon 
                  :name="sortBy === 'start_date' ? (sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down') : 'i-lucide-chevrons-up-down'" 
                  class="w-3.5 h-3.5 shrink-0" 
                  :class="sortBy === 'start_date' ? 'text-teal-600 dark:text-teal-400' : 'opacity-25'"
                />
              </button>
            </th>

            <!-- Expiry Date -->
            <th class="px-4 py-2 sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs z-10 w-[30%] sm:w-[20%] lg:w-[14%]">
              <button @click="$emit('sort', 'expiry_date')" class="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer border-0 bg-transparent font-bold text-left p-0 w-full">
                Expiry Date
                <UIcon 
                  :name="sortBy === 'expiry_date' ? (sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down') : 'i-lucide-chevrons-up-down'" 
                  class="w-3.5 h-3.5 shrink-0" 
                  :class="sortBy === 'expiry_date' ? 'text-teal-600 dark:text-teal-400' : 'opacity-25'"
                />
              </button>
            </th>

            <!-- Value -->
            <th class="hidden sm:table-cell px-4 py-2 sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs z-10 w-[15%] lg:w-[10%] text-right">
              <button @click="$emit('sort', 'value')" class="flex items-center justify-end gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer border-0 bg-transparent font-bold text-right p-0 w-full">
                Value
                <UIcon 
                  :name="sortBy === 'value' ? (sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down') : 'i-lucide-chevrons-up-down'" 
                  class="w-3.5 h-3.5 shrink-0" 
                  :class="sortBy === 'value' ? 'text-teal-600 dark:text-teal-400' : 'opacity-25'"
                />
              </button>
            </th>

            <!-- Status -->
            <th class="px-4 py-2 sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs z-10 w-[18%] sm:w-[12%] lg:w-[10%]">
              <button @click="$emit('sort', 'status')" class="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition cursor-pointer border-0 bg-transparent font-bold text-left p-0 w-full">
                Status
                <UIcon 
                  :name="sortBy === 'status' ? (sortOrder === 'asc' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down') : 'i-lucide-chevrons-up-down'" 
                  class="w-3.5 h-3.5 shrink-0" 
                  :class="sortBy === 'status' ? 'text-teal-600 dark:text-teal-400' : 'opacity-25'"
                />
              </button>
            </th>

            <!-- Actions -->
            <th class="px-4 py-2 sticky top-0 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-xs z-10 w-[12%] sm:w-[8%] lg:w-[10%] text-right">
              <span class="font-bold text-gray-400 dark:text-gray-500">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
          <template v-for="doc in documents" :key="doc.id">
            <tr 
              class="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition odd:bg-white even:bg-gray-50/15 dark:odd:bg-gray-900 dark:even:bg-gray-900/30"
              :class="{'bg-teal-50/10 dark:bg-teal-950/10': expandedRowIds[doc.id]}"
            >
              <!-- Expand Chevron -->
              <td class="px-3 py-2.5 lg:hidden text-center">
                <button 
                  @click="toggleRow(doc.id)"
                  class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 rounded transition cursor-pointer flex items-center justify-center mx-auto"
                >
                  <UIcon 
                    name="i-lucide-chevron-right" 
                    class="w-4 h-4 transition-transform duration-200"
                    :class="expandedRowIds[doc.id] ? 'rotate-90 text-teal-600 dark:text-teal-400' : ''"
                  />
                </button>
              </td>

              <!-- Document Name -->
              <td class="px-4 py-2.5 font-bold text-gray-900 dark:text-gray-100 truncate">
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-file-text" class="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span class="truncate">{{ doc.name }}</span>
                </div>
              </td>

              <!-- Reference Number -->
              <td class="hidden sm:table-cell px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono text-[11px] truncate">
                {{ doc.reference_number }}
              </td>

              <!-- Description -->
              <td class="hidden lg:table-cell px-4 py-2.5 text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                {{ doc.description || '-' }}
              </td>

              <!-- Start Date -->
              <td class="hidden lg:table-cell px-4 py-2.5 text-gray-500 dark:text-gray-400">
                {{ formatDate(doc.start_date) }}
              </td>

              <!-- Expiry Date -->
              <td class="px-4 py-2.5 font-semibold">
                {{ formatDate(doc.extended_expiry_date || doc.original_expiry_date) }}
              </td>

              <!-- Value -->
              <td class="hidden sm:table-cell px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                {{ formatCurrency(doc.value) }}
              </td>

              <!-- Status Badge using @nuxt/ui UBadge -->
              <td class="px-4 py-2.5">
                <UBadge 
                  size="xs"
                  :color="getStatusBadgeColor(doc.computed_status || doc.status)"
                  variant="subtle"
                  class="font-black uppercase tracking-wider"
                >
                  {{ doc.computed_status || doc.status }}
                </UBadge>
              </td>

              <!-- Actions Column -->
              <td class="px-4 py-2.5 text-right">
                <div class="flex items-center justify-end gap-1">
                  <a 
                    v-if="doc.file_url" 
                    :href="doc.file_url" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="p-1 text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 rounded hover:bg-teal-50 dark:hover:bg-teal-950/40 transition"
                    title="View Attached File"
                  >
                    <UIcon name="i-lucide-paperclip" class="w-3.5 h-3.5" />
                  </a>

                  <UButton 
                    @click="$emit('edit', doc)"
                    icon="i-lucide-pencil"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    class="cursor-pointer"
                    title="Edit Document"
                  />

                  <UButton 
                    @click="$emit('delete', doc.id)"
                    icon="i-lucide-trash-2"
                    size="xs"
                    color="error"
                    variant="ghost"
                    class="cursor-pointer text-red-500 hover:text-red-600"
                    title="Delete Document"
                  />
                </div>
              </td>
            </tr>

            <!-- Mobile Expanded Details Row -->
            <tr v-if="expandedRowIds[doc.id]" class="bg-gray-50/70 dark:bg-gray-800/60 lg:hidden">
              <td colspan="5" class="px-4 py-3 text-xs space-y-2">
                <div class="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span class="font-bold text-gray-400">Ref Code:</span> {{ doc.reference_number }}</div>
                  <div><span class="font-bold text-gray-400">Value:</span> {{ formatCurrency(doc.value) }}</div>
                  <div><span class="font-bold text-gray-400">Start Date:</span> {{ formatDate(doc.start_date) }}</div>
                  <div><span class="font-bold text-gray-400">Original Expiry:</span> {{ formatDate(doc.original_expiry_date) }}</div>
                  <div v-if="doc.extended_expiry_date"><span class="font-bold text-gray-400">Extended Expiry:</span> {{ formatDate(doc.extended_expiry_date) }}</div>
                  <div v-if="doc.closed_date"><span class="font-bold text-gray-400">Closed Date:</span> {{ formatDate(doc.closed_date) }}</div>
                </div>
                <div v-if="doc.description" class="text-[11px] text-gray-600 dark:text-gray-300">
                  <span class="font-bold text-gray-400">Description:</span> {{ doc.description }}
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface DocumentItem {
  id: string;
  firm_id: string;
  user_id: string;
  name: string;
  reference_number: string;
  description: string | null;
  start_date: string | null;
  original_expiry_date: string;
  closed_date: string | null;
  extended_expiry_date: string | null;
  value: number | string;
  status: string;
  computed_status?: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

const props = defineProps<{
  documents: DocumentItem[]
  loading: boolean
  sortBy: string
  sortOrder: string
}>()

defineEmits<{
  (e: 'edit', doc: DocumentItem): void
  (e: 'delete', id: string): void
  (e: 'sort', field: string): void
}>()

const expandedRowIds = ref<Record<string, boolean>>({})

const toggleRow = (id: string) => {
  expandedRowIds.value[id] = !expandedRowIds.value[id]
}

const getStatusBadgeColor = (status?: string): 'error' | 'warning' | 'success' | 'neutral' => {
  const s = (status || '').toLowerCase()
  if (s === 'expired') return 'error'
  if (s === 'expiring soon') return 'warning'
  if (['active', 'pending'].includes(s)) return 'success'
  return 'neutral'
}

const formatCurrency = (val: number | string) => {
  const num = parseFloat(String(val)) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(num);
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const firstPart = dateStr.split('T')[0];
  if (!firstPart) return dateStr;
  const parts = firstPart.split('-');
  if (parts.length < 3) return dateStr;
  const [year, month, day] = parts;
  if (!year || !month || !day) return dateStr;
  const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
</script>
