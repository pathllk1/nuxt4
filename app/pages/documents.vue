<template>
  <div class="h-[calc(100vh-64px)] flex flex-col p-4 bg-gray-50 dark:bg-black gap-3 overflow-hidden">
    <!-- Header -->
    <DocHeader @add="openAddModal" />

    <!-- Tab Selector using @nuxt/ui UButton -->
    <div class="flex items-center gap-1 bg-white/70 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 p-0.5 rounded-lg w-fit self-start shrink-0 text-[10px] font-bold uppercase tracking-wider">
      <UButton 
        @click="activeTab = 'dashboard'"
        size="xs"
        :color="activeTab === 'dashboard' ? 'primary' : 'neutral'"
        :variant="activeTab === 'dashboard' ? 'solid' : 'ghost'"
        icon="i-lucide-bar-chart-3"
        class="font-black uppercase cursor-pointer"
      >
        Dashboard
      </UButton>
      <UButton 
        @click="activeTab = 'details'"
        size="xs"
        :color="activeTab === 'details' ? 'primary' : 'neutral'"
        :variant="activeTab === 'details' ? 'solid' : 'ghost'"
        icon="i-lucide-folder-open"
        class="font-black uppercase cursor-pointer"
      >
        Registry Details
      </UButton>
    </div>

    <!-- Tab 1: Dashboard View -->
    <div v-if="activeTab === 'dashboard'" class="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
      <!-- 4 KPI Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <!-- Card 1: Total Documents -->
        <UCard class="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xs">
          <div class="flex items-center justify-between">
            <div class="space-y-1">
              <span class="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total Documents</span>
              <div class="text-xl font-extrabold text-gray-800 dark:text-gray-100">{{ totalDocsCount }}</div>
            </div>
            <div class="p-2.5 bg-slate-50 dark:bg-slate-900 text-slate-500 rounded-lg flex items-center justify-center shrink-0 w-10 h-10">
              <UIcon name="i-lucide-file-text" class="w-5 h-5" />
            </div>
          </div>
        </UCard>

        <!-- Card 2: Active Value Portfolio -->
        <UCard class="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xs">
          <div class="flex items-center justify-between">
            <div class="space-y-1">
              <span class="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Active Portfolio Value</span>
              <div class="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{{ formatCurrency(activePortfolioValue) }}</div>
            </div>
            <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-lg flex items-center justify-center shrink-0 w-10 h-10">
              <UIcon name="i-lucide-indian-rupee" class="w-5 h-5" />
            </div>
          </div>
        </UCard>

        <!-- Card 3: Expired Alerts -->
        <UCard class="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xs">
          <div class="flex items-center justify-between">
            <div class="space-y-1">
              <span class="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Expired Alerts</span>
              <div class="text-xl font-extrabold text-red-600 dark:text-red-400">{{ expiredDocsCount }}</div>
            </div>
            <div class="p-2.5 bg-red-50 dark:bg-red-950/40 text-red-500 rounded-lg flex items-center justify-center shrink-0 w-10 h-10">
              <UIcon name="i-lucide-alert-triangle" class="w-5 h-5" />
            </div>
          </div>
        </UCard>

        <!-- Card 4: Expiring Soon -->
        <UCard class="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-2xs">
          <div class="flex items-center justify-between">
            <div class="space-y-1">
              <span class="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Expiring Soon (&lt;30d)</span>
              <div class="text-xl font-extrabold text-amber-600 dark:text-amber-400">{{ expiringSoonDocsCount }}</div>
            </div>
            <div class="p-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-lg flex items-center justify-center shrink-0 w-10 h-10">
              <UIcon name="i-lucide-clock" class="w-5 h-5" />
            </div>
          </div>
        </UCard>
      </div>

      <!-- Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-3.5">
        <!-- Timeline Forecast Bar Chart (3/5 cols) -->
        <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-2xs lg:col-span-3 flex flex-col h-[300px]">
          <h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5 text-teal-500" />
            <span>Expiry Timeline Forecast (Portfolio Value)</span>
          </h3>
          <div class="flex-1 min-h-0 relative">
            <canvas ref="barChartRef"></canvas>
          </div>
        </div>

        <!-- Compliance Share Doughnut Chart (2/5 cols) -->
        <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-2xs lg:col-span-2 flex flex-col h-[300px]">
          <h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <UIcon name="i-lucide-pie-chart" class="w-3.5 h-3.5 text-teal-500" />
            <span>Compliance Status Share</span>
          </h3>
          <div class="flex-1 min-h-0 relative">
            <canvas ref="doughnutChartRef"></canvas>
          </div>
        </div>
      </div>

      <!-- Insights Grid (2 Columns: Top Expiry Risks vs High Value Contracts) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <!-- Column 1: Top Expiry Risks -->
        <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-2xs flex flex-col">
          <h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <UIcon name="i-lucide-alert-circle" class="w-3.5 h-3.5 text-amber-500" />
            <span>Top Expiry Risks (Upcoming)</span>
          </h3>
          <div class="flex-1 overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-gray-100 dark:border-gray-800">
                  <th class="py-2 text-[10px] font-bold text-gray-400 uppercase">Document Name</th>
                  <th class="py-2 text-[10px] font-bold text-gray-400 uppercase text-center">Expiry Date</th>
                  <th class="py-2 text-[10px] font-bold text-gray-400 uppercase text-center">Urgency</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100/50 dark:divide-gray-800/50">
                <tr v-for="doc in upcomingExpiries" :key="doc.id" class="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                  <td class="py-2.5 font-semibold text-gray-800 dark:text-gray-200 max-w-[200px] truncate">{{ doc.name }}</td>
                  <td class="py-2.5 text-center text-gray-500 font-medium">{{ formatDate(doc.expiry_date) }}</td>
                  <td class="py-2.5 text-center">
                    <UBadge 
                      v-if="doc.daysRemaining !== null && doc.daysRemaining < 0" 
                      color="error" 
                      variant="subtle" 
                      size="xs"
                      class="font-black uppercase"
                    >
                      Expired ({{ Math.abs(doc.daysRemaining) }}d ago)
                    </UBadge>
                    <UBadge 
                      v-else-if="doc.daysRemaining !== null && doc.daysRemaining <= 30" 
                      color="warning" 
                      variant="subtle" 
                      size="xs"
                      class="font-black uppercase"
                    >
                      ⏱️ {{ doc.daysRemaining }} Days Left
                    </UBadge>
                    <UBadge 
                      v-else-if="doc.daysRemaining !== null" 
                      color="success" 
                      variant="subtle" 
                      size="xs"
                      class="font-black uppercase"
                    >
                      Safe ({{ doc.daysRemaining }}d)
                    </UBadge>
                    <span v-else class="text-gray-400">-</span>
                  </td>
                </tr>
                <tr v-if="upcomingExpiries.length === 0">
                  <td colspan="3" class="py-6 text-center text-gray-400 font-medium">No active documents found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Column 2: Highest Value Contracts -->
        <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-2xs flex flex-col">
          <h3 class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <UIcon name="i-lucide-gem" class="w-3.5 h-3.5 text-emerald-500" />
            <span>Highest Value Contracts</span>
          </h3>
          <div class="flex-1 overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-gray-100 dark:border-gray-800">
                  <th class="py-2 text-[10px] font-bold text-gray-400 uppercase">Document Name</th>
                  <th class="py-2 text-[10px] font-bold text-gray-400 uppercase text-right">Value (INR)</th>
                  <th class="py-2 text-[10px] font-bold text-gray-400 uppercase text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100/50 dark:divide-gray-800/50">
                <tr v-for="doc in highestValueContracts" :key="doc.id" class="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition">
                  <td class="py-2.5 font-semibold text-gray-800 dark:text-gray-200 max-w-[200px] truncate">{{ doc.name }}</td>
                  <td class="py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{{ formatCurrency(doc.value) }}</td>
                  <td class="py-2.5 text-center">
                    <UBadge 
                      size="xs"
                      :color="getStatusBadgeColor(doc.computed_status || doc.status)"
                      variant="subtle"
                      class="font-black uppercase tracking-wider"
                    >
                      {{ doc.computed_status || doc.status }}
                    </UBadge>
                  </td>
                </tr>
                <tr v-if="highestValueContracts.length === 0">
                  <td colspan="3" class="py-6 text-center text-gray-400 font-medium">No contracts found.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 2: Details View -->
    <div v-if="activeTab === 'details'" class="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-0.5">
      <!-- Filters/Search Bar -->
      <DocFilters 
        v-model:searchQuery="searchQuery"
        @download="downloadExcel"
      />

      <!-- Table Container -->
      <div class="min-h-0">
        <DocTable 
          :documents="paginatedDocuments"
          :loading="loading"
          :sortBy="sortBy"
          :sortOrder="sortOrder"
          @edit="openEditModal"
          @delete="deleteDoc"
          @sort="handleSort"
        />
      </div>

      <!-- Pagination Controls -->
      <DocPagination 
        v-if="sortedDocuments.length > 0"
        v-model:currentPage="currentPage"
        v-model:pageSize="pageSize"
        :totalItems="sortedDocuments.length"
      />
    </div>

    <!-- Modal Form (Add / Edit Document) using @nuxt/ui UModal -->
    <UModal v-model:open="isModalOpen" :ui="{ content: 'w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl' }">
      <template #content>
        <div class="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
          <!-- Modal Header -->
          <div class="px-6 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white flex justify-between items-center shrink-0">
            <h2 class="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <UIcon :name="isEditMode ? 'i-lucide-edit-3' : 'i-lucide-plus-circle'" class="w-4 h-4" />
              <span>{{ isEditMode ? 'Edit Document' : 'Add New Document' }}</span>
            </h2>
            <UButton 
              @click="isModalOpen = false" 
              icon="i-lucide-x" 
              size="xs" 
              color="neutral" 
              variant="ghost" 
              class="text-white hover:bg-white/20 cursor-pointer"
            />
          </div>

          <!-- Modal Body (Form Fields) -->
          <div class="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            <!-- Document Name (Full Width) -->
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Document Name*</label>
              <UInput 
                v-model="form.name"
                type="text" 
                placeholder="Enter document name"
                size="sm"
                class="w-full font-semibold"
              />
            </div>

            <!-- Reference Number (Full Width) -->
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Reference Number*</label>
              <UInput 
                v-model="form.referenceNumber"
                type="text" 
                placeholder="Enter reference code/ID"
                size="sm"
                class="w-full font-semibold"
              />
            </div>

            <!-- Description -->
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Description</label>
              <UTextarea 
                v-model="form.description"
                :rows="2"
                placeholder="Provide a summary of the document contents"
                size="sm"
                class="w-full font-semibold"
              />
            </div>

            <!-- Dates Row: Start Date, Original Expiry, Extended Expiry, Closed Date -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Start Date</label>
                <UInput 
                  v-model="form.startDate"
                  type="date" 
                  size="sm"
                  class="w-full font-semibold cursor-pointer"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Original Expiry Date*</label>
                <UInput 
                  v-model="form.originalExpiryDate"
                  type="date" 
                  size="sm"
                  class="w-full font-semibold cursor-pointer"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Extended Expiry Date</label>
                <UInput 
                  v-model="form.extendedExpiryDate"
                  type="date" 
                  size="sm"
                  class="w-full font-semibold cursor-pointer"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Closed Date</label>
                <UInput 
                  v-model="form.closedDate"
                  type="date" 
                  size="sm"
                  class="w-full font-semibold cursor-pointer"
                />
              </div>
            </div>

            <!-- Value, Status & File Upload Row -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Value (INR)*</label>
                <UInput 
                  v-model.number="form.value"
                  type="number" 
                  min="0"
                  step="0.01"
                  size="sm"
                  class="w-full font-semibold"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</label>
                <USelect 
                  v-model="form.status"
                  :items="statusOptions"
                  size="sm"
                  class="w-full font-semibold cursor-pointer"
                />
              </div>
              <div class="space-y-1 sm:col-span-2 lg:col-span-1">
                <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Attachment (Max 500 KB)</label>
                <div class="border border-dashed border-gray-200 dark:border-gray-700 hover:border-teal-400 p-2 rounded-lg flex flex-col items-center justify-center transition bg-gray-50/50 dark:bg-gray-800/50">
                  <input 
                    :key="uploadInputKey"
                    type="file" 
                    @change="handleFileChange"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                    class="text-xs text-gray-500 focus:outline-none w-full file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-bold file:bg-teal-50 dark:file:bg-teal-950/60 file:text-teal-700 dark:file:text-teal-400 hover:file:bg-teal-100 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="px-5 py-3.5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5 shrink-0">
            <UButton 
              @click="isModalOpen = false" 
              color="warning"
              variant="solid"
              size="xs"
              class="font-bold cursor-pointer"
            >
              Cancel
            </UButton>
            <UButton 
              @click="submitForm" 
              :loading="loading"
              color="primary"
              variant="solid"
              size="xs"
              class="font-bold cursor-pointer"
            >
              {{ isEditMode ? 'Save Changes' : 'Add Document' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useDocuments, type DocumentItem } from '../composables/useDocuments'
import { useToast } from '#imports'
import * as ExcelJS from 'exceljs'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement, DoughnutController } from 'chart.js'
import DocHeader from '../components/documents/DocHeader.vue'
import DocFilters from '../components/documents/DocFilters.vue'
import DocTable from '../components/documents/DocTable.vue'
import DocPagination from '../components/documents/DocPagination.vue'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement, DoughnutController)

