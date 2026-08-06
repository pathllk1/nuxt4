<template>
  <div class="p-4 py-3 w-full mx-auto space-y-3">
    <!-- Header Section -->
    <div class="flex justify-between items-center mb-2">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <UIcon name="i-heroicons-squares-2x2" class="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Stock Register</h1>
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Complete listing of all items and current balances</p>
        </div>
      </div>
      <div class="flex gap-2">
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          label="Back"
          class="font-semibold text-xs h-8"
          @click="$router.back()"
        />
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          size="sm"
          label="Add New Stock"
          class="font-semibold text-xs h-8"
          @click="showCreateModal = true"
        />
      </div>
    </div>

    <!-- Search Section -->
    <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 mb-2 flex items-center justify-between gap-3">
      <div class="w-96">
        <UInput 
          v-model="searchQuery" 
          placeholder="Search by name, HSN, or Part No..." 
          icon="i-heroicons-magnifying-glass"
          size="sm"
          class="w-full" 
        />
      </div>
      <div class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-2">
        Total: {{ filteredStocks.length }} SKUs
      </div>
    </div>

    <!-- Stock Table Card -->
    <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-gray-800" :ui="{ body: 'p-0 overflow-hidden' }">
      <!-- Loader -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-4 bg-white dark:bg-zinc-900">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-blue-600" />
        <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Loading stock register...</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
          <thead>
            <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-800/80">
              <th class="py-2.5 px-4">Item Details</th>
              <th class="py-2.5 px-4">Part No / OEM</th>
              <th class="py-2.5 px-4 text-right">Quantity</th>
              <th class="py-2.5 px-4 text-right">Avg Rate</th>
              <th class="py-2.5 px-4 text-right">Total Value</th>
              <th class="py-2.5 px-4 text-center">Status</th>
              <th class="py-2.5 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-zinc-800">
            <template v-for="stock in filteredStocks" :key="stock.id || stock._id">
              <tr class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group" @click="toggleExpand(stock.id || stock._id)">
                <td class="py-2 px-4">
                  <div class="flex items-center gap-2">
                    <div class="w-5 h-5 rounded-md bg-gray-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                      <UIcon :name="expandedRows.has(stock.id || stock._id || '') ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 transition-all" />
                    </div>
                    <div>
                      <div class="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">{{ stock.item }}</div>
                      <div class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold tracking-widest mt-0.5">HSN: {{ stock.hsn }}</div>
                    </div>
                  </div>
                </td>
                <td class="py-2 px-4">
                  <div class="font-semibold text-gray-700 dark:text-zinc-300">{{ stock.pno || '—' }}</div>
                  <div class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-wider">{{ stock.oem || '—' }}</div>
                </td>
                <td class="py-2 px-4 text-right">
                  <div class="font-bold text-gray-900 dark:text-white">{{ (stock.qty || 0).toLocaleString() }} <span class="text-[9px] text-gray-400 dark:text-zinc-500 ml-0.5">{{ stock.uom }}</span></div>
                  <div v-if="stock.batches?.length > 1" class="text-[8px] text-blue-500 font-black uppercase tracking-widest">{{ stock.batches.length }} Batches</div>
                </td>
                <td class="py-2 px-4 text-right">
                  <div class="text-gray-600 dark:text-zinc-400 font-medium">₹{{ (stock.rate || 0).toLocaleString() }}</div>
                </td>
                <td class="py-2 px-4 text-right">
                  <div class="font-bold text-gray-900 dark:text-white">₹{{ (stock.total || 0).toLocaleString() }}</div>
                </td>
                <td class="py-2 px-4 text-center">
                  <UBadge 
                    :color="getStockHealthColor(stock.qty || 0)" 
                    size="sm" 
                    variant="subtle" 
                    class="px-2 py-0.5 font-black uppercase tracking-widest text-[9px] rounded-md"
                  >
                    {{ getStockHealthLabel(stock.qty || 0) }}
                  </UBadge>
                </td>
                <td class="py-2 px-4 text-center" @click.stop>
                  <UButton 
                    size="xs" 
                    variant="ghost" 
                    color="neutral" 
                    icon="i-heroicons-pencil-square" 
                    @click="editStock(stock)"
                    title="Edit Item" 
                  />
                </td>
              </tr>
              <!-- Expanded Batch Details -->
              <tr v-if="expandedRows.has(stock.id || stock._id || '')" class="bg-gray-50/50 dark:bg-zinc-800/30">
                <td colspan="7" class="px-6 py-3">
                  <div class="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                    <div class="px-4 py-2 bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                      <h4 class="text-[9px] font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Batch Inventory Breakdown</h4>
                      <UButton
                        color="primary"
                        variant="link"
                        size="xs"
                        label="Full History →"
                        class="p-0 font-bold text-[9px]"
                        @click="viewHistory(stock)"
                      />
                    </div>
                    <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
                      <thead>
                        <tr class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest bg-gray-50/20 dark:bg-zinc-800/20">
                          <th class="px-4 py-2">Batch Number</th>
                          <th class="px-4 py-2 text-right">Quantity</th>
                          <th class="px-4 py-2 text-right">Rate</th>
                          <th class="px-4 py-2 text-right">GST %</th>
                          <th class="px-4 py-2 text-right">MRP</th>
                          <th class="px-4 py-2">Expiry</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-50 dark:divide-zinc-850">
                        <tr v-for="batch in stock.batches" :key="batch._id || batch.batch" class="text-gray-600 dark:text-zinc-400">
                          <td class="px-4 py-1.5 font-bold">{{ batch.batch || 'DEFAULT' }}</td>
                          <td class="px-4 py-1.5 text-right font-bold text-gray-900 dark:text-white">{{ batch.qty }} {{ batch.uom }}</td>
                          <td class="px-4 py-1.5 text-right">₹{{ (batch.rate || 0).toLocaleString() }}</td>
                          <td class="px-4 py-1.5 text-right">{{ batch.grate || 0 }}%</td>
                          <td class="px-4 py-1.5 text-right font-bold text-gray-700 dark:text-zinc-300">{{ batch.mrp ? '₹' + batch.mrp.toLocaleString() : '—' }}</td>
                          <td class="px-4 py-1.5">{{ batch.expiry ? new Date(batch.expiry).toLocaleDateString('en-IN') : '—' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        
        <div v-if="filteredStocks.length === 0" class="p-16 text-center bg-white dark:bg-zinc-900">
           <div class="w-12 h-12 bg-slate-50 dark:bg-zinc-850 rounded-full flex items-center justify-center mx-auto mb-2">
              <UIcon name="i-heroicons-inbox" class="w-6 h-6 text-slate-300 dark:text-zinc-500" />
           </div>
           <h3 class="text-slate-400 dark:text-zinc-500 text-xs font-black uppercase tracking-wider">No Items Found</h3>
        </div>
      </div>
    </UCard>

    <CreateStockModal v-model="showCreateModal" @saved="fetchStocks" />
    <EditStockModal v-model="showEditModal" :stock="selectedStock" @saved="fetchStocks" />
    <StockHistoryModal v-model="showHistoryModal" :stock="selectedStock" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useInventory } from '@/composables/useInventory';
import CreateStockModal from '@/components/inventory/CreateStockModal.vue';
import EditStockModal from '@/components/inventory/EditStockModal.vue';
import StockHistoryModal from '@/components/inventory/StockHistoryModal.vue';

const { stocks, fetchStocks, loading } = useInventory();
const searchQuery = ref('');
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showHistoryModal = ref(false);
const selectedStock = ref<any>(null);
const expandedRows = ref(new Set<string>());

onMounted(fetchStocks);

const filteredStocks = computed(() => {
  if (!searchQuery.value) return stocks.value;
  const q = searchQuery.value.toLowerCase();
  return stocks.value.filter(s => 
    s.item.toLowerCase().includes(q) || 
    s.hsn?.toLowerCase().includes(q) ||
    (s.pno && s.pno.toLowerCase().includes(q)) ||
    (s.oem && s.oem.toLowerCase().includes(q))
  );
});

function toggleExpand(id: string | undefined) {
  if (!id) return;
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id);
  } else {
    expandedRows.value.add(id);
  }
}

function getStockHealthColor(qty: number) {
  if (qty <= 0) return 'error';
  if (qty <= 5) return 'warning';
  if (qty <= 20) return 'primary';
  return 'success';
}

function getStockHealthLabel(qty: number) {
  if (qty <= 0) return 'Out of Stock';
  if (qty <= 5) return 'Low Stock';
  if (qty <= 20) return 'Watchlist';
  return 'Healthy';
}

function viewHistory(stock: any) {
  selectedStock.value = stock;
  showHistoryModal.value = true;
}

function editStock(stock: any) {
  selectedStock.value = stock;
  showEditModal.value = true;
}
</script>
