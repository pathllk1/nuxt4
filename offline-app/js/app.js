// js/app.js
(function (global) {
  'use strict';

  const { createApp, ref, onMounted } = Vue;

  const App = {
    components: {
      NavbarComponent: global.NavbarComponent,
      SidebarComponent: global.SidebarComponent,
      FooterComponent: global.FooterComponent,
      FirmSettingsComponent: global.FirmSettingsComponent,
      DashboardStatsComponent: global.DashboardStatsComponent,
      StockManagerComponent: global.StockManagerComponent,
      StockModalComponent: global.StockModalComponent,
      BillManagerComponent: global.BillManagerComponent,
      InvoiceWorkspaceComponent: global.InvoiceWorkspaceComponent,
      StockLedgerComponent: global.StockLedgerComponent,
      PartyManagerComponent: global.PartyManagerComponent,
      ExportModalComponent: global.ExportModalComponent,
      SqlConsoleComponent: global.SqlConsoleComponent,
      ToastNotificationComponent: global.ToastNotificationComponent
    },
    setup() {
      const currentTab = ref('dashboard');
      const isSidebarCollapsed = ref(true);
      const showStockModal = ref(false);
      const editingStock = ref(null);
      const showExportModal = ref(false);

      // Return mode state
      const isReturnMode = ref(false);
      const sourceReturnBill = ref(null);

      // WebSQL database engine
      const webSql = global.useWebSql();

      let notify = null;
      let audit = null;

      // 0. Firm Settings Composable
      const firmManager = global.useFirm(
        (msg, type) => notify && notify(msg, type),
        (act, details) => audit && audit(act, details)
      );

      // 1. Inventory Composable
      const inventory = global.useInventory(
        (msg, type) => notify && notify(msg, type),
        (act, details) => audit && audit(act, details)
      );

      // 2. Parties Composable
      const partiesManager = global.useParties(
        (msg, type) => notify && notify(msg, type),
        (act, details) => audit && audit(act, details)
      );

      // 3. Stock Ledger Composable
      const stockLedger = global.useStockLedger(
        (msg, type) => notify && notify(msg, type)
      );

      // 4. Bills Composable
      const billsManager = global.useBills(
        (msg, type) => notify && notify(msg, type),
        (act, details) => audit && audit(act, details),
        async () => {
          await inventory.loadStocks();
          await stockLedger.loadMovements();
        }
      );

      // Stock Modal Handlers
      const openAddStock = () => {
        editingStock.value = null;
        showStockModal.value = true;
      };

      const openEditStock = (item) => {
        editingStock.value = item;
        showStockModal.value = true;
      };

      const handleSaveStock = async (formData) => {
        let success = false;
        if (editingStock.value && editingStock.value.id) {
          success = await inventory.updateStock(editingStock.value.id, formData);
        } else {
          success = await inventory.addStock(formData);
        }
        if (success) {
          showStockModal.value = false;
          await stockLedger.loadMovements();
        }
      };

      const handleAdjustStock = (item) => {
        const input = prompt(`Enter new physical stock quantity for "${item.item}" (Current: ${item.qty} ${item.uom}):`, item.qty);
        if (input !== null && input.trim() !== '') {
          const newQty = Number(input);
          if (!isNaN(newQty) && newQty >= 0) {
            inventory.adjustStock(item.id, newQty, 'Manual Physical Audit');
          } else {
            if (notify) notify('Please enter a valid positive number', 'warning');
          }
        }
      };

      // Invoice Workspace Handlers
      const workspaceInitialItemType = ref('GOODS');

      const openSalesWorkspace = (itemType = 'GOODS') => {
        isReturnMode.value = false;
        sourceReturnBill.value = null;
        workspaceInitialItemType.value = itemType;
        currentTab.value = 'sales_workspace';
      };

      const openPurchaseWorkspace = (itemType = 'GOODS') => {
        isReturnMode.value = false;
        sourceReturnBill.value = null;
        workspaceInitialItemType.value = itemType;
        currentTab.value = 'purchase_workspace';
      };

      const openReturnWorkspace = (bill) => {
        isReturnMode.value = true;
        sourceReturnBill.value = bill;
        if (bill.btype === 'PURCHASE') {
          currentTab.value = 'purchase_workspace';
        } else {
          currentTab.value = 'sales_workspace';
        }
      };

      const handleSaveInvoiceWorkspace = async (payload) => {
        const success = await billsManager.createBill(payload.bill, payload.items);
        if (success) {
          isReturnMode.value = false;
          sourceReturnBill.value = null;
          // Keep workspace mounted so user can interact with the Nuxt 4 Print & Success modal (P for PDF, E for Excel, W for Word)
          // Pressing ESC or Next Bill will emit 'cancel' to navigate to bills
        }
        return success;
      };

      // Document Exports
      const handleDownloadPdf = async (bill) => {
        if (!global.PdfExportService) return;
        try {
          const items = await billsManager.getBillItems(bill.id);
          global.PdfExportService.generateInvoicePdf(bill, items, firmManager.firm.value);
          if (notify) notify(`PDF invoice downloaded for ${bill.bno}`, 'success');
        } catch (err) {
          console.error('PDF generation error:', err);
          if (notify) notify('PDF generation failed: ' + err.message, 'error');
        }
      };

      const handleDownloadWord = async (bill) => {
        if (!global.WordExportService) return;
        try {
          const items = await billsManager.getBillItems(bill.id);
          await global.WordExportService.generateBillWordDoc(bill, items, null, firmManager.firm.value);
          if (notify) notify(`Word document downloaded for ${bill.bno}`, 'success');
        } catch (err) {
          console.error('Word generation error:', err);
          if (notify) notify('Word generation failed: ' + err.message, 'error');
        }
      };

      const handleExportExcelBills = async () => {
        if (!global.ExcelExportService) return;
        try {
          await global.ExcelExportService.exportBills(billsManager.bills.value);
          if (notify) notify('Bills register exported to Excel', 'success');
        } catch (err) {
          if (notify) notify('Excel export failed: ' + err.message, 'error');
        }
      };

      onMounted(async () => {
        await webSql.initDatabase();
        await firmManager.loadFirmSettings();
        await inventory.loadStocks();
        await partiesManager.loadParties();
        await billsManager.loadBills();
        await stockLedger.loadMovements();
      });

      return {
        currentTab,
        showStockModal,
        editingStock,
        showExportModal,
        isReturnMode,
        sourceReturnBill,
        workspaceInitialItemType,
        webSql,
        firmManager,
        firm: firmManager.firm,
        firmLocations: firmManager.locations,
        activeLocation: firmManager.activeLocation,
        inventory,
        partiesManager,
        billsManager,
        stockLedger,

        // Direct top-level unwrapped reactive bindings
        stocks: inventory.filteredStocks,
        stockMetrics: inventory.metrics,
        parties: partiesManager.filteredParties,
        bills: billsManager.filteredBills,
        billMetrics: billsManager.metrics,
        movements: stockLedger.filteredMovements,
        stockSearchQuery: inventory.searchQuery,
        stockStatusFilter: inventory.statusFilter,
        billSearchQuery: billsManager.searchQuery,
        billSelectedType: billsManager.selectedType,
        ledgerSearchQuery: stockLedger.searchQuery,
        ledgerTypeFilter: stockLedger.typeFilter,
        partySearchQuery: partiesManager.searchQuery,
        partyTypeFilter: partiesManager.typeFilter,

        isSidebarCollapsed,
        openAddStock,
        openEditStock,
        handleSaveStock,
        handleAdjustStock,
        openSalesWorkspace,
        openPurchaseWorkspace,
        openReturnWorkspace,
        handleSaveInvoiceWorkspace,
        handleDownloadPdf,
        handleDownloadWord,
        handleExportExcelBills,

        setNotifyAndAudit(n, a) {
          notify = n;
          audit = a;
        }
      };
    },
    template: `
      <div class="min-h-screen flex flex-col font-sans antialiased text-slate-900 relative bg-slate-50 w-full">
        <!-- Toast Notification Alert System -->
        <ToastNotificationComponent />

        <!-- Top Navigation Header (100% Dynamic Real Data) -->
        <NavbarComponent
          :current-tab="currentTab"
          :firm="firm"
          :active-location="activeLocation"
          :engine-type="webSql.engineType"
          @change-tab="(tab) => currentTab = tab"
          @open-export="showExportModal = true"
        />

        <!-- Layout Container: Left Sidebar + Main Content Area -->
        <div class="flex flex-1 relative w-full">
          <!-- Left Collapsible Icon Sidebar -->
          <SidebarComponent
            :current-tab="currentTab"
            :is-collapsed="isSidebarCollapsed"
            :firm="firm"
            @change-tab="(tab) => currentTab = tab"
            @toggle-collapse="isSidebarCollapsed = !isSidebarCollapsed"
            class="hidden md:block"
          />

          <!-- Main Content Area (100% Matching Nuxt 4 default.vue) -->
          <main 
            class="relative flex-1 transition-all duration-300 overflow-x-hidden min-h-[calc(100vh-80px)] pt-12 pb-8 bg-slate-50 w-full"
            :class="isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'"
          >
            <!-- 0. Inventory Intelligence Dashboard Tab -->
            <div v-if="currentTab === 'dashboard'" class="p-3 sm:p-4 space-y-3">
              <DashboardStatsComponent
                :stocks="inventory.stocks.value"
                :bills="billsManager.bills.value"
                :movements="stockLedger.movements.value"
                :stock-metrics="stockMetrics"
                :bill-metrics="billMetrics"
                :firm="firm"
                :firm-locations="firmLocations"
                :loading="inventory.loading"
                @navigate-tab="(tab) => currentTab = tab"
                @open-stock-modal="openAddStock"
                @open-sales="openSalesWorkspace('GOODS')"
                @open-purchase="openPurchaseWorkspace('GOODS')"
                @open-service-sale="openSalesWorkspace('SERVICE')"
                @open-service-purchase="openPurchaseWorkspace('SERVICE')"
                @refresh="async () => { await inventory.loadStocks(); await billsManager.loadBills(); await stockLedger.loadMovements(); }"
              />
            </div>

            <!-- 1. Stocks Master Register Tab -->
            <section v-if="currentTab === 'stocks'" class="w-full p-3 sm:p-4">
              <StockManagerComponent
                :stocks="stocks"
                v-model:search-query="stockSearchQuery"
                v-model:status-filter="stockStatusFilter"
                :loading="inventory.loading"
                @open-stock-modal="openAddStock"
                @edit-stock="openEditStock"
                @adjust-stock="handleAdjustStock"
                @delete-stock="(item) => inventory.deleteStock(item.id, item.item)"
                @export-excel="inventory.exportToExcel"
              />
            </section>

            <!-- 2. Vouchers & Bills Tab -->
            <section v-if="currentTab === 'bills'" class="w-full p-3 sm:p-4">
              <BillManagerComponent
                :bills="bills"
                v-model:selected-type="billSelectedType"
                v-model:search-query="billSearchQuery"
                :loading="billsManager.loading"
                @create-sale="openSalesWorkspace"
                @create-purchase="openPurchaseWorkspace"
                @create-return="openReturnWorkspace"
                @download-pdf="handleDownloadPdf"
                @download-word="handleDownloadWord"
                @delete-bill="(b) => billsManager.deleteBill(b.id, b.bno)"
                @export-excel="handleExportExcelBills"
              />
            </section>

            <!-- 3. Sales Invoice Workspace (100% Flush Full-Bleed Matching Image 1) -->
            <section v-if="currentTab === 'sales_workspace'" class="w-full">
              <InvoiceWorkspaceComponent
                mode="sales"
                :parties="parties"
                :stocks="inventory.stocks.value"
                :firm="firm"
                :firm-locations="firmLocations"
                :is-return-mode="isReturnMode"
                :source-bill="sourceReturnBill"
                :initial-item-type="workspaceInitialItemType"
                :save-invoice="handleSaveInvoiceWorkspace"
                @save-invoice="handleSaveInvoiceWorkspace"
                @add-party="(p) => partiesManager.addParty(p)"
                @add-stock="(s) => inventory.addStock(s)"
                @cancel="currentTab = 'bills'"
              />
            </section>

            <!-- 4. Purchase Bill Workspace (100% Flush Full-Bleed Matching Image 1) -->
            <section v-if="currentTab === 'purchase_workspace'" class="w-full">
              <InvoiceWorkspaceComponent
                mode="purchase"
                :parties="parties"
                :stocks="inventory.stocks.value"
                :firm="firm"
                :firm-locations="firmLocations"
                :is-return-mode="isReturnMode"
                :source-bill="sourceReturnBill"
                :initial-item-type="workspaceInitialItemType"
                :save-invoice="handleSaveInvoiceWorkspace"
                @save-invoice="handleSaveInvoiceWorkspace"
                @add-party="(p) => partiesManager.addParty(p)"
                @add-stock="(s) => inventory.addStock(s)"
                @cancel="currentTab = 'bills'"
              />
            </section>

            <!-- 5. Stock Movement Ledger Tab -->
            <section v-if="currentTab === 'ledger'" class="w-full p-3 sm:p-4">
              <StockLedgerComponent
                :movements="movements"
                v-model:search-query="ledgerSearchQuery"
                v-model:type-filter="ledgerTypeFilter"
                :loading="stockLedger.loading"
              />
            </section>

            <!-- 6. Parties Directory Tab -->
            <section v-if="currentTab === 'parties'" class="w-full p-3 sm:p-4">
              <PartyManagerComponent
                :parties="parties"
                v-model:search-query="partySearchQuery"
                v-model:type-filter="partyTypeFilter"
                :loading="partiesManager.loading"
                @add-party="(p) => partiesManager.addParty(p)"
                @delete-party="(p) => partiesManager.deleteParty(p.id, p.name)"
              />
            </section>

            <!-- 7. Firm Settings Subsystem -->
            <section v-if="currentTab === 'firm_settings'" class="w-full p-3 sm:p-4">
              <FirmSettingsComponent
                :firm="firm"
                @save-firm="firmManager.saveFirmSettings"
                @close="currentTab = 'dashboard'"
              />
            </section>

            <!-- 8. SQL Terminal Console Tab -->
            <section v-if="currentTab === 'sql'" class="w-full p-3 sm:p-4">
              <SqlConsoleComponent
                :engine-type="webSql.engineType"
                :is-native="webSql.isNative"
              />
            </section>
          </main>
        </div>

        <!-- Stock Item Add / Edit Modal -->
        <StockModalComponent
          :show="showStockModal"
          :stock-to-edit="editingStock"
          @close="showStockModal = false"
          @save="handleSaveStock"
        />

        <!-- Document Export Center Modal -->
        <ExportModalComponent
          :show="showExportModal"
          :stocks="inventory.stocks.value"
          :bills="billsManager.bills.value"
          @close="showExportModal = false"
        />

        <!-- Fixed Bottom Status Footer (100% Dynamic Real Data) -->
        <FooterComponent :firm="firm" />
      </div>
    `
  };

  const app = createApp(App);
  app.use(global.NotificationPlugin);
  app.use(global.LoggerPlugin);

  const mountedInstance = app.mount('#app');
  if (mountedInstance.setNotifyAndAudit) {
    mountedInstance.setNotifyAndAudit(
      app.config.globalProperties.$notify,
      app.config.globalProperties.$audit
    );
  }
})(window);