definePageMeta({
  layout: 'default'
})

const { selectedFirmId } = useAuth()
const { loading, documents: rawDocuments, fetchDocuments: loadDocs, createDocument, updateDocument, deleteDocument: removeDoc } = useDocuments()
const toast = useToast()

const activeTab = ref('dashboard')

// Chart references
let barChart: Chart | null = null
let doughnutChart: Chart | null = null
const barChartRef = ref<HTMLCanvasElement | null>(null)
const doughnutChartRef = ref<HTMLCanvasElement | null>(null)

const searchQuery = ref('')
const sortBy = ref('expiry_date')
const sortOrder = ref('asc')
const currentPage = ref(1)
const pageSize = ref(10)

const isModalOpen = ref(false)
const isEditMode = ref(false)
const editingId = ref<string | null>(null)

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Closed', value: 'Closed' }
]

const form = ref({
  name: '',
  referenceNumber: '',
  description: '',
  startDate: '',
  originalExpiryDate: '',
  closedDate: '',
  extendedExpiryDate: '',
  value: 0,
  status: 'Active'
})
const fileToUpload = ref<File | null>(null)
const uploadInputKey = ref(0)

const fetchDocuments = async () => {
  if (!selectedFirmId.value) return;
  try {
    const res = await loadDocs(searchQuery.value, sortBy.value, sortOrder.value);
    if (activeTab.value === 'dashboard') {
      renderCharts();
    }
  } catch (err: any) {
    toast.add({ title: 'Error fetching documents', description: err.message, color: 'error' });
  }
}

// 100% Complete Excel Export
const downloadExcel = async () => {
  const list = sortedDocuments.value;
  if (list.length === 0) {
    toast.add({ title: 'No documents', description: 'Nothing to download', color: 'warning' });
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BizSuite Document Manager';
    workbook.created = new Date();
    workbook.modified = new Date();

    const ws = workbook.addWorksheet('Document Registry', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 7, showGridLines: true }]
    });

    // Title Banner
    ws.mergeCells('A1:J1');
    const titleCell = ws.getCell('A1');
    titleCell.value = '📂 BIZSUITE DOCUMENT DIRECTORY & COMPLIANCE SUMMARY';
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 40;

    // Metadata Info
    ws.mergeCells('A2:J2');
    const infoCell = ws.getCell('A2');
    infoCell.value = `Report Generated: ${new Date().toLocaleString()} | Active Multi-Firm Tenant Directory`;
    infoCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
    infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 20;

    // Summary Calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPlus30Days = new Date();
    todayPlus30Days.setDate(today.getDate() + 30);
    todayPlus30Days.setHours(0, 0, 0, 0);

    const totalCount = list.length;
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let activeCount = 0;
    let totalValue = 0;

    list.forEach(doc => {
      const val = Number(doc.value) || 0;
      totalValue += val;

      const status = (doc.computed_status || doc.status || '').toLowerCase();
      if (status === 'closed') return;

      const expiryStr = doc.extended_expiry_date || doc.original_expiry_date;
      if (!expiryStr) {
        activeCount++;
        return;
      }

      const expiry = new Date(expiryStr);
      expiry.setHours(0, 0, 0, 0);

      if (expiry < today) {
        expiredCount++;
      } else if (expiry < todayPlus30Days) {
        expiringSoonCount++;
      } else {
        activeCount++;
      }
    });

    ws.getRow(3).height = 10;

    const summaries = [
      { label: 'TOTAL DOCUMENTS', value: totalCount, col: 'A', fmt: '#,##0', color: 'FF1E293B' },
      { label: 'ACTIVE / PENDING', value: activeCount, col: 'C', fmt: '#,##0', color: 'FF059669' },
      { label: 'EXPIRING SOON (<30D)', value: expiringSoonCount, col: 'E', fmt: '#,##0', color: 'FFD97706' },
      { label: 'EXPIRED', value: expiredCount, col: 'G', fmt: '#,##0', color: 'FFDC2626' },
      { label: 'TOTAL PORTFOLIO VALUE', value: totalValue, col: 'I', fmt: '₹#,##0.00', color: 'FF0D9488' }
    ];

    summaries.forEach(s => {
      const lblCell = ws.getCell(`${s.col}4`);
      lblCell.value = s.label;
      lblCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF64748B' } };
      lblCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.mergeCells(`${s.col}4:${String.fromCharCode(s.col.charCodeAt(0) + 1)}4`);

      const valCell = ws.getCell(`${s.col}5`);
      valCell.value = s.value;
      valCell.numFmt = s.fmt;
      valCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: s.color } };
      valCell.alignment = { horizontal: 'center', vertical: 'middle' };
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      ws.mergeCells(`${s.col}5:${String.fromCharCode(s.col.charCodeAt(0) + 1)}5`);

      const borderStyle = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
      for (let r = 4; r <= 5; r++) {
        for (let cOff = 0; cOff <= 1; cOff++) {
          const colLetter = String.fromCharCode(s.col.charCodeAt(0) + cOff);
          const cell = ws.getCell(`${colLetter}${r}`);
          cell.border = {
            top: r === 4 ? borderStyle : undefined,
            bottom: r === 5 ? borderStyle : undefined,
            left: cOff === 0 ? borderStyle : undefined,
            right: cOff === 1 ? borderStyle : undefined
          };
        }
      }
    });

    ws.getRow(4).height = 18;
    ws.getRow(5).height = 24;
    ws.getRow(6).height = 12;

    ws.columns = [
      { key: 'name', width: 28 },
      { key: 'reference_number', width: 22 },
      { key: 'description', width: 35 },
      { key: 'start_date', width: 15 },
      { key: 'original_expiry_date', width: 22 },
      { key: 'extended_expiry_date', width: 22 },
      { key: 'closed_date', width: 15 },
      { key: 'value', width: 18 },
      { key: 'status', width: 16 },
      { key: 'file_url', width: 32 }
    ];

    const headers = [
      'Document Name',
      'Reference Number',
      'Description',
      'Start Date',
      'Original Expiry Date',
      'Extended Expiry Date',
      'Closed Date',
      'Total Value',
      'Status',
      'File Link'
    ];

    const headerRow = ws.getRow(7);
    headerRow.height = 28;
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F172A' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FF475569' } },
        right: { style: 'thin', color: { argb: 'FF475569' } }
      };
    });

    list.forEach((doc, idx) => {
      const rowNum = 8 + idx;
      const row = ws.getRow(rowNum);
      row.height = 24;

      row.getCell(1).value = doc.name;
      row.getCell(2).value = doc.reference_number;
      row.getCell(3).value = doc.description || '';

      row.getCell(4).value = doc.start_date ? new Date(doc.start_date) : '';
      row.getCell(5).value = doc.original_expiry_date ? new Date(doc.original_expiry_date) : '';
      row.getCell(6).value = doc.extended_expiry_date ? new Date(doc.extended_expiry_date) : '';
      row.getCell(7).value = doc.closed_date ? new Date(doc.closed_date) : '';

      row.getCell(8).value = doc.value ? Number(doc.value) : 0;

      const computedStatus = doc.computed_status || doc.status;
      row.getCell(9).value = computedStatus;

      if (doc.file_url) {
        row.getCell(10).value = {
          text: doc.file_name || 'Download',
          hyperlink: doc.file_url
        };
      } else {
        row.getCell(10).value = '';
      }

      const isEven = idx % 2 === 0;
      const rowFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' } };
      const borderStyle = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };

      for (let col = 1; col <= 10; col++) {
        const cell = row.getCell(col);
        cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
        cell.fill = rowFill;
        cell.border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

        if ([1, 3].includes(col)) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if ([2, 4, 5, 6, 7].includes(col)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (col >= 4 && col <= 7 && cell.value) {
            cell.numFmt = 'yyyy-mm-dd';
          }
        } else if (col === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '₹#,##0.00';
        } else if (col === 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          const statusLower = String(computedStatus).toLowerCase();
          if (statusLower === 'expired') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } };
          } else if (statusLower === 'expiring soon') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF92400E' } };
          } else if (['active', 'pending'].includes(statusLower)) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF065F46' } };
          } else if (statusLower === 'closed') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF374151' } };
          }
        } else if (col === 10) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (cell.value && typeof cell.value === 'object') {
            cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF0F766E' }, underline: true };
          }
        }
      }
    });

    const totalRowIndex = 8 + list.length;
    const totalRow = ws.getRow(totalRowIndex);
    totalRow.height = 26;

    totalRow.getCell(1).value = 'TOTALS';
    totalRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    const valCell = totalRow.getCell(8);
    valCell.value = { formula: `SUM(H8:H${totalRowIndex - 1})` };
    valCell.numFmt = '₹#,##0.00';
    valCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    valCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const borderTop = { style: 'thin' as const, color: { argb: 'FF1E293B' } };
    const borderBottom = { style: 'double' as const, color: { argb: 'FF1E293B' } };
    for (let col = 1; col <= 10; col++) {
      const cell = totalRow.getCell(col);
      cell.border = { top: borderTop, bottom: borderBottom };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Documents_Directory_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.add({ title: 'Excel report downloaded successfully!', color: 'success' });
  } catch (err: any) {
    console.error('Excel export error:', err);
    toast.add({ title: 'Failed to export Excel report: ' + err.message, color: 'error' });
  }
}

// File Selection Handler
const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files.item(0);
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.add({ title: 'File Rejected', description: 'Maximum file size permitted is 500 KB', color: 'error' });
      fileToUpload.value = null;
      uploadInputKey.value++;
    } else {
      fileToUpload.value = file;
    }
  }
}

const openAddModal = () => {
  isEditMode.value = false;
  editingId.value = null;
  form.value = {
    name: '',
    referenceNumber: '',
    description: '',
    startDate: '',
    originalExpiryDate: '',
    closedDate: '',
    extendedExpiryDate: '',
    value: 0,
    status: 'Active'
  };
  fileToUpload.value = null;
  uploadInputKey.value++;
  isModalOpen.value = true;
}

const openEditModal = (doc: DocumentItem) => {
  isEditMode.value = true;
  editingId.value = doc.id;
  form.value = {
    name: doc.name,
    referenceNumber: doc.reference_number,
    description: doc.description || '',
    startDate: doc.start_date ? (doc.start_date.split('T')[0] || '') : '',
    originalExpiryDate: doc.original_expiry_date ? (doc.original_expiry_date.split('T')[0] || '') : '',
    closedDate: doc.closed_date ? (doc.closed_date.split('T')[0] || '') : '',
    extendedExpiryDate: doc.extended_expiry_date ? (doc.extended_expiry_date.split('T')[0] || '') : '',
    value: parseFloat(String(doc.value)) || 0,
    status: doc.status
  };
  fileToUpload.value = null;
  uploadInputKey.value++;
  isModalOpen.value = true;
}

const submitForm = async () => {
  if (!form.value.name || !form.value.referenceNumber || !form.value.originalExpiryDate) {
    toast.add({ title: 'Validation Error', description: 'Please complete all required fields.', color: 'warning' });
    return;
  }

  const formData = new FormData();
  formData.append('name', form.value.name);
  formData.append('referenceNumber', form.value.referenceNumber);
  formData.append('description', form.value.description);
  formData.append('startDate', form.value.startDate);
  formData.append('originalExpiryDate', form.value.originalExpiryDate);
  formData.append('closedDate', form.value.closedDate);
  formData.append('extendedExpiryDate', form.value.extendedExpiryDate);
  formData.append('value', String(form.value.value));
  formData.append('status', form.value.status);

  if (fileToUpload.value) {
    formData.append('file', fileToUpload.value);
  }

  try {
    let res;
    if (isEditMode.value && editingId.value) {
      res = await updateDocument(editingId.value, formData);
    } else {
      res = await createDocument(formData);
    }

    if (res.success) {
      toast.add({ 
        title: 'Success', 
        description: isEditMode.value ? 'Document updated successfully' : 'Document added successfully', 
        color: 'success' 
      });
      isModalOpen.value = false;
      fetchDocuments();
    }
  } catch (err: any) {
    toast.add({ title: 'Upload Failed', description: err.message, color: 'error' });
  }
}

const deleteDoc = async (id: string) => {
  if (!confirm('Are you sure you want to permanently delete this document?')) return;
  try {
    const res = await removeDoc(id);
    if (res.success) {
      toast.add({ title: 'Deleted', description: 'Document removed successfully', color: 'success' });
      fetchDocuments();
    }
  } catch (err: any) {
    toast.add({ title: 'Error deleting', description: err.message, color: 'error' });
  }
}

// Client-Side Searching/Filtering
const filteredDocuments = computed(() => {
  if (!searchQuery.value.trim()) {
    return rawDocuments.value;
  }
  const query = searchQuery.value.toLowerCase().trim();
  return rawDocuments.value.filter(doc => {
    return (
      (doc.name && doc.name.toLowerCase().includes(query)) ||
      (doc.reference_number && doc.reference_number.toLowerCase().includes(query)) ||
      (doc.description && doc.description.toLowerCase().includes(query))
    );
  });
});

// Client-Side Sorting
const sortedDocuments = computed(() => {
  const list = [...filteredDocuments.value];
  const field = sortBy.value;
  const order = sortOrder.value === 'asc' ? 1 : -1;
  
  list.sort((a, b) => {
    if (field === 'expiry_date') {
      const dateA = a.extended_expiry_date || a.original_expiry_date || '';
      const dateB = b.extended_expiry_date || b.original_expiry_date || '';
      return dateA.localeCompare(dateB) * order;
    } else if (field === 'start_date') {
      const dateA = a.start_date || '';
      const dateB = b.start_date || '';
      return dateA.localeCompare(dateB) * order;
    } else if (field === 'name') {
      const valA = a.name || '';
      const valB = b.name || '';
      return valA.localeCompare(valB) * order;
    } else if (field === 'reference_number') {
      const valA = a.reference_number || '';
      const valB = b.reference_number || '';
      return valA.localeCompare(valB) * order;
    } else if (field === 'description') {
      const valA = a.description || '';
      const valB = b.description || '';
      return valA.localeCompare(valB) * order;
    } else if (field === 'status') {
      const valA = a.computed_status || a.status || '';
      const valB = b.computed_status || b.status || '';
      return valA.localeCompare(valB) * order;
    } else if (field === 'value') {
      const valA = parseFloat(String(a.value)) || 0;
      const valB = parseFloat(String(b.value)) || 0;
      return (valA - valB) * order;
    }
    return 0;
  });
  return list;
});

const handleSort = (field: string) => {
  if (sortBy.value === field) {
    if (sortOrder.value === 'asc') {
      sortOrder.value = 'desc';
    } else {
      sortBy.value = 'expiry_date';
      sortOrder.value = 'asc';
    }
  } else {
    sortBy.value = field;
    sortOrder.value = 'asc';
  }
}

const paginatedDocuments = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return sortedDocuments.value.slice(start, end);
});

watch([searchQuery, sortBy, sortOrder], () => {
  currentPage.value = 1;
});

watch(selectedFirmId, () => {
  fetchDocuments();
});

// Dashboard Statistics
const totalDocsCount = computed(() => rawDocuments.value.length)

const expiredDocsCount = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return rawDocuments.value.filter(doc => {
    if (doc.status === 'Closed') return false
    const expiryStr = doc.extended_expiry_date || doc.original_expiry_date
    if (!expiryStr) return false
    const expiry = new Date(expiryStr)
    expiry.setHours(0, 0, 0, 0)
    return expiry < today
  }).length
})

const expiringSoonDocsCount = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysLater = new Date()
  thirtyDaysLater.setDate(today.getDate() + 30)
  thirtyDaysLater.setHours(0, 0, 0, 0)
  return rawDocuments.value.filter(doc => {
    if (doc.status === 'Closed') return false
    const expiryStr = doc.extended_expiry_date || doc.original_expiry_date
    if (!expiryStr) return false
    const expiry = new Date(expiryStr)
    expiry.setHours(0, 0, 0, 0)
    return expiry >= today && expiry <= thirtyDaysLater
  }).length
})

const activePortfolioValue = computed(() => {
  return rawDocuments.value
    .filter(doc => doc.status !== 'Closed')
    .reduce((sum, doc) => sum + (parseFloat(String(doc.value)) || 0), 0)
})

const upcomingExpiries = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return [...rawDocuments.value]
    .filter(doc => doc.status !== 'Closed')
    .map(doc => {
      const expiryStr = doc.extended_expiry_date || doc.original_expiry_date
      let daysRemaining = null
      if (expiryStr) {
        const expiry = new Date(expiryStr)
        expiry.setHours(0, 0, 0, 0)
        daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      }
      return {
        ...doc,
        expiry_date: expiryStr,
        daysRemaining
      }
    })
    .sort((a, b) => {
      if (a.daysRemaining === null) return 1
      if (b.daysRemaining === null) return -1
      return a.daysRemaining - b.daysRemaining
    })
    .slice(0, 5)
})

const highestValueContracts = computed(() => {
  return [...rawDocuments.value]
    .filter(doc => doc.status !== 'Closed')
    .sort((a, b) => (parseFloat(String(b.value)) || 0) - (parseFloat(String(a.value)) || 0))
    .slice(0, 5)
})

const expiryForecastData = computed(() => {
  const map: Record<string, number> = {}
  rawDocuments.value.forEach(doc => {
    if (doc.status === 'Closed') return
    const expiryStr = doc.extended_expiry_date || doc.original_expiry_date
    const val = parseFloat(String(doc.value)) || 0
    const firstPart = expiryStr ? expiryStr.split('-')[0] : null
    const year = firstPart || 'No Expiry'
    if (!map[year]) map[year] = 0
    map[year] += val
  })
  return Object.entries(map)
    .map(([year, val]) => ({ year, val }))
    .sort((a, b) => {
      if (a.year === 'No Expiry') return 1
      if (b.year === 'No Expiry') return -1
      return a.year.localeCompare(b.year)
    })
})

const statusDistributionData = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysLater = new Date()
  thirtyDaysLater.setDate(today.getDate() + 30)
  thirtyDaysLater.setHours(0, 0, 0, 0)

  let expired = 0
  let expiringSoon = 0
  let activePending = 0
  let closed = 0

  rawDocuments.value.forEach(doc => {
    const status = (doc.status || '').toLowerCase()
    if (status === 'closed') {
      closed++
      return
    }

    const expiryStr = doc.extended_expiry_date || doc.original_expiry_date
    if (!expiryStr) {
      activePending++
      return;
    }

    const expiry = new Date(expiryStr)
    expiry.setHours(0, 0, 0, 0)

    if (expiry < today) {
      expired++
    } else if (expiry < thirtyDaysLater) {
      expiringSoon++
    } else {
      activePending++
    }
  })

  return { expired, expiringSoon, activePending, closed }
})

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

const formatCompact = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`
  return `₹${val}`
}

const renderCharts = () => {
  nextTick(() => {
    renderBarChart()
    renderDoughnutChart()
  })
}

const renderBarChart = () => {
  if (!barChartRef.value) return
  if (barChart) barChart.destroy()

  const ctx = barChartRef.value.getContext('2d')
  if (!ctx) return

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: expiryForecastData.value.map(d => d.year),
      datasets: [
        {
          label: 'Expiring Contract Value',
          data: expiryForecastData.value.map(d => d.val),
          backgroundColor: 'rgba(20, 184, 166, 0.75)',
          borderColor: 'rgba(20, 184, 166, 1)',
          borderWidth: 1.5,
          borderRadius: 6,
          barPercentage: 0.5,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { size: 11, weight: 'bold' },
          bodyFont: { size: 10 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => ` Value: ${formatCurrency(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10, weight: 'bold' } }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
          ticks: {
            font: { size: 9 },
            callback: (val: any) => formatCompact(val)
          }
        }
      }
    }
  })
}

const renderDoughnutChart = () => {
  if (!doughnutChartRef.value) return
  if (doughnutChart) doughnutChart.destroy()

  const ctx = doughnutChartRef.value.getContext('2d')
  if (!ctx) return

  const dist = statusDistributionData.value

  doughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Expired', 'Expiring Soon', 'Active/Pending', 'Closed'],
      datasets: [
        {
          data: [dist.expired, dist.expiringSoon, dist.activePending, dist.closed],
          backgroundColor: [
            'rgba(239, 68, 68, 0.75)',
            'rgba(245, 158, 11, 0.75)',
            'rgba(16, 185, 129, 0.75)',
            'rgba(100, 116, 139, 0.75)'
          ],
          borderColor: [
            'rgba(239, 68, 68, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(100, 116, 139, 1)'
          ],
          borderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 10, weight: 'bold' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { size: 11, weight: 'bold' },
          bodyFont: { size: 10 },
          padding: 10,
          cornerRadius: 8
        }
      },
      cutout: '65%'
    }
  })
}

watch(activeTab, (newTab) => {
  if (newTab === 'dashboard') {
    renderCharts()
  }
})

watch(rawDocuments, () => {
  if (activeTab.value === 'dashboard') {
    renderCharts()
  }
}, { deep: true })

onMounted(() => {
  fetchDocuments();
});

onUnmounted(() => {
  if (barChart) barChart.destroy()
  if (doughnutChart) doughnutChart.destroy()
})
</script>
