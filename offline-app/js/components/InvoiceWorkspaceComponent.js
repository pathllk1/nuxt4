// components/InvoiceWorkspaceComponent.js
// 100% Faithful Replica of Nuxt 4 app/pages/accounting/sales/new.vue & purchases/new.vue
(function (global) {
  'use strict';

  const InvoiceWorkspaceComponent = {
    props: {
      mode: { type: String, default: 'sales' }, // 'sales' | 'purchase'
      parties: { type: Array, default: () => [] },
      stocks: { type: Array, default: () => [] },
      isReturnMode: { type: Boolean, default: false },
      sourceBill: { type: Object, default: null },
      initialItemType: { type: String, default: 'GOODS' },
      firm: { type: Object, default: () => ({}) },
      firmLocations: { type: Array, default: () => [] },
      saveInvoice: { type: Function, default: null }
    },
    emits: ['save-invoice', 'cancel', 'open-party-modal', 'add-party', 'add-stock'],
    data() {
      return {
        selectedFirmGstin: '',
        meta: {
          btype: this.initialItemType === 'SERVICE' ? 'SERVICE' : (this.mode === 'purchase' ? 'PURCHASE' : 'SALES'),
          billNo: '',
          supplierBillNo: '',
          billDate: new Date().toISOString().split('T')[0],
          billType: 'intra-state', // 'intra-state' | 'inter-state'
          reverseCharge: false,
          referenceNo: '',
          vehicleNo: '',
          dispatchThrough: '',
          narration: '',
          firmGstin: '',
          firmState: '',
          firmStateCode: ''
        },
        selectedParty: null,
        selectedConsignee: {
          name: '',
          address: '',
          gstin: '',
          state: 'Maharashtra',
          stateCode: '27'
        },
        consigneeSameAsBillTo: true,
        cart: [], // Starts empty (0 lines) matching Image 1
        otherCharges: [], // F4 modal charges [{ label: 'Freight', amount: 0, grate: 18 }]

        // Modals state
        showStockSelectorModal: false,
        stockSearchQuery: '',
        stockSelectedIndex: 0,
        expandedStockId: null,
        editingStockId: null,
        showPartyDrawer: false,
        partySearchQuery: '',
        partySelectedIndex: 0,
        showOtherChargesModal: false,
        showHistoryModal: false,
        showQuickAddPartyModal: false,
        showQuickAddStockModal: false,
        showPrintModal: false,
        showHelpModal: false,
        wasStockSelectorOpen: false,
        wasPartyDrawerOpen: false,
        editingPartyId: null,

        // Quick add stock form (100% matching Nuxt 4 ItemStockMasterModal.vue)
        newStockForm: {
          item: '',
          pno: '',
          oem: '',
          hsn: '',
          uom: 'PCS',
          grate: 18,
          minLevel: 0,
          batches: [
            { batch: 'DEFAULT / B01', qty: 0, uom: 'PCS', rate: 0, sale_rate: 0, grate: 18, mrp: 0, expiry: '' }
          ]
        },

        // History modal state
        historyItemIndex: null,
        historyRecords: [],
        historyLoading: false,
        historySelectedIndex: 0,

        // Quick add party form
        newPartyForm: {
          name: '',
          type: this.mode === 'purchase' ? 'SUPPLIER' : 'CUSTOMER',
          gstin: '',
          phone: '',
          email: '',
          address: '',
          state: 'Maharashtra',
          stateCode: '27'
        },

        // Last saved bill result for the print modal
        createdBill: null,
        createdItems: [],

        gstEnabled: this.firm && this.firm.gst_enabled !== undefined && this.firm.gst_enabled !== null ? Boolean(Number(this.firm.gst_enabled)) : true,
        loading: false
      };
    },
    watch: {
      firm: {
        immediate: true,
        handler(val) {
          if (val && val.gst_enabled !== undefined && val.gst_enabled !== null) {
            this.gstEnabled = Boolean(Number(val.gst_enabled));
          }
        }
      },
      firmLocations: {
        immediate: true,
        handler(locs) {
          if (locs && locs.length > 0 && !this.meta.firmGstin) {
            const def = locs.find((l) => l.is_default) || locs[0];
            if (def) {
              this.meta.firmGstin = def.gst_number || '';
              this.meta.firmState = def.state || '';
              this.meta.firmStateCode = def.state_code || '';
              this.determineTaxType();
            }
          }
        }
      },
      showPartyDrawer(isOpen) {
        if (isOpen) {
          this.saveFocus();
          this.partySearchQuery = '';
          this.partySelectedIndex = 0;
          this.selectedPartyJustSet = false;
          this.$nextTick(() => {
            const input = this.$refs.partyDrawerSearchInput;
            if (input) input.focus();
          });
        } else {
          if (!this.selectedPartyJustSet) {
            this.restoreFocus();
          }
        }
      },
      partySearchQuery() {
        this.partySelectedIndex = 0;
      },
      partySelectedIndex() {
        this.$nextTick(() => {
          const activeEl = this.$el.querySelector('.party-option.active, .party-list button.bg-blue-600');
          if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
        });
      },
      stockSearchQuery() {
        this.stockSelectedIndex = 0;
      },
      stockSelectedIndex() {
        this.$nextTick(() => {
          const activeRow = this.$el.querySelector('.active-stock-row');
          if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
        });
      },
      showStockSelectorModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
          this.stockSearchQuery = '';
          this.stockSelectedIndex = 0;
          this.expandedStockId = null;
          this.stockItemJustInserted = false;
          this.$nextTick(() => {
            const input = this.$refs.stockSearchInput;
            if (input) input.focus();
          });
        } else {
          if (!this.stockItemJustInserted) {
            this.restoreFocus();
          }
        }
      },
      showOtherChargesModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
          this.$nextTick(() => {
            const el = this.$el.querySelector('.other-charges-modal input, .charges-modal-container input');
            if (el) {
              el.focus();
              if (el.select) el.select();
            }
          });
        } else {
          this.restoreFocus();
        }
      },
      showHistoryModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
          this.historySelectedIndex = 0;
          this.historyRateJustApplied = false;
          this.$nextTick(() => {
            const el = this.$el.querySelector('.history-modal-container');
            if (el) el.focus();
          });
        } else {
          if (!this.historyRateJustApplied) {
            this.restoreFocus();
          }
        }
      },
      showHelpModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
          this.$nextTick(() => {
            const btn = this.$el.querySelector('.help-modal-close-btn');
            if (btn) btn.focus();
          });
        } else {
          this.restoreFocus();
        }
      },
      showQuickAddPartyModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
          this.$nextTick(() => {
            const el = this.$refs.quickPartyNameInput;
            if (el) el.focus();
          });
        } else {
          if (!this.wasPartyDrawerOpen) {
            this.restoreFocus();
          }
        }
      },
      showQuickAddStockModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
          this.$nextTick(() => {
            const el = this.$refs.quickStockNameInput;
            if (el) el.focus();
          });
        } else {
          if (!this.wasStockSelectorOpen) {
            this.restoreFocus();
          }
        }
      },
      showPrintModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
          this.$nextTick(() => {
            const container = this.$el.querySelector('.print-modal-container');
            if (container) container.focus();
          });
        } else {
          this.restoreFocus();
        }
      }
    },
    computed: {
      totalStockOpeningQty() {
        if (!this.newStockForm.batches) return 0;
        return this.newStockForm.batches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);
      },
      totalStockValuation() {
        if (!this.newStockForm.batches) return 0;
        return this.newStockForm.batches.reduce((sum, b) => sum + ((Number(b.qty) || 0) * (Number(b.rate) || 0)), 0);
      },
      isInterState() {
        return this.meta.billType === 'inter-state';
      },
      documentTitle() {
        if (this.isReturnMode) {
          return this.mode === 'purchase' ? 'Debit Note' : 'Sales Return';
        }
        if (this.mode === 'purchase') {
          return this.meta.btype === 'SERVICE' ? 'Service Purchase Bill' : 'Purchase Bill';
        }
        if (this.meta.btype === 'PROFORMA') return 'Proforma Invoice';
        if (this.meta.btype === 'DELIVERY_NOTE') return 'Delivery Note';
        if (this.meta.btype === 'SERVICE') return 'Service Sales Invoice';
        return 'Sales Invoice';
      },
      firmDisplayName() {
        return (this.firm && (this.firm.name || this.firm.legal_name)) || '';
      },
      filteredParties() {
        const q = (this.partySearchQuery || '').toLowerCase().trim();
        return this.parties.filter((p) => {
          if (!q) return true;
          return (
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.gstin && p.gstin.toLowerCase().includes(q)) ||
            (p.phone && p.phone.toLowerCase().includes(q)) ||
            (p.state && p.state.toLowerCase().includes(q))
          );
        });
      },
      filteredStocks() {
        if (!this.stockSearchQuery || !this.stockSearchQuery.trim()) return this.stocks;
        const q = this.stockSearchQuery.toLowerCase().trim();
        return this.stocks.filter((s) => {
          return (
            (s.item && s.item.toLowerCase().includes(q)) ||
            (s.hsn && s.hsn.toLowerCase().includes(q)) ||
            (s.pno && s.pno.toLowerCase().includes(q)) ||
            (s.oem && s.oem.toLowerCase().includes(q)) ||
            (s.category && s.category.toLowerCase().includes(q))
          );
        });
      },
      flatStockNavigableList() {
        const list = [];
        for (const stock of this.filteredStocks) {
          list.push({ type: 'stock', stock });
          const stockId = stock.id || stock._id;
          if (this.expandedStockId === stockId) {
            const batches = this.getStockBatches(stock);
            if (batches.length > 1) {
              for (const batch of batches) {
                list.push({ type: 'batch', stock, batch });
              }
            }
          }
        }
        return list;
      },
      canSave() {
        return Boolean(
          this.selectedParty &&
          this.cart.some((c) => {
            const q = this.isReturnMode ? (c.returnQty !== undefined ? Number(c.returnQty) : Number(c.qty)) : Number(c.qty);
            return c.item && c.item.trim() && q > 0;
          })
        );
      },
      totals() {
        let gross = 0;
        let discount = 0;
        let taxable = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        // Line items tax calculation
        this.cart.forEach((it) => {
          const q = Number(this.isReturnMode ? (it.returnQty !== undefined ? it.returnQty : it.qty) : it.qty) || 0;
          const r = Number(it.rate) || 0;
          const d = Number(it.disc) || 0;
          const g = this.gstEnabled ? (Number(it.grate) || 0) : 0;

          const lineGross = q * r;
          const lineDisc = lineGross * (d / 100);
          const lineTaxable = lineGross - lineDisc;

          let lineCgst = 0;
          let lineSgst = 0;
          let lineIgst = 0;

          if (this.isInterState) {
            lineIgst = lineTaxable * (g / 100);
          } else {
            lineCgst = lineTaxable * (g / 200);
            lineSgst = lineTaxable * (g / 200);
          }

          gross += lineGross;
          discount += lineDisc;
          taxable += lineTaxable;
          cgst += lineCgst;
          sgst += lineSgst;
          igst += lineIgst;
        });

        // Other charges (F4) calculation
        let otherChargesTotal = 0;
        this.otherCharges.forEach((ch) => {
          const amt = Number(ch.amount) || 0;
          const g = this.gstEnabled ? (Number(ch.grate) || 0) : 0;
          otherChargesTotal += amt;
          taxable += amt;

          if (this.isInterState) {
            igst += amt * (g / 100);
          } else {
            cgst += amt * (g / 200);
            sgst += amt * (g / 200);
          }
        });

        const totalTax = cgst + sgst + igst;
        const unrounded = taxable + totalTax;
        const rounded = Math.round(unrounded);
        const roundOff = Math.round((rounded - unrounded) * 100) / 100;

        return {
          grossTotal: Math.round(gross * 100) / 100,
          discountTotal: Math.round(discount * 100) / 100,
          otherChargesTotal: Math.round(otherChargesTotal * 100) / 100,
          taxableTotal: Math.round(taxable * 100) / 100,
          cgst: Math.round(cgst * 100) / 100,
          sgst: Math.round(sgst * 100) / 100,
          igst: Math.round(igst * 100) / 100,
          totalTax: Math.round(totalTax * 100) / 100,
          roundOff,
          netTotal: rounded
        };
      },
      amountInWords() {
        if (!global.numberToWords) return '';
        return global.numberToWords(this.totals.netTotal);
      }
    },
    methods: {
      formatCurrency(val) {
        return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      onFirmGstinChange(e) {
        const val = e.target.value;
        this.selectedFirmGstin = val;
        const loc = this.firmLocations.find((l) => l.gst_number === val);
        if (loc) {
          this.meta.firmGstin = loc.gst_number || '';
          this.meta.firmState = loc.state || '';
          this.meta.firmStateCode = loc.state_code || '';
        } else {
          this.meta.firmGstin = val;
        }
        this.determineTaxType();
      },
      determineTaxType() {
        const firmCode = this.meta.firmStateCode || (this.meta.firmGstin ? this.meta.firmGstin.substring(0, 2) : '');
        const partyCode = this.selectedParty?.stateCode || (this.selectedParty?.gstin && this.selectedParty.gstin.length >= 2 ? this.selectedParty.gstin.substring(0, 2) : '');
        if (firmCode && partyCode) {
          this.meta.billType = firmCode === partyCode ? 'intra-state' : 'inter-state';
        }
      },
      selectParty(p) {
        this.selectedPartyJustSet = true;
        this.selectedParty = p;
        this.selectedConsignee = {
          name: p.name || '',
          address: p.address || '',
          gstin: p.gstin || '',
          state: p.state || 'Maharashtra',
          stateCode: p.stateCode || '27'
        };
        this.determineTaxType();
        this.showPartyDrawer = false;
        setTimeout(() => {
          const refInput = this.$el.querySelector('.detail-panel input, .field-grid input');
          if (refInput) {
            refInput.focus();
            if (typeof refInput.select === 'function') refInput.select();
          }
        }, 60);
      },
      addCartRow(itemType = 'GOODS') {
        this.cart.push({
          stockId: null,
          item: '',
          hsn: '',
          qty: 1,
          returnQty: 1,
          uom: 'PCS',
          rate: 0,
          disc: 0,
          grate: 18,
          batch: '',
          mrp: 0,
          itemType,
          narration: ''
        });
      },
      getStockBatches(stock) {
        if (!stock) return [];
        let batches = stock.batches;
        if (typeof batches === 'string' && batches.trim()) {
          try {
            batches = JSON.parse(batches);
          } catch (_) {
            batches = [];
          }
        }
        if (Array.isArray(batches) && batches.length > 0) {
          return batches;
        }
        if (stock.batch) {
          return [{
            batch: stock.batch,
            qty: Number(stock.qty) || 0,
            uom: stock.uom || 'PCS',
            rate: Number(stock.cost_rate || stock.rate) || 0,
            sale_rate: Number(stock.rate) || 0,
            grate: Number(stock.grate) !== undefined ? Number(stock.grate) : 18,
            mrp: Number(stock.mrp) || 0,
            expiry: stock.expiry || ''
          }];
        }
        return [];
      },
      isStockActive(stock) {
        const current = this.flatStockNavigableList[this.stockSelectedIndex];
        const currentStockId = current?.stock?.id || current?.stock?._id;
        const stockId = stock.id || stock._id;
        return current?.type === 'stock' && currentStockId === stockId;
      },
      isBatchActive(stock, batch) {
        const current = this.flatStockNavigableList[this.stockSelectedIndex];
        if (current?.type !== 'batch') return false;
        const currentStockId = current.stock?.id || current.stock?._id;
        const stockId = stock.id || stock._id;
        if (currentStockId !== stockId) return false;
        const currentBatchId = current.batch?._id || current.batch?.id;
        const batchId = batch._id || batch.id;
        if (batchId && currentBatchId) {
          return currentBatchId === batchId;
        }
        return current.batch?.batch === batch.batch && Number(current.batch?.rate) === Number(batch.rate);
      },
      toggleStock(stock) {
        const batches = this.getStockBatches(stock);
        const stockId = stock.id || stock._id;
        if (batches.length > 1) {
          this.expandedStockId = this.expandedStockId === stockId ? null : stockId;
        } else {
          this.selectStockRow(stock, batches[0] || null);
        }
      },
      selectStockRow(stock, batch) {
        const stockObj = {
          ...stock,
          selectedBatch: batch
        };
        this.insertStockIntoCart(stockObj);
      },
      formatDate(dateString) {
        if (!dateString) return '-';
        try {
          return new Date(dateString).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (_) {
          return dateString;
        }
      },
      insertStockIntoCart(stock) {
        const selectedBatch = stock.selectedBatch;
        const batchNo = selectedBatch?.batch || stock.batch || '';
        const stockId = stock.id || stock._id;

        const uom = selectedBatch?.uom || stock.uom || 'PCS';
        const costRate = selectedBatch?.rate !== undefined ? Number(selectedBatch.rate) : Number(stock.cost_rate || stock.rate || 0);
        const saleRate = selectedBatch?.sale_rate !== undefined ? Number(selectedBatch.sale_rate) : (selectedBatch?.rate !== undefined ? Number(selectedBatch.rate) : Number(stock.rate || 0));
        const rate = this.mode === 'purchase' ? costRate : saleRate;
        const grate = selectedBatch?.grate !== undefined ? Number(selectedBatch.grate) : Number(stock.grate !== undefined ? stock.grate : 18);
        const mrp = selectedBatch?.mrp !== undefined ? Number(selectedBatch.mrp) : Number(stock.mrp || 0);

        const existing = this.cart.find(item => item.stockId === stockId && (item.batch || '') === batchNo);
        if (existing) {
          if (this.isReturnMode) {
            existing.returnQty = (Number(existing.returnQty) || 0) + 1;
          } else {
            existing.qty = (Number(existing.qty) || 0) + 1;
          }
        } else {
          this.cart.push({
            stockId: stockId,
            item: stock.item,
            pno: stock.pno || '',
            oem: stock.oem || '',
            hsn: stock.hsn || '',
            qty: 1,
            returnQty: 1,
            uom: uom,
            rate: rate,
            cost_rate: costRate,
            disc: 0,
            grate: grate,
            batch: batchNo,
            mrp: mrp,
            itemType: 'GOODS',
            narration: ''
          });
        }
        this.stockItemJustInserted = true;
        this.showStockSelectorModal = false;
        this.expandedStockId = null;

        setTimeout(() => {
          const lastIndex = this.cart.length - 1;
          const qtyInput = this.$el.querySelector(`tr[data-row="${lastIndex}"] input.qty-input`);
          if (qtyInput) {
            qtyInput.focus();
            if (typeof qtyInput.select === 'function') qtyInput.select();
          }
        }, 60);
      },
      openQuickAddStock() {
        this.editingStockId = null;
        const q = this.stockSearchQuery ? this.stockSearchQuery.trim() : '';
        this.newStockForm = {
          item: q,
          pno: '',
          oem: '',
          hsn: '',
          uom: 'PCS',
          grate: 18,
          minLevel: 0,
          batches: [
            { batch: 'DEFAULT / B01', qty: 0, uom: 'PCS', rate: 0, sale_rate: 0, grate: 18, mrp: 0, expiry: '' }
          ]
        };
        this.wasStockSelectorOpen = this.showStockSelectorModal;
        this.showStockSelectorModal = false;
        this.showQuickAddStockModal = true;
        this.$nextTick(() => {
          const el = this.$refs.quickStockNameInput;
          if (el) el.focus();
        });
      },
      openEditStock(stock) {
        this.editingStockId = stock.id || stock._id;
        const batches = this.getStockBatches(stock);
        this.newStockForm = {
          item: stock.item || '',
          pno: stock.pno || '',
          oem: stock.oem || '',
          hsn: stock.hsn || '',
          uom: stock.uom || 'PCS',
          grate: stock.grate !== undefined ? Number(stock.grate) : 18,
          minLevel: Number(stock.min_qty || stock.minLevel) || 0,
          batches: batches.length > 0 ? JSON.parse(JSON.stringify(batches)) : [
            { batch: stock.batch || 'DEFAULT / B01', qty: Number(stock.qty) || 0, uom: stock.uom || 'PCS', rate: Number(stock.cost_rate || stock.rate) || 0, sale_rate: Number(stock.rate) || 0, grate: Number(stock.grate) || 18, mrp: Number(stock.mrp) || 0, expiry: '' }
          ]
        };
        this.wasStockSelectorOpen = this.showStockSelectorModal;
        this.showStockSelectorModal = false;
        this.showQuickAddStockModal = true;
        this.$nextTick(() => {
          const el = this.$refs.quickStockNameInput;
          if (el) {
            el.focus();
            el.select();
          }
        });
      },
      closeQuickAddStock() {
        this.showQuickAddStockModal = false;
        this.editingStockId = null;
        if (this.wasStockSelectorOpen) {
          this.wasStockSelectorOpen = false;
          this.showStockSelectorModal = true;
        }
      },
      syncStockUomToBatches() {
        this.newStockForm.batches.forEach(b => {
          b.uom = this.newStockForm.uom;
        });
      },
      syncStockGrateToBatches() {
        this.newStockForm.batches.forEach(b => {
          b.grate = this.newStockForm.grate;
        });
      },
      addStockBatch() {
        this.newStockForm.batches.push({
          batch: '',
          qty: 0,
          uom: this.newStockForm.uom,
          rate: 0,
          sale_rate: 0,
          grate: this.newStockForm.grate,
          mrp: 0,
          expiry: ''
        });
      },
      removeStockBatch(idx) {
        if (this.newStockForm.batches.length <= 1) return;
        this.newStockForm.batches.splice(idx, 1);
      },
      async handleQuickAddStock() {
        if (!this.newStockForm.item || !this.newStockForm.item.trim()) {
          if (this.$notify) this.$notify('Item Description / Name is required', 'warning');
          return;
        }
        if (this.gstEnabled && (!this.newStockForm.hsn || !this.newStockForm.hsn.trim())) {
          if (this.$notify) this.$notify('HSN / SAC Code is required in GST mode', 'warning');
          return;
        }
        if (!this.newStockForm.batches || this.newStockForm.batches.length === 0) {
          if (this.$notify) this.$notify('At least one batch row is required', 'warning');
          return;
        }

        const b0 = this.newStockForm.batches[0];
        const totalQty = this.totalStockOpeningQty;
        const primaryRate = Number(b0.sale_rate || b0.rate) || 0;
        const primaryCostRate = Number(b0.rate) || primaryRate;
        const primaryGrate = Number(this.newStockForm.grate !== undefined ? this.newStockForm.grate : b0.grate) || 18;
        const primaryMrp = Number(b0.mrp) || 0;

        const itemPayload = {
          item: this.newStockForm.item.trim(),
          pno: this.newStockForm.pno ? this.newStockForm.pno.trim() : '',
          oem: this.newStockForm.oem ? this.newStockForm.oem.trim() : '',
          hsn: this.newStockForm.hsn.trim(),
          uom: this.newStockForm.uom || 'PCS',
          rate: primaryRate,
          cost_rate: primaryCostRate,
          grate: primaryGrate,
          min_qty: Number(this.newStockForm.minLevel) || 0,
          mrp: primaryMrp,
          batch: b0.batch || '',
          batches: JSON.parse(JSON.stringify(this.newStockForm.batches)),
          qty: totalQty
        };

        if (this.editingStockId) {
          const stockId = this.editingStockId;
          const now = new Date().toISOString();
          try {
            await global.WebSqlService.executeSql(
              `UPDATE stocks SET item = ?, pno = ?, oem = ?, hsn = ?, uom = ?, rate = ?, cost_rate = ?, grate = ?, min_qty = ?, mrp = ?, batches = ?, updated_at = ? WHERE id = ?`,
              [
                itemPayload.item,
                itemPayload.pno,
                itemPayload.oem,
                itemPayload.hsn,
                itemPayload.uom,
                itemPayload.rate,
                itemPayload.cost_rate,
                itemPayload.grate,
                itemPayload.min_qty,
                itemPayload.mrp,
                JSON.stringify(itemPayload.batches),
                now,
                stockId
              ]
            );
            const found = this.stocks.find(s => (s.id || s._id) === stockId);
            if (found) {
              Object.assign(found, itemPayload, { id: stockId, _id: stockId });
            }
          } catch (err) {
            console.error('Failed to update stock:', err);
          }
          this.editingStockId = null;
          this.showQuickAddStockModal = false;
          this.showStockSelectorModal = true;
          return;
        }

        this.$emit('add-stock', itemPayload);
        this.insertStockIntoCart({
          id: Date.now(),
          ...itemPayload
        });
        this.showQuickAddStockModal = false;
        this.showStockSelectorModal = false;
        this.wasStockSelectorOpen = false;
        this.stockSearchQuery = '';
      },
      addBlankLineFromModal() {
        this.addCartRow(this.mode === 'purchase' ? 'GOODS' : 'GOODS');
        this.showStockSelectorModal = false;
      },
      handleStockModalKeydown(e) {
        const list = this.flatStockNavigableList;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (list.length > 0) {
            this.stockSelectedIndex = (this.stockSelectedIndex + 1) % list.length;
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (list.length > 0) {
            this.stockSelectedIndex = (this.stockSelectedIndex - 1 + list.length) % list.length;
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (list.length > 0 && this.stockSelectedIndex < list.length) {
            const item = list[this.stockSelectedIndex];
            if (item.type === 'batch') {
              this.selectStockRow(item.stock, item.batch);
            } else {
              const stock = item.stock;
              const batches = this.getStockBatches(stock);
              const stockId = stock.id || stock._id;
              if (batches.length > 1) {
                if (this.expandedStockId === stockId) {
                  this.selectStockRow(stock, batches[0]);
                } else {
                  this.expandedStockId = stockId;
                  this.stockSelectedIndex = this.stockSelectedIndex + 1;
                }
              } else {
                this.selectStockRow(stock, batches[0] || null);
              }
            }
          } else {
            this.openQuickAddStock();
          }
        } else if (e.key === 'Insert' || e.key === 'F5' || (e.altKey && e.key.toLowerCase() === 'c') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
          e.preventDefault();
          this.openQuickAddStock();
        } else if (e.key === 'F3' || ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'e')) {
          e.preventDefault();
          if (list.length > 0 && this.stockSelectedIndex < list.length) {
            const item = list[this.stockSelectedIndex];
            this.openEditStock(item.stock);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (this.expandedStockId) {
            this.expandedStockId = null;
          } else {
            this.showStockSelectorModal = false;
          }
        }
      },
      removeCartRow(index) {
        this.cart.splice(index, 1);
      },

      // Other Charges (F4)
      addOtherChargeRow() {
        this.otherCharges.push({ label: 'Freight & Transportation', amount: 0, grate: 18 });
      },
      removeOtherCharge(idx) {
        this.otherCharges.splice(idx, 1);
      },

      // Party-Item Rate History (Alt+H)
      async openHistoryModal(index) {
        this.historyItemIndex = index;
        const row = this.cart[index];
        if (!row || !row.item) {
          if (this.$notify) this.$notify('Please select or specify an item description first', 'warning');
          return;
        }

        this.historyLoading = true;
        this.showHistoryModal = true;
        this.historyRecords = [];

        try {
          const db = global.WebSqlService || global.webSqlService;
          if (db) {
            const query = `
              SELECT bi.item, bi.rate, bi.qty, bi.uom, bi.disc, bi.grate, b.bno, b.btype, b.bdate, b.partyName as party_name
              FROM bill_items bi
              JOIN bills b ON bi.billId = b.id
              WHERE bi.item LIKE ?
              ORDER BY b.bdate DESC LIMIT 10
            `;
            const res = await (db.executeSql ? db.executeSql(query, [`%${row.item}%`]) : db.execute(query, [`%${row.item}%`]));
            this.historyRecords = (res && res.rows) || [];
          }
        } catch (err) {
          console.error('History fetch error:', err);
        } finally {
          this.historyLoading = false;
        }
      },

      applyHistoryRate(record) {
        const rowIdx = this.historyItemIndex;
        if (rowIdx !== null && this.cart[rowIdx]) {
          this.cart[rowIdx].rate = record.rate;
          if (record.disc !== undefined) this.cart[rowIdx].disc = record.disc;
          if (record.grate !== undefined) this.cart[rowIdx].grate = record.grate;
        }
        this.historyRateJustApplied = true;
        this.showHistoryModal = false;
        setTimeout(() => {
          if (rowIdx !== null) {
            const target = this.$el.querySelector(`tr[data-row="${rowIdx}"] input.rate-input, tr[data-row="${rowIdx}"] input.qty-input`);
            if (target) {
              target.focus();
              if (typeof target.select === 'function') target.select();
            }
          }
        }, 60);
      },

      openEditPartyModal(party) {
        if (!party) return;
        this.editingPartyId = party.id;
        this.newPartyForm = {
          name: party.name || '',
          type: party.type || (this.mode === 'purchase' ? 'SUPPLIER' : 'CUSTOMER'),
          gstin: (party.gstin && party.gstin !== 'UNREGISTERED') ? party.gstin : '',
          phone: party.phone || '',
          email: party.email || '',
          address: party.address || '',
          state: party.state || 'Maharashtra',
          stateCode: party.stateCode || '27'
        };
        this.wasPartyDrawerOpen = this.showPartyDrawer;
        this.showPartyDrawer = false;
        this.showQuickAddPartyModal = true;
        this.$nextTick(() => {
          const el = this.$refs.quickPartyNameInput;
          if (el) el.focus();
        });
      },

      openQuickAddParty() {
        this.editingPartyId = null;
        this.newPartyForm = {
          name: this.partySearchQuery ? this.partySearchQuery.trim() : '',
          type: this.mode === 'purchase' ? 'SUPPLIER' : 'CUSTOMER',
          gstin: '',
          phone: '',
          email: '',
          address: '',
          state: 'Maharashtra',
          stateCode: '27'
        };
        this.wasPartyDrawerOpen = this.showPartyDrawer;
        this.showPartyDrawer = false;
        this.showQuickAddPartyModal = true;
        this.$nextTick(() => {
          const el = this.$refs.quickPartyNameInput;
          if (el) el.focus();
        });
      },
      closeQuickAddParty() {
        this.showQuickAddPartyModal = false;
        this.editingPartyId = null;
        if (this.wasPartyDrawerOpen) {
          this.wasPartyDrawerOpen = false;
          this.showPartyDrawer = true;
        }
      },

      // Quick Add Party Form submission
      handleQuickAddParty() {
        if (!this.newPartyForm.name.trim()) {
          if (this.$notify) this.$notify('Party Name is required', 'warning');
          return;
        }
        if (this.editingPartyId) {
          const updated = {
            id: this.editingPartyId,
            name: this.newPartyForm.name.trim(),
            type: this.newPartyForm.type,
            gstin: this.newPartyForm.gstin.trim().toUpperCase() || 'UNREGISTERED',
            phone: this.newPartyForm.phone.trim(),
            email: this.newPartyForm.email ? this.newPartyForm.email.trim() : '',
            address: this.newPartyForm.address ? this.newPartyForm.address.trim() : '',
            state: this.newPartyForm.state || 'Maharashtra',
            stateCode: this.newPartyForm.stateCode || '27'
          };
          this.selectParty(updated);
          const idx = this.parties.findIndex(p => p.id === this.editingPartyId);
          if (idx !== -1) {
            Object.assign(this.parties[idx], updated);
          }
          if (global.webSqlService) {
            global.webSqlService.execute(
              'UPDATE parties SET name = ?, type = ?, gstin = ?, phone = ?, email = ?, address = ?, state = ?, stateCode = ? WHERE id = ?',
              [updated.name, updated.type, updated.gstin, updated.phone, updated.email, updated.address, updated.state, updated.stateCode, updated.id]
            ).catch(err => console.error('Party update error:', err));
          }
          this.editingPartyId = null;
        } else {
          const created = {
            id: Date.now(),
            name: this.newPartyForm.name.trim(),
            type: this.newPartyForm.type,
            gstin: this.newPartyForm.gstin.trim().toUpperCase() || 'UNREGISTERED',
            phone: this.newPartyForm.phone.trim(),
            email: this.newPartyForm.email ? this.newPartyForm.email.trim() : '',
            address: this.newPartyForm.address ? this.newPartyForm.address.trim() : '',
            state: this.newPartyForm.state || 'Maharashtra',
            stateCode: this.newPartyForm.stateCode || '27'
          };

          this.$emit('add-party', created);
          this.selectParty(created);
        }
        this.showQuickAddPartyModal = false;
        this.showPartyDrawer = false;
        this.wasPartyDrawerOpen = false;
        this.newPartyForm.name = '';
        this.newPartyForm.gstin = '';
        this.newPartyForm.phone = '';
        this.newPartyForm.address = '';
      },

      // Party Drawer Keyboard navigation
      handlePartyDrawerKeydown(e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (this.filteredParties.length > 0) {
            this.partySelectedIndex = (this.partySelectedIndex + 1) % this.filteredParties.length;
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.filteredParties.length > 0) {
            this.partySelectedIndex = (this.partySelectedIndex - 1 + this.filteredParties.length) % this.filteredParties.length;
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.filteredParties.length > 0 && this.partySelectedIndex < this.filteredParties.length) {
            this.selectParty(this.filteredParties[this.partySelectedIndex]);
          } else {
            this.showPartyDrawer = false;
            this.showQuickAddPartyModal = true;
          }
        } else if (e.key === 'Insert') {
          e.preventDefault();
          this.showPartyDrawer = false;
          this.showQuickAddPartyModal = true;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.showPartyDrawer = false;
        }
      },

      toggleGst() {
        this.gstEnabled = !this.gstEnabled;
        if (!this.gstEnabled) {
          this.meta.reverseCharge = false;
        }
      },

      // Save Invoice (F8)
      async handleSave() {
        if (!this.canSave) {
          return;
        }

        const validItems = this.cart
          .filter((c) => {
            const q = this.isReturnMode ? (c.returnQty !== undefined ? Number(c.returnQty) : Number(c.qty)) : Number(c.qty);
            return c.item && c.item.trim() && q > 0;
          })
          .map((c) => {
            const q = this.isReturnMode && c.returnQty !== undefined ? Number(c.returnQty) : Number(c.qty);
            return {
              ...c,
              qty: q,
              grate: this.gstEnabled ? (Number(c.grate) || 0) : 0,
              hsn: this.gstEnabled ? (c.hsn || '') : ''
            };
          });

        let actualBtype = this.meta.btype;
        if (this.isReturnMode) {
          actualBtype = this.mode === 'purchase' ? 'DEBIT_NOTE' : 'CREDIT_NOTE';
        }

        const t = this.totals;
        const billPayload = {
          bno: this.meta.billNo,
          btype: actualBtype,
          bdate: this.meta.billDate,
          partyId: this.selectedParty.id,
          partyName: this.selectedParty.name,
          partyGstin: this.selectedParty.gstin || 'UNREGISTERED',
          partyAddress: this.selectedParty.address || '',
          partyState: this.selectedParty.state || '',
          partyStateCode: this.selectedParty.stateCode || '',
          firmGstin: this.selectedFirmGstin || this.meta.firmGstin || (this.firm && this.firm.gstin) || '',
          firmState: this.meta.firmState || (this.firm && this.firm.state) || '',
          firmStateCode: this.meta.firmStateCode || (this.firm && this.firm.stateCode) || '',
          consigneeName: this.consigneeSameAsBillTo ? this.selectedParty.name : this.selectedConsignee.name,
          consigneeAddress: this.consigneeSameAsBillTo ? this.selectedParty.address : this.selectedConsignee.address,
          consigneeGstin: this.consigneeSameAsBillTo ? (this.selectedParty.gstin || '') : (this.selectedConsignee.gstin || ''),
          supplierBillNo: this.meta.supplierBillNo || '',
          orderNo: this.meta.referenceNo || '',
          vehicleNo: this.meta.vehicleNo || '',
          dispatchThrough: this.meta.dispatchThrough || '',
          narration: this.meta.narration || '',
          reverseCharge: this.meta.reverseCharge ? 1 : 0,
          grossTotal: t.grossTotal,
          taxableTotal: t.taxableTotal,
          cgst: t.cgst,
          sgst: t.sgst,
          igst: t.igst,
          roundOff: t.roundOff,
          netTotal: t.netTotal,
          otherCharges: JSON.stringify(this.otherCharges),
          refBillId: this.sourceBill?.id || null,
          refBillNo: this.sourceBill?.bno || null
        };

        this.loading = true;
        try {
          let result = null;
          if (typeof this.saveInvoice === 'function') {
            result = await this.saveInvoice({ bill: billPayload, items: validItems });
          } else {
            this.$emit('save-invoice', { bill: billPayload, items: validItems });
            result = true;
          }

          if (result) {
            if (typeof result === 'object' && result.bno) {
              billPayload.bno = result.bno;
              billPayload.id = result.id;
            }
            this.createdBill = { ...billPayload };
            this.createdItems = validItems;
            this.showPrintModal = true;
          }
        } catch (err) {
          console.error('Save invoice error:', err);
        } finally {
          this.loading = false;
        }
      },

      downloadCreatedPDF() {
        if (global.PdfExportService && this.createdBill) {
          global.PdfExportService.generateInvoicePdf(this.createdBill, this.createdItems, this.firm);
        }
      },
      downloadCreatedExcel() {
        if (global.ExcelExportService && this.createdBill) {
          global.ExcelExportService.exportBills([this.createdBill]);
        }
      },
      downloadCreatedWord() {
        if (global.WordExportService && this.createdBill) {
          global.WordExportService.generateBillWordDoc(this.createdBill, this.createdItems, null, this.firm);
        }
      },
      closePrintModal() {
        this.showPrintModal = false;
        this.$emit('cancel');
      },

      handleGlobalKeydown(e) {
        // 1. Quick Add Stock Modal (Level 2)
        if (this.showQuickAddStockModal) {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.closeQuickAddStock();
          } else if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
            e.preventDefault();
            this.handleQuickAddStock();
          } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
            e.preventDefault();
            this.addStockBatch();
          }
          return;
        }

        // 2. Quick Add Party Modal (Level 2)
        if (this.showQuickAddPartyModal) {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.closeQuickAddParty();
          } else if (e.key === 'F8') {
            e.preventDefault();
            this.handleQuickAddParty();
          }
          return;
        }

        // 3. Stock Selector Modal (Level 1)
        if (this.showStockSelectorModal) {
          if (e.key === 'Escape') {
            e.preventDefault();
            if (this.expandedStockId) {
              this.expandedStockId = null;
            } else {
              this.showStockSelectorModal = false;
            }
          } else if (e.key === 'Insert' || e.key === 'F5' || (e.altKey && e.key.toLowerCase() === 'c') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
            e.preventDefault();
            this.openQuickAddStock();
          } else if (e.key === 'F3' || ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'e')) {
            e.preventDefault();
            if (this.flatStockNavigableList.length > 0 && this.stockSelectedIndex < this.flatStockNavigableList.length) {
              const item = this.flatStockNavigableList[this.stockSelectedIndex];
              this.openEditStock(item.stock);
            }
          }
          return;
        }

        // 4. Party Drawer (Level 1)
        if (this.showPartyDrawer) {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.showPartyDrawer = false;
          } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
            e.preventDefault();
            this.openQuickAddParty();
          }
          return;
        }

        // 5. Other Charges Modal
        if (this.showOtherChargesModal) {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.showOtherChargesModal = false;
          } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
            e.preventDefault();
            this.addOtherChargeRow();
          }
          return;
        }

        // 6. Rate History Modal
        if (this.showHistoryModal) {
          this.handleHistoryModalKeydown(e);
          return;
        }

        // 7. Help Modal
        if (this.showHelpModal) {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.showHelpModal = false;
          }
          return;
        }

        // 8. Print Modal
        if (this.showPrintModal) {
          this.handlePrintModalKeydown(e);
          return;
        }

        // 9. Root Page Shortcuts (Only active when ALL modals are closed)
        if (e.key === 'F1' || (e.shiftKey && e.key === '?')) {
          e.preventDefault();
          this.showHelpModal = true;
        } else if (e.key === 'F2') {
          e.preventDefault();
          this.showStockSelectorModal = true;
        } else if (e.key === 'F3') {
          e.preventDefault();
          this.showPartyDrawer = true;
        } else if (e.key === 'F4') {
          e.preventDefault();
          this.showOtherChargesModal = true;
        } else if (e.key === 'F5' && (e.shiftKey || e.ctrlKey)) {
          e.preventDefault();
          this.addCartRow('GOODS');
        } else if (e.key === 'F5') {
          e.preventDefault();
          this.addCartRow('SERVICE');
        } else if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S'))) {
          e.preventDefault();
          if (this.canSave) this.handleSave();
        } else if (e.key === 'F9') {
          e.preventDefault();
          this.$emit('cancel');
        } else if (e.altKey && (e.key === 'h' || e.key === 'H')) {
          e.preventDefault();
          if (this.cart.length > 0) this.openHistoryModal(0);
        } else if (e.altKey && (e.key === 'e' || e.key === 'E')) {
          e.preventDefault();
          if (this.selectedParty && !this.isReturnMode) {
            this.openEditPartyModal(this.selectedParty);
          }
        } else if (e.key === 'Insert') {
          e.preventDefault();
          const isInsideCart = document.activeElement && document.activeElement.closest('.table-wrap, .cart-table');
          if (isInsideCart) {
            this.openQuickAddStock();
          } else {
            this.openQuickAddParty();
          }
        }
      },

      // Keyboard Navigation Composable Proxies
      saveFocus() {
        if (this.nav && typeof this.nav.saveFocus === 'function') {
          this.nav.saveFocus();
        }
      },
      restoreFocus(fallbackSelector) {
        if (this.nav && typeof this.nav.restoreFocus === 'function') {
          this.nav.restoreFocus(fallbackSelector);
        }
      },

      // Header Enter / Backspace Navigation
      onHeaderEnter(e) {
        const container = this.$el.querySelector('.header-fields');
        if (!container) return;
        const target = e.target;
        const inputs = this.nav ? this.nav.getFocusableInputs(container) : [];
        const idx = inputs.indexOf(target);
        if (idx !== -1 && idx < inputs.length - 1) {
          if (this.nav) this.nav.handleEnterKey(e, container);
        } else {
          e.preventDefault();
          if (!this.selectedParty) {
            this.saveFocus();
            this.showPartyDrawer = true;
          } else {
            const refInput = this.$el.querySelector('.detail-panel input, .detail-panel textarea');
            if (refInput) {
              refInput.focus();
              if (refInput.select) refInput.select();
            }
          }
        }
      },
      onHeaderBackspace(e) {
        const container = this.$el.querySelector('.header-fields');
        if (container && this.nav) this.nav.handleBackspaceKey(e, container);
      },

      // Details Panel Navigation (Reference, Vehicle, Dispatch, Narration)
      onDetailEnter(e) {
        const container = (e.target && e.target.closest('.field-grid')) || this.$el.querySelector('.detail-panel');
        if (container && this.nav) this.nav.handleEnterKey(e, container);
      },
      onDetailBackspace(e) {
        const container = (e.target && e.target.closest('.field-grid')) || this.$el.querySelector('.detail-panel');
        if (container && this.nav) this.nav.handleBackspaceKey(e, container);
      },
      onNarrationEnter(e) {
        if (e.shiftKey) return;
        e.preventDefault();
        if (this.cart.length > 0) {
          const firstQtyInput = this.$el.querySelector('tr[data-row="0"] input.qty-input, tr[data-row="0"] input.item-name-input');
          if (firstQtyInput) {
            firstQtyInput.focus();
            if (firstQtyInput.select) firstQtyInput.select();
            return;
          }
        }
        this.saveFocus();
        this.showStockSelectorModal = true;
      },

      // Cart Grid Navigation (Row Hotkeys, Cell Enter/Backspace, Line Notes)
      onRowKeydown(e, idx) {
        if ((e.altKey && (e.key.toLowerCase() === 'h' || e.code === 'KeyH')) || e.key === 'F7') {
          e.preventDefault();
          e.stopPropagation();
          this.openHistoryModal(idx);
          return;
        }
        if (e.key === 'Delete' || (e.ctrlKey && e.key.toLowerCase() === 'd')) {
          const target = e.target;
          if (target && target instanceof HTMLInputElement && target.value !== '' && e.key === 'Delete' && !e.ctrlKey) {
            return;
          }
          e.preventDefault();
          this.removeCartRow(idx);
        }
      },
      onCellEnter(e, rowIndex, cellType) {
        const container = (e.target && e.target.closest('.table-wrap')) || this.$el.querySelector('.table-wrap');
        if (!container) return;
        if (cellType === 'last') {
          const noteInput = container.querySelector(`tr[data-note-row="${rowIndex}"] input.note-input`);
          if (noteInput) {
            noteInput.focus();
            if (noteInput.select) noteInput.select();
            return;
          }
          this.focusNextRowOrAddItem(container, rowIndex);
        } else {
          if (this.nav) this.nav.handleEnterKey(e, container);
        }
      },
      onNoteEnter(e, rowIndex) {
        const container = (e.target && e.target.closest('.table-wrap')) || this.$el.querySelector('.table-wrap');
        if (!container) return;
        this.focusNextRowOrAddItem(container, rowIndex);
      },
      focusNextRowOrAddItem(container, rowIndex) {
        const nextRow = container.querySelector(`tr[data-row="${rowIndex + 1}"]`);
        if (nextRow) {
          const targetInput = nextRow.querySelector('input.qty-input') || nextRow.querySelector('input.item-name-input');
          if (targetInput) {
            targetInput.focus();
            if (targetInput.select) targetInput.select();
            return;
          }
        }
        this.saveFocus();
        this.showStockSelectorModal = true;
      },
      onCellBackspace(e) {
        const container = (e.target && e.target.closest('.table-wrap')) || this.$el.querySelector('.table-wrap');
        if (container && this.nav) this.nav.handleBackspaceKey(e, container);
      },

      // Other Charges Form Navigation
      onChargesEnter(e) {
        const container = (e.target && e.target.closest('.charges-container')) || (e.target && e.target.closest('.other-charges-modal')) || this.$el.querySelector('.other-charges-modal');
        if (container && this.nav) {
          this.nav.handleEnterKey(e, container, () => {
            this.showOtherChargesModal = false;
          });
        }
      },
      onChargesBackspace(e) {
        const container = (e.target && e.target.closest('.charges-container')) || (e.target && e.target.closest('.other-charges-modal')) || this.$el.querySelector('.other-charges-modal');
        if (container && this.nav) this.nav.handleBackspaceKey(e, container);
      },

      // Modal Form Navigation
      onFormEnter(e) {
        const form = (e.target && e.target.closest('form')) || (e.target && e.target.closest('.modal-form')) || (e.target && e.target.parentElement);
        if (form && this.nav) this.nav.handleEnterKey(e, form);
      },
      onPartyFormEnter(e) {
        const form = (e.target && e.target.closest('.modal-form')) || (e.target && e.target.parentElement);
        if (form && this.nav) {
          this.nav.handleEnterKey(e, form, () => {
            this.handleQuickAddParty();
          });
        }
      },
      onStockFormEnter(e) {
        const form = (e.target && e.target.closest('#stock-item-form')) || (e.target && e.target.closest('form')) || (e.target && e.target.parentElement);
        if (form && this.nav) {
          this.nav.handleEnterKey(e, form, () => {
            this.handleQuickAddStock();
          });
        }
      },
      onFormBackspace(e) {
        const form = (e.target && e.target.closest('form')) || (e.target && e.target.closest('.modal-form')) || (e.target && e.target.parentElement);
        if (form && this.nav) this.nav.handleBackspaceKey(e, form);
      },

      // History Modal Navigation
      handleHistoryModalKeydown(e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (this.historyRecords.length > 0) {
            this.historySelectedIndex = (this.historySelectedIndex + 1) % this.historyRecords.length;
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.historyRecords.length > 0) {
            this.historySelectedIndex = (this.historySelectedIndex - 1 + this.historyRecords.length) % this.historyRecords.length;
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.historyRecords.length > 0 && this.historySelectedIndex < this.historyRecords.length) {
            this.applyHistoryRate(this.historyRecords[this.historySelectedIndex]);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.showHistoryModal = false;
        }
      },

      // Print Modal Navigation
      handlePrintModalKeydown(e) {
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          this.downloadCreatedPDF();
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          this.downloadCreatedExcel();
        } else if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          this.downloadCreatedWord();
        } else if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          this.closePrintModal();
        }
      }
    },
    mounted() {
      if (this.isReturnMode && this.sourceBill) {
        if (this.sourceBill.partyId) {
          const p = this.parties.find((item) => item.id === this.sourceBill.partyId || item.name === this.sourceBill.partyName);
          if (p) this.selectParty(p);
        }
      }
      if (global.useKeyboardNavigation) {
        this.nav = global.useKeyboardNavigation();
        this.nav.trackPageFocus(this.$el);
        this.nav.focusFirstInput(this.$el);
      }
      window.addEventListener('keydown', this.handleGlobalKeydown);
    },
    beforeUnmount() {
      window.removeEventListener('keydown', this.handleGlobalKeydown);
    },
    template: `
      <div class="invoice-page">
        <!-- Return Mode Banner (Nuxt 4 sales/new.vue lines 3-6) -->
        <div v-if="isReturnMode && sourceBill" class="return-banner">
          <span>Return for Bill #{{ sourceBill.bno }} &bull; Original Party: {{ sourceBill.partyName }}</span>
          <button type="button" @click="$emit('cancel')">Cancel Return</button>
        </div>

        <!-- Flush Page Header (100% Matching Nuxt 4 sales/new.vue lines 8-66) -->
        <header class="page-header">
          <!-- Title Block (340px width border-right) -->
          <div class="title-block">
            <p>{{ firmDisplayName }}</p>
            <h1>{{ isReturnMode ? (mode === 'purchase' ? 'Debit Note' : 'Sales Return') : (meta.btype === 'PROFORMA' ? 'Proforma Invoice' : (meta.btype === 'DELIVERY_NOTE' ? 'Delivery Note' : (mode === 'purchase' ? 'Purchase Bill' : (gstEnabled ? 'Tax Invoice' : 'Bill of Supply')))) }}</h1>
          </div>

          <!-- Header Fields (Dense, High-Density inline strip) -->
          <div class="header-fields">
            <!-- Document Type Selector (Sales only) -->
            <label v-if="mode === 'sales' && !isReturnMode">
              <span>Document Type</span>
              <select v-model="meta.btype" @keydown.enter="onHeaderEnter($event)" @keydown.backspace="onHeaderBackspace($event)">
                <option value="SALES">{{ gstEnabled ? 'Tax Invoice' : 'Bill of Supply' }}</option>
                <option value="PROFORMA">Proforma Invoice</option>
                <option value="DELIVERY_NOTE">Delivery Note</option>
              </select>
            </label>

            <!-- Supplier Bill No (Purchase only) -->
            <label v-if="mode === 'purchase'">
              <span>Supplier Bill No</span>
              <input type="text" v-model="meta.supplierBillNo" placeholder="INV-000" @keydown.enter="onHeaderEnter($event)" @keydown.backspace="onHeaderBackspace($event)" />
            </label>

            <!-- Bill No -->
            <label>
              <span>Bill No</span>
              <input :value="isReturnMode ? (mode === 'purchase' ? 'DN-AUTO' : 'CN-AUTO') : (meta.billNo || 'AUTO')" type="text" readonly class="readonly-input" />
            </label>

            <!-- Invoice Date -->
            <label>
              <span>{{ mode === 'purchase' ? 'Bill Date' : 'Invoice date' }}</span>
              <input type="date" v-model="meta.billDate" @keydown.enter="onHeaderEnter($event)" @keydown.backspace="onHeaderBackspace($event)" />
            </label>

            <!-- Billing From GSTIN (Nuxt 4 sales/new.vue lines 35-42) -->
            <label v-if="gstEnabled && firmLocations && firmLocations.length >= 1">
              <span>{{ mode === 'purchase' ? 'Receiving GSTIN' : 'Billing from GSTIN' }}</span>
              <select :value="meta.firmGstin || (activeFirmLocation && activeFirmLocation.gst_number) || ''" @change="onFirmGstinChange" @keydown.enter="onHeaderEnter($event)" @keydown.backspace="onHeaderBackspace($event)">
                <option v-for="location in firmLocations" :key="location.gst_number || location.state_code" :value="location.gst_number || ''">
                  {{ location.gst_number || 'No GSTIN' }} - {{ location.state || location.state_code || '' }}{{ location.is_default ? ' (Default)' : '' }}
                </option>
              </select>
            </label>

            <!-- Transaction Type (Intra vs Inter state) -->
            <label v-if="gstEnabled">
              <span>Transaction type</span>
              <select v-model="meta.billType" @keydown.enter="onHeaderEnter($event)" @keydown.backspace="onHeaderBackspace($event)">
                <option value="intra-state">Intra-State (CGST + SGST)</option>
                <option value="inter-state">Inter-State (IGST)</option>
              </select>
            </label>

            <!-- Reverse Charge Toggle -->
            <label v-if="gstEnabled" class="inline-toggle">
              <input type="checkbox" v-model="meta.reverseCharge" @keydown.enter.prevent="onHeaderEnter($event)" @keydown.backspace="onHeaderBackspace($event)" />
              <span>Reverse Charge</span>
            </label>

            <!-- GST Status Interactive Toggle Button -->
            <button type="button"
                    class="gst-status" 
                    :class="{ off: !gstEnabled }"
                    @click="toggleGst"
                    :title="gstEnabled ? 'GST is active (Tax Invoice). Click to switch to Non-GST (Bill of Supply)' : 'GST is inactive (Bill of Supply). Click to switch to GST mode'">
              GST: {{ gstEnabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <!-- Header Actions: DISCARD (F9) & SAVE INVOICE F8 -->
          <div class="header-actions">
            <button class="ghost-btn" type="button" @click="$emit('cancel')" title="Clear Bill (F9)">Discard (F9)</button>
            <button class="primary-btn" type="button" :disabled="!canSave || loading" @click="handleSave" title="Save Invoice (F8)">
              {{ loading ? 'Saving...' : (isReturnMode ? (mode === 'purchase' ? 'Create Debit Note' : 'Create Credit Note') : (mode === 'purchase' ? 'Save Purchase' : 'Save Invoice')) }}
              <span>F8</span>
            </button>
          </div>
        </header>

        <!-- 2-Column Split Workspace (100% Faithful Replica of Nuxt 4 sales/new.vue lines 68-121) -->
        <main class="workspace">
          <!-- Left Side Panel (340px width border-right) -->
          <aside class="side-panel">
            <!-- Party Manager Box -->
            <section class="party-panel">
              <header class="panel-head">
                <div>
                  <p class="eyebrow">Party</p>
                  <h2>{{ mode === 'purchase' ? 'Supplier (Bill From)' : 'Bill To' }}</h2>
                </div>
                <div class="flex items-center gap-1.5">
                  <button v-if="selectedParty && !isReturnMode" class="link-btn" type="button" title="Edit party (Alt+E)" @click="openEditPartyModal(selectedParty)">
                    Edit (Alt+E)
                  </button>
                  <button v-if="!isReturnMode" class="link-btn" type="button" @click="openQuickAddParty()">
                    New (Insert)
                  </button>
                </div>
              </header>

              <!-- When No Party is Selected -->
              <button v-if="!selectedParty" class="empty-party" type="button" @click="showPartyDrawer = true">
                <span>Select party</span>
                <small>{{ mode === 'purchase' ? 'Supplier record (Press F3 to Select)' : 'Customer record (Press F3 to Select)' }}</small>
              </button>

              <!-- When Party is Selected -->
              <div v-else class="selected-party">
                <div class="party-title-row">
                  <div class="min-w-0 flex-1">
                    <h3 class="truncate">{{ selectedParty.name }}</h3>
                    <p class="font-mono text-xs font-bold text-slate-500">{{ selectedParty.gstin || 'UNREGISTERED' }}</p>
                  </div>
                  <button v-if="!isReturnMode" class="change-btn shrink-0" type="button" title="Change party (F3)" @click="showPartyDrawer = true">
                    Change (F3)
                  </button>
                </div>
                <div class="text-[11px] text-slate-600 mt-1 truncate">{{ selectedParty.address || '-' }}</div>
                <div class="text-[10px] text-slate-500 font-semibold mt-0.5">State: {{ selectedParty.state }} ({{ selectedParty.stateCode }})</div>
              </div>

              <!-- Consignee / Ship-To Section -->
              <div class="consignee-block">
                <label class="same-toggle">
                  <input type="checkbox" v-model="consigneeSameAsBillTo" />
                  <span>Ship to billing address</span>
                </label>
              </div>
            </section>

            <!-- Details: DISPATCH AND REFERENCE -->
            <section class="detail-panel">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Details</p>
                  <h2>{{ mode === 'purchase' ? 'Inward Configuration' : 'Dispatch and reference' }}</h2>
                </div>
                <button type="button" @click="showOtherChargesModal = true">
                  Charges F4
                  <span v-if="otherCharges.length" class="ml-1 px-1 bg-purple-600 text-white rounded-full text-[9px]">{{ otherCharges.length }}</span>
                </button>
              </div>

              <div class="field-grid">
                <label>
                  <span>Reference / PO</span>
                  <input v-model="meta.referenceNo" type="text" placeholder="Optional" @keydown.enter.prevent="onDetailEnter($event)" @keydown.backspace="onDetailBackspace($event)" />
                </label>
                <label>
                  <span>Vehicle no</span>
                  <input v-model="meta.vehicleNo" type="text" placeholder="KA-01-XX-1234" @keydown.enter.prevent="onDetailEnter($event)" @keydown.backspace="onDetailBackspace($event)" />
                </label>
                <label class="wide">
                  <span>Dispatch through</span>
                  <input v-model="meta.dispatchThrough" type="text" placeholder="Transport, courier, self" @keydown.enter.prevent="onDetailEnter($event)" @keydown.backspace="onDetailBackspace($event)" />
                </label>
                <label class="wide">
                  <span>Narration (Shift+Enter for new line)</span>
                  <textarea v-model="meta.narration" rows="4" placeholder="Additional notes... (Enter jumps to Cart / Stock F2)" @keydown.enter="onNarrationEnter($event)" @keydown.backspace="onDetailBackspace($event)"></textarea>
                </label>
              </div>
            </section>
          </aside>

          <!-- Right Column: Solid Royal Blue Table + Shortcut Strip + Calculation Breakdown -->
          <section class="main-panel">
            <!-- Full Height Cart Grid (100% Faithful Replica of Nuxt 4 CartManager.vue) -->
            <section class="invoice-grid" :class="[mode, { returning: isReturnMode }]">
              <div class="table-wrap">
                <table class="cart-table" :class="[mode, { returning: isReturnMode }]">
                  <thead>
                    <tr>
                      <th class="index-col">#</th>
                      <th>{{ mode === 'purchase' ? 'Item / Batch' : 'Description' }}</th>
                      <th v-if="gstEnabled">HSN/SAC</th>
                      <th v-if="isReturnMode" class="num">Orig</th>
                      <th class="num">{{ isReturnMode ? 'Return' : 'Qty' }}</th>
                      <th>Unit</th>
                      <th class="num">{{ mode === 'purchase' ? 'Cost' : 'Rate' }}</th>
                      <th class="num">Disc %</th>
                      <th v-if="gstEnabled" class="num">GST %</th>
                      <th class="num total-col">Amount</th>
                      <th class="action-col"></th>
                    </tr>
                  </thead>

                  <tbody v-if="cart.length">
                    <template v-for="(it, idx) in cart" :key="idx">
                      <tr class="hover:bg-slate-50 transition-colors" :data-row="idx" @keydown="onRowKeydown($event, idx)">
                        <td class="index-col">{{ idx + 1 }}</td>
                        <td class="py-2 px-3">
                          <input
                            type="text"
                            v-model="it.item"
                            :placeholder="it.itemType === 'SERVICE' ? 'Service description' : 'Item name'"
                            class="line-input item-name-input w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded px-1.5 py-0.5 text-xs text-slate-900 font-bold outline-none"
                            @keydown.enter.prevent="onCellEnter($event, idx, 'item')"
                            @keydown.backspace="onCellBackspace($event)"
                            @focus="$event.target.select()"
                          />
                          <div class="flex items-center space-x-1.5 mt-0.5 text-[10px]">
                            <span v-if="it.itemType === 'SERVICE'" class="px-1 py-0.2 rounded bg-purple-100 text-purple-800 font-bold">Service</span>
                            <input v-if="mode === 'purchase'" type="text" v-model="it.batch" placeholder="Batch" class="line-input border border-slate-200 rounded px-1 text-[10px] w-16 font-mono" @keydown.enter.prevent="onCellEnter($event, idx, 'batch')" @keydown.backspace="onCellBackspace($event)" @focus="$event.target.select()" />
                            <span v-else-if="it.batch" class="px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">Batch {{ it.batch }}</span>
                            <button
                              type="button"
                              @click.stop="openHistoryModal(idx)"
                              class="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                              title="Party History (Alt+H)"
                            >
                              🕒 History (Alt+H)
                            </button>
                          </div>
                        </td>
                        <td v-if="gstEnabled" class="text-center">
                          <input type="text" v-model="it.hsn" placeholder="HSN" class="line-input w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded px-1 text-xs font-mono text-center" @keydown.enter.prevent="onCellEnter($event, idx, 'hsn')" @keydown.backspace="onCellBackspace($event)" @focus="$event.target.select()" />
                        </td>
                        <td v-if="isReturnMode" class="num text-slate-400 font-mono">{{ it.origQty || it.qty }}</td>
                        <td class="num">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            v-model="it[isReturnMode ? 'returnQty' : 'qty']"
                            class="line-input qty-input w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded px-1 text-xs text-right font-black font-mono"
                            @keydown.enter.prevent="onCellEnter($event, idx, 'qty')"
                            @keydown.backspace="onCellBackspace($event)"
                            @focus="$event.target.select()"
                          />
                        </td>
                        <td class="text-center">
                          <select v-model="it.uom" class="line-input bg-transparent border border-transparent hover:border-slate-300 rounded px-1 text-xs text-center uppercase font-bold cursor-pointer" @keydown.enter.prevent="onCellEnter($event, idx, 'uom')" @keydown.backspace="onCellBackspace($event)">
                            <option value="PCS">PCS</option>
                            <option value="NOS">NOS</option>
                            <option value="SET">SET</option>
                            <option value="BOX">BOX</option>
                            <option value="MTR">MTR</option>
                            <option value="KGS">KGS</option>
                            <option value="SRV">SRV</option>
                          </select>
                        </td>
                        <td class="num">
                          <input type="number" step="any" min="0" v-model="it.rate" class="line-input rate-input w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded px-1 text-xs text-right font-bold" @keydown.enter.prevent="onCellEnter($event, idx, 'rate')" @keydown.backspace="onCellBackspace($event)" @focus="$event.target.select()" />
                        </td>
                        <td class="num">
                          <input type="number" step="any" min="0" max="100" v-model="it.disc" class="line-input disc-input w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded px-1 text-xs text-right font-medium" @keydown.enter.prevent="onCellEnter($event, idx, gstEnabled ? 'disc' : 'last')" @keydown.backspace="onCellBackspace($event)" @focus="$event.target.select()" />
                        </td>
                        <td v-if="gstEnabled" class="num text-center">
                          <select v-model="it.grate" class="line-input grate-input bg-transparent border border-transparent hover:border-slate-300 rounded px-1 text-xs font-bold text-center cursor-pointer" @keydown.enter.prevent="onCellEnter($event, idx, 'last')" @keydown.backspace="onCellBackspace($event)">
                            <option :value="0">0%</option>
                            <option :value="5">5%</option>
                            <option :value="12">12%</option>
                            <option :value="18">18%</option>
                            <option :value="28">28%</option>
                          </select>
                        </td>
                        <td class="num font-black text-slate-900 whitespace-nowrap">
                          {{ formatCurrency(((Number(isReturnMode ? it.returnQty : it.qty) || 0) * (Number(it.rate) || 0) * (1 - (Number(it.disc) || 0) / 100)) * (1 + (gstEnabled ? (Number(it.grate) || 18) : 0) / 100)) }}
                        </td>
                        <td class="action-col text-center">
                          <button type="button" @click="removeCartRow(idx)" class="text-slate-400 hover:text-rose-600 font-bold text-sm cursor-pointer">&times;</button>
                        </td>
                      </tr>
                      <tr class="bg-slate-50/40" :data-note-row="idx">
                        <td></td>
                        <td :colspan="gstEnabled ? 9 : 7" class="py-1 px-3">
                          <input type="text" v-model="it.narration" placeholder="Line note (Optional remarks for this line)..." class="line-input note-input w-full bg-transparent border-0 text-[11px] text-slate-500 placeholder-slate-400 focus:outline-none" @keydown.enter.prevent="onNoteEnter($event, idx)" @keydown.backspace="onCellBackspace($event)" />
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>

                <!-- When Cart is Empty: Vertically Expands Across the Entire Height Matching Image 2 -->
                <div v-if="cart.length === 0" class="cart-empty-fill">
                  <p>No line items yet.</p>
                  <button type="button" @click="showStockSelectorModal = true">+ Add stock item (F2)</button>
                </div>
              </div>

              <!-- Pinned Bottom Keyboard Shortcut Strip (Nuxt 4 CartManager.vue lines 527-578) -->
              <div class="grid-footer">
                <div class="shortcut-strip">
                  <button type="button" class="footer-btn" @click="showStockSelectorModal = true">
                    <kbd>F2</kbd> Add Items
                  </button>
                  <button type="button" class="footer-btn" @click="addCartRow('GOODS')">
                    <kbd>SHIFT+F5</kbd> Blank Goods
                  </button>
                  <button type="button" class="footer-btn" @click="addCartRow('SERVICE')">
                    <kbd>F5</kbd> Add Service
                  </button>
                  <span class="divider"></span>
                  <span class="info-text"><kbd>ALT+H</kbd> PARTY HISTORY</span>
                  <span class="info-text"><kbd>DEL</kbd> REMOVE ROW</span>
                  <span class="info-text"><kbd>ENTER</kbd> NEXT CELL</span>
                  <span class="info-text"><kbd>F4</kbd> CHARGES</span>
                  <span class="info-text"><kbd>F8</kbd> SAVE BILL</span>
                </div>
              </div>
            </section>

            <!-- Bill Calculation Breakdown (Nuxt 4 InvoiceSummary.vue lines 8-51) -->
            <div class="bg-white p-4 border-t border-slate-200 shrink-0 space-y-3">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Bill Calculation Breakdown</h3>
              <div class="space-y-1.5 text-xs font-semibold">
                <div class="flex justify-between text-slate-600">
                  <span>{{ gstEnabled ? 'Items Taxable Subtotal' : 'Items Subtotal' }}</span>
                  <span class="font-mono text-slate-900 font-bold">₹{{ (totals.taxableTotal - (totals.otherChargesTotal || 0)).toFixed(2) }}</span>
                </div>
                <div v-if="totals.otherChargesTotal > 0" class="flex justify-between text-slate-600">
                  <span>Additional Charges</span>
                  <span class="font-mono text-slate-900 font-bold">₹{{ totals.otherChargesTotal.toFixed(2) }}</span>
                </div>
                <template v-if="gstEnabled">
                  <div v-if="!isInterState" class="space-y-1 pt-1.5 border-t border-slate-100">
                    <div class="flex justify-between text-emerald-600 font-bold">
                      <span>CGST</span>
                      <span class="font-mono">₹{{ totals.cgst.toFixed(2) }}</span>
                    </div>
                    <div class="flex justify-between text-emerald-600 font-bold">
                      <span>SGST</span>
                      <span class="font-mono">₹{{ totals.sgst.toFixed(2) }}</span>
                    </div>
                  </div>
                  <div v-else class="flex justify-between text-emerald-600 font-bold pt-1.5 border-t border-slate-100">
                    <span>IGST</span>
                    <span class="font-mono">₹{{ totals.igst.toFixed(2) }}</span>
                  </div>
                </template>
                <div v-if="Math.abs(totals.roundOff) > 0" class="flex justify-between text-slate-500 text-[11px]">
                  <span>Round Off</span>
                  <span class="font-mono">{{ totals.roundOff >= 0 ? '+' : '' }}{{ totals.roundOff.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center text-sm font-black pt-2 border-t-2 border-slate-200 text-slate-900">
                  <span>Total Amount Payable</span>
                  <span class="text-lg font-mono font-black text-indigo-600">₹{{ totals.netTotal.toLocaleString('en-IN') }}</span>
                </div>
              </div>
            </div>
          </section>
        </main>

        <!-- ============================================== -->
        <!-- DRAWERS & MODALS                               -->
        <!-- ============================================== -->

        <!-- 1. Party Selector Slide-Over Drawer (F3) -->
        <div v-if="showPartyDrawer" class="fixed inset-0 z-[60] flex justify-end bg-slate-900/40 backdrop-blur-2xs" style="z-index: 60;" @click.self="showPartyDrawer = false">
          <div class="w-full max-w-md h-full bg-white shadow-2xl flex flex-col" @keydown="handlePartyDrawerKeydown">
            <header class="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Records</p>
                <h2 class="text-sm font-black text-slate-900 uppercase">Choose Party</h2>
              </div>
              <div class="flex items-center space-x-2">
                <button
                  type="button"
                  @click="openQuickAddParty"
                  class="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded cursor-pointer"
                >
                  + New Party (Insert)
                </button>
                <button
                  type="button"
                  @click="showPartyDrawer = false"
                  class="px-2.5 py-1 border border-slate-300 rounded text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </header>

            <div class="p-3 border-b border-slate-200 bg-slate-50">
              <input
                ref="partyDrawerSearchInput"
                v-model="partySearchQuery"
                type="text"
                placeholder="Search party... (↑↓ Navigate • Enter Select • Insert New • ESC Close)"
                class="w-full border-2 border-blue-500 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none bg-white shadow-2xs"
              />
            </div>

            <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
              <button
                v-for="(party, idx) in filteredParties"
                :key="party.id"
                type="button"
                @click="selectParty(party)"
                :class="partySelectedIndex === idx ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white hover:bg-blue-50/70 border-slate-200 text-slate-800'"
                class="w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1"
              >
                <div class="flex items-center justify-between">
                  <strong :class="partySelectedIndex === idx ? 'text-white' : 'text-slate-900'" class="text-xs font-black truncate">{{ party.name }}</strong>
                  <span :class="partySelectedIndex === idx ? 'bg-white/20 text-white border-white/30' : 'bg-amber-50 text-amber-700 border-amber-200'" class="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border">
                    ₹0.00 DR
                  </span>
                </div>
                <div :class="partySelectedIndex === idx ? 'text-blue-100' : 'text-slate-500'" class="text-[10px] font-medium flex items-center justify-between">
                  <span>GSTIN: {{ party.gstin || 'UNREGISTERED' }}</span>
                  <span>{{ party.state || '-' }}</span>
                </div>
              </button>

              <div v-if="filteredParties.length === 0" class="p-8 text-center text-slate-400 text-xs">
                <p>No matching party found.</p>
                <button type="button" class="mt-2 text-emerald-600 font-bold underline cursor-pointer" @click="openQuickAddParty">
                  Press Insert to Register New Party
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Stock Item Selector Modal (F2) - 100% Faithful Replica of Nuxt 4 app/components/inventory/StockModal.vue -->
        <div v-if="showStockSelectorModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" style="z-index: 60;" @click.self="showStockSelectorModal = false">
          <div class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in border border-slate-200 dark:border-zinc-800">
            <!-- Header (100% matching Nuxt 4 StockModal.vue lines 5-22) -->
            <div class="p-4 px-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/80 dark:bg-zinc-850/80">
              <div class="flex items-center gap-3">
                 <div class="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-200 ring-2 ring-white">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                 </div>
                 <div>
                    <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Stock Browser</h2>
                    <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Inventory Management Hub</p>
                 </div>
              </div>
              <button 
                type="button"
                @click="showStockSelectorModal = false" 
                class="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-red-500 hover:border-red-100 transition-all shadow-sm group cursor-pointer"
                title="Close Browser (ESC)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Search & Filters (100% matching Nuxt 4 StockModal.vue lines 24-44) -->
            <div class="px-6 pt-4 pb-2">
               <div class="relative group">
                  <input 
                    type="text" 
                    v-model="stockSearchQuery" 
                    placeholder="Filter by Name, HSN, Part No or OEM..." 
                    class="w-full pl-10 pr-6 py-2.5 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all font-bold text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-400 shadow-inner"
                    ref="stockSearchInput"
                    @keydown="handleStockModalKeydown"
                  />
                  <div class="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                     </svg>
                  </div>
                  <div class="absolute right-3.5 top-2.5 hidden sm:flex items-center gap-2 pointer-events-none">
                     <span class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded font-mono text-[9px] font-bold">
                       Insert: New Item • F3/Ctrl+E: Edit Item • ↑↓: Navigate • Enter: Select • ESC: Close
                     </span>
                  </div>
               </div>
            </div>

            <!-- Advanced Stock Table (100% matching Nuxt 4 StockModal.vue lines 46-206) -->
            <div class="flex-1 overflow-y-auto px-6 pb-4 custom-scrollbar bg-slate-50/50 dark:bg-zinc-900/50">
               <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                  <table class="w-full text-left border-collapse">
                     <thead>
                        <tr class="bg-slate-100 dark:bg-zinc-800 text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-700">
                           <th class="px-4 py-2">Item Description</th>
                           <th class="px-3 py-2">HSN</th>
                           <th class="px-3 py-2">Batch</th>
                           <th class="px-3 py-2">Expiry</th>
                           <th class="px-3 py-2 text-right">Available</th>
                           <th class="px-3 py-2 text-right">{{ mode === 'purchase' ? 'Cost Rate' : 'Rate' }}</th>
                           <th class="px-3 py-2 text-right">GST %</th>
                           <th class="px-3 py-2 text-right">MRP</th>
                           <th class="px-4 py-2 text-center">Action</th>
                        </tr>
                     </thead>
                     <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
                        <template v-for="(stock, index) in filteredStocks" :key="stock.id || stock._id">
                           <!-- Main Stock Item Row -->
                            <tr 
                              class="transition-colors cursor-pointer group text-xs font-bold text-slate-700 dark:text-zinc-300"
                              :class="[
                                isStockActive(stock) ? 'bg-blue-100/90 dark:bg-blue-950/90 ring-2 ring-blue-500 ring-inset shadow-md active-stock-row' : 'hover:bg-blue-50/20 dark:hover:bg-blue-950/20'
                              ]"
                              @click="toggleStock(stock)"
                            >
                              <td class="px-4 py-1.5">
                                 <div class="font-black text-slate-900 dark:text-white text-xs leading-tight">{{ stock.item }}</div>
                                 <div class="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-400 dark:text-zinc-500 font-semibold">
                                    <span v-if="stock.pno">P/N: {{ stock.pno }}</span>
                                    <span v-if="stock.pno && stock.oem" class="w-0.5 h-0.5 bg-slate-300 rounded-full"></span>
                                    <span v-if="stock.oem">OEM: {{ stock.oem }}</span>
                                 </div>
                              </td>
                              <td class="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">{{ stock.hsn || '-' }}</td>
                              <td class="px-3 py-1.5">
                                 <div v-if="getStockBatches(stock).length > 1" class="flex items-center gap-1">
                                    <span class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border-indigo-100 border rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase">
                                       {{ getStockBatches(stock).length }} Batches
                                    </span>
                                    <svg 
                                      class="w-3 h-3 text-indigo-500 transition-transform duration-200"
                                      :class="expandedStockId === (stock.id || stock._id) ? 'rotate-180' : ''"
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                    >
                                       <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                                    </svg>
                                 </div>
                                 <span v-else-if="getStockBatches(stock).length === 1" class="bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-100 dark:border-zinc-700 px-1.5 py-0.5 border rounded-md text-[9px] font-black uppercase">
                                     {{ getStockBatches(stock)[0].batch || '-' }}
                                 </span>
                                 <span v-else class="text-slate-400">-</span>
                              </td>
                              <td class="px-3 py-1.5 text-slate-500 dark:text-zinc-400 font-medium text-[11px]">
                                 <span v-if="getStockBatches(stock).length > 1" class="text-slate-400 italic">Various</span>
                                 <span v-else-if="getStockBatches(stock).length === 1">
                                    {{ formatDate(getStockBatches(stock)[0].expiry) }}
                                 </span>
                                 <span v-else>-</span>
                              </td>
                              <td class="px-3 py-1.5 text-right">
                                 <span class="text-xs font-black text-slate-900 dark:text-white" :class="Number(stock.qty || 0) <= 0 ? 'text-red-500 animate-pulse' : ''">{{ Number(stock.qty || 0).toLocaleString() }}</span>
                                 <span class="text-[9px] font-black text-slate-400 uppercase ml-0.5">{{ stock.uom || 'PCS' }}</span>
                              </td>
                              <td class="px-3 py-1.5 text-right font-mono text-slate-900 dark:text-zinc-200 text-[11px]">₹{{ Number((mode === 'purchase' ? (stock.cost_rate || stock.rate) : stock.rate) || 0).toFixed(2) }}</td>
                              <td class="px-3 py-1.5 text-right text-slate-500 dark:text-zinc-400 font-medium text-[11px]">{{ stock.grate || 0 }}%</td>
                              <td class="px-3 py-1.5 text-right font-mono text-slate-900 dark:text-zinc-200 text-[11px]">
                                 <span v-if="getStockBatches(stock).length > 1" class="text-slate-400 italic">Various</span>
                                 <span v-else-if="getStockBatches(stock).length === 1">
                                    {{ getStockBatches(stock)[0].mrp ? '₹' + Number(getStockBatches(stock)[0].mrp).toFixed(2) : '-' }}
                                 </span>
                                 <span v-else-if="stock.mrp">₹{{ Number(stock.mrp).toFixed(2) }}</span>
                                 <span v-else>-</span>
                              </td>
                              <td class="px-4 py-1.5 text-center">
                                 <div class="flex items-center justify-center gap-1.5">
                                    <button 
                                      type="button"
                                      @click.stop="toggleStock(stock)"
                                      class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                                      :class="getStockBatches(stock).length > 1 
                                        ? (expandedStockId === (stock.id || stock._id) ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white') 
                                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-blue-600 hover:text-white'"
                                    >
                                       {{ getStockBatches(stock).length > 1 ? (expandedStockId === (stock.id || stock._id) ? 'Close' : 'Expand') : 'Select' }}
                                    </button>
                                    <button 
                                      type="button"
                                      @click.stop="openEditStock(stock)"
                                      class="px-2 py-0.5 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 hover:bg-amber-600 hover:text-white rounded-md text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                                    >
                                       Edit
                                    </button>
                                 </div>
                              </td>
                           </tr>

                           <!-- Nested Batches Sub-Table Row (100% matching Nuxt 4 StockModal.vue lines 142-196) -->
                           <tr v-if="expandedStockId === (stock.id || stock._id) && getStockBatches(stock).length > 1" class="bg-slate-50/50 dark:bg-zinc-850/50">
                              <td colspan="9" class="px-4 py-2">
                                 <div class="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm max-w-4xl animate-scale-in">
                                    <div class="bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 border-b border-slate-100 dark:border-zinc-700 flex items-center justify-between">
                                       <span class="text-[9px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">Select Batch for {{ stock.item }}</span>
                                       <span class="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase">{{ getStockBatches(stock).length }} Batches Available</span>
                                    </div>
                                    <table class="w-full text-left text-xs border-collapse">
                                       <thead>
                                          <tr class="bg-slate-50/50 dark:bg-zinc-800/50 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
                                             <th class="px-3 py-1.5">Batch No</th>
                                             <th class="px-3 py-1.5">Expiry</th>
                                             <th class="px-3 py-1.5 text-right">Available Qty</th>
                                             <th class="px-3 py-1.5 text-right">{{ mode === 'purchase' ? 'Cost Rate' : 'Rate' }}</th>
                                             <th class="px-3 py-1.5 text-right">GST %</th>
                                             <th class="px-3 py-1.5 text-right">MRP</th>
                                             <th class="px-3 py-1.5 text-center">Action</th>
                                          </tr>
                                       </thead>
                                       <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-bold text-slate-600 dark:text-zinc-300 text-[11px]">
                                          <tr 
                                            v-for="batch in getStockBatches(stock)" 
                                            :key="batch._id || batch.id || batch.batch"
                                            class="transition-colors cursor-pointer"
                                            :class="[
                                               isBatchActive(stock, batch) ? 'bg-indigo-100 dark:bg-indigo-900/90 ring-2 ring-indigo-500 font-extrabold text-indigo-900 dark:text-white active-stock-row' : 'hover:bg-blue-50/20 dark:hover:bg-blue-950/20'
                                            ]"
                                            @click.stop="selectStockRow(stock, batch)"
                                          >
                                             <td class="px-3 py-1">
                                                <span class="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 rounded text-[9px] font-black uppercase">
                                                   {{ batch.batch || '-' }}
                                                </span>
                                             </td>
                                             <td class="px-3 py-1 text-slate-500 dark:text-zinc-400 font-medium">
                                                {{ formatDate(batch.expiry) }}
                                             </td>
                                             <td class="px-3 py-1 text-right text-slate-900 dark:text-white">
                                                {{ Number(batch.qty || 0).toLocaleString() }} <span class="text-[9px] text-slate-400 uppercase ml-0.5">{{ batch.uom || stock.uom || 'PCS' }}</span>
                                             </td>
                                             <td class="px-3 py-1 text-right text-slate-900 dark:text-white font-mono">₹{{ Number((mode === 'purchase' ? (batch.rate || stock.cost_rate || stock.rate) : (batch.sale_rate || batch.rate || stock.rate)) || 0).toFixed(2) }}</td>
                                             <td class="px-3 py-1 text-right text-slate-500 dark:text-zinc-400 font-medium">{{ batch.grate !== undefined ? batch.grate : (stock.grate || 0) }}%</td>
                                             <td class="px-3 py-1 text-right text-slate-900 dark:text-white font-mono">{{ batch.mrp ? '₹' + Number(batch.mrp).toFixed(2) : '-' }}</td>
                                             <td class="px-3 py-1 text-center">
                                                <button type="button" class="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[9px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors cursor-pointer">
                                                   Select
                                                </button>
                                             </td>
                                          </tr>
                                       </tbody>
                                    </table>
                                 </div>
                              </td>
                           </tr>
                        </template>
                        <tr v-if="filteredStocks.length === 0">
                           <td colspan="9" class="px-5 py-8 text-center text-slate-400 font-black uppercase text-xs tracking-widest">
                              No stock items match your search
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>
            </div>

            <!-- High-Fidelity Footer (100% matching Nuxt 4 StockModal.vue lines 208-220) -->
            <div class="p-4 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 flex justify-between items-center">
               <button 
                 type="button" 
                 @click="openQuickAddStock" 
                 class="group flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white px-4 py-1.5 rounded-xl transition-all duration-300 cursor-pointer"
               >
                  <div class="w-6 h-6 bg-white/50 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors shadow-sm font-black text-xs">
                     +
                  </div>
                  <span class="text-[10px] font-black uppercase tracking-widest">+ Register New Stock Item (F5 / Ctrl+N / Insert)</span>
               </button>
               <div class="flex items-center gap-2">
                 <button
                   type="button"
                   @click="addBlankLineFromModal"
                   class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                 >
                   + Add Blank Row (F5)
                 </button>
                 <button 
                   type="button" 
                   @click="showStockSelectorModal = false" 
                   class="px-4 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 text-slate-500 dark:text-zinc-400 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm cursor-pointer"
                 >
                    Close Browser
                 </button>
               </div>
            </div>
          </div>
        </div>

        <!-- 3. Other Charges Modal (F4) -->
        <div v-if="showOtherChargesModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4" style="z-index: 60;" @click.self="showOtherChargesModal = false">
          <div class="other-charges-modal bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div class="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 class="text-sm font-black text-slate-900 uppercase">Other Charges (F4)</h3>
                <p class="text-[10px] text-slate-500">Freight, Packing, Insurance & Delivery charges with GST</p>
              </div>
              <button @click="showOtherChargesModal = false" class="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer" title="Close (ESC)">&times;</button>
            </div>
            <div class="charges-container p-4 space-y-3">
              <div v-for="(ch, cIdx) in otherCharges" :key="cIdx" class="flex items-center gap-2">
                <input type="text" v-model="ch.label" placeholder="Charge description" class="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold" @keydown.enter.prevent="onChargesEnter($event)" @keydown.backspace="onChargesBackspace($event)" />
                <input type="number" step="any" v-model="ch.amount" placeholder="Amount (₹)" class="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right" @keydown.enter.prevent="onChargesEnter($event)" @keydown.backspace="onChargesBackspace($event)" />
                <select v-model="ch.grate" class="w-20 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold" @keydown.enter.prevent="onChargesEnter($event)" @keydown.backspace="onChargesBackspace($event)">
                  <option :value="0">0%</option>
                  <option :value="5">5%</option>
                  <option :value="12">12%</option>
                  <option :value="18">18%</option>
                  <option :value="28">28%</option>
                </select>
                <button type="button" @click="removeOtherCharge(cIdx)" class="text-rose-500 font-bold px-1.5 cursor-pointer" title="Remove">&times;</button>
              </div>

              <button
                type="button"
                @click="addOtherChargeRow"
                class="px-3 py-1 rounded text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 cursor-pointer"
              >
                + Add Charge Row
              </button>
            </div>
            <div class="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                @click="showOtherChargesModal = false"
                class="px-4 py-1.5 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
              >
                Done (ESC)
              </button>
            </div>
          </div>
        </div>

        <!-- 4. Party-Item Rate History Modal (Alt+H) -->
        <div v-if="showHistoryModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4" style="z-index: 60;" @click.self="showHistoryModal = false">
          <div 
            class="history-modal-container bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden outline-none" 
            tabindex="0"
            @keydown="handleHistoryModalKeydown"
          >
            <div class="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 class="text-sm font-black text-slate-900 uppercase">Rate & Transaction History (Alt+H)</h3>
                <p class="text-[10px] text-slate-500">Previous billing rates (↑↓ Navigate • Enter Apply • ESC Close)</p>
              </div>
              <button @click="showHistoryModal = false" class="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer" title="Close (ESC)">&times;</button>
            </div>
            <div class="p-4 max-h-80 overflow-y-auto">
              <div v-if="historyLoading" class="py-8 text-center text-xs text-slate-400">Loading history...</div>
              <div v-else-if="historyRecords.length === 0" class="py-8 text-center text-xs text-slate-400 italic">
                No past transactions found for this item.
              </div>
              <table v-else class="w-full text-left text-xs divide-y divide-slate-100">
                <thead>
                  <tr class="text-[10px] font-bold text-slate-400 uppercase">
                    <th class="py-1 px-2">Date</th>
                    <th class="py-1 px-2">Bill #</th>
                    <th class="py-1 px-2">Party</th>
                    <th class="py-1 px-2 text-right">Qty</th>
                    <th class="py-1 px-2 text-right">Rate</th>
                    <th class="py-1 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr 
                    v-for="(rec, rIdx) in historyRecords" 
                    :key="rIdx" 
                    :class="historySelectedIndex === rIdx ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-700'"
                    class="transition-colors cursor-pointer"
                    @click="applyHistoryRate(rec)"
                  >
                    <td class="py-2 px-2" :class="historySelectedIndex === rIdx ? 'text-blue-100' : 'text-slate-500'">{{ rec.bdate }}</td>
                    <td class="py-2 px-2 font-mono font-bold">{{ rec.bno }}</td>
                    <td class="py-2 px-2 truncate max-w-[120px]">{{ rec.party_name }}</td>
                    <td class="py-2 px-2 text-right">{{ rec.qty }} {{ rec.uom }}</td>
                    <td class="py-2 px-2 text-right font-bold" :class="historySelectedIndex === rIdx ? 'text-white' : 'text-slate-900'">{{ formatCurrency(rec.rate) }}</td>
                    <td class="py-2 px-2 text-center">
                      <button
                        type="button"
                        @click.stop="applyHistoryRate(rec)"
                        :class="historySelectedIndex === rIdx ? 'bg-white text-blue-700' : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200'"
                        class="px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                      >
                        Apply Rate
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 5. Help & Shortcuts Modal (F1 / Shift+?) -->
        <div v-if="showHelpModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4" style="z-index: 60;" @click.self="showHelpModal = false">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div class="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h3 class="text-sm font-black text-slate-900 uppercase">Keyboard Shortcuts & Commands (F1)</h3>
              </div>
              <button @click="showHelpModal = false" class="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">&times;</button>
            </div>
            <div class="p-4 space-y-2 text-xs divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">Select Stock Item / Open Catalog</span>
                <kbd class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono font-black text-[11px]">F2</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">Pick Customer / Supplier Party</span>
                <kbd class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono font-black text-[11px]">F3</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">Add Freight & Other Charges</span>
                <kbd class="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-mono font-black text-[11px]">F4</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">Add Blank Goods Line</span>
                <kbd class="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded font-mono font-black text-[11px]">Shift+F5</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">Add Blank Service Line</span>
                <kbd class="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded font-mono font-black text-[11px]">F5</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">Save Voucher / Finalize Invoice</span>
                <kbd class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono font-black text-[11px]">F8 / Ctrl+S</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">Discard & Cancel Workspace</span>
                <kbd class="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-mono font-black text-[11px]">F9</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">Register New Party / New Item</span>
                <kbd class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-mono font-black text-[11px]">Insert</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">View Rate & Transaction History</span>
                <kbd class="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-mono font-black text-[11px]">Alt+H</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">Edit Selected Party</span>
                <kbd class="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-mono font-black text-[11px]">Alt+E</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5">
                <span class="font-bold text-slate-700">Close Open Modal / Drawer</span>
                <kbd class="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded font-mono font-black text-[11px]">ESC</kbd>
              </div>
            </div>
            <div class="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                @click="showHelpModal = false"
                class="help-modal-close-btn px-4 py-1.5 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
              >
                Got It (ESC)
              </button>
            </div>
          </div>
        </div>

        <!-- 6. Quick Add Party Modal (Insert) -->
        <div v-if="showQuickAddPartyModal" class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4" style="z-index: 70;" @click.self="closeQuickAddParty">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div class="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 class="text-sm font-black text-slate-900 uppercase">
                {{ editingPartyId ? 'Edit Party (Alt+E)' : 'Quick Add Party (Insert)' }}
              </h3>
              <button @click="closeQuickAddParty" class="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer" title="Cancel (ESC)">&times;</button>
            </div>
            <div class="modal-form p-4 space-y-2.5 text-xs" @keydown.enter="onPartyFormEnter($event)" @keydown.backspace="onFormBackspace($event)">
              <div>
                <span class="font-bold text-slate-700 block mb-0.5">Party Name *</span>
                <input ref="quickPartyNameInput" type="text" v-model="newPartyForm.name" placeholder="Business or Person Name" class="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold outline-none focus:border-blue-500" />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <span class="font-bold text-slate-700 block mb-0.5">GSTIN</span>
                  <input type="text" v-model="newPartyForm.gstin" placeholder="27XXXXX..." class="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono uppercase" />
                </div>
                <div>
                  <span class="font-bold text-slate-700 block mb-0.5">Phone</span>
                  <input type="text" v-model="newPartyForm.phone" placeholder="+91..." class="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs" />
                </div>
              </div>
              <div>
                <span class="font-bold text-slate-700 block mb-0.5">Address</span>
                <input type="text" v-model="newPartyForm.address" placeholder="Billing Street Address" class="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs" />
              </div>
            </div>
            <div class="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" @click="closeQuickAddParty" class="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer">Cancel (ESC)</button>
              <button type="button" @click="handleQuickAddParty" class="px-4 py-1.5 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">
                {{ editingPartyId ? 'Update & Select (F8)' : 'Save & Select (F8)' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 7. Stock Master Registration Modal (100% Faithful Replica of Nuxt 4 ItemStockMasterModal.vue) -->
        <div v-if="showQuickAddStockModal" class="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md" style="z-index: 70;" @click.self="closeQuickAddStock">
          <div 
            class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-scale-in flex flex-col"
          >
            <!-- Modal Header (Vibrant Gradient Matching Nuxt 4) -->
            <header class="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 px-6 sm:px-8 py-4 text-white flex justify-between items-center shrink-0">
              <div class="space-y-0.5">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-md bg-white/20 text-[9px] font-black uppercase tracking-wider">
                    Stock Master Registration
                  </span>
                  <span v-if="newStockForm.hsn" class="px-2 py-0.5 rounded-md bg-indigo-950/40 text-[9px] font-mono font-bold tracking-wider">
                    HSN: {{ newStockForm.hsn }}
                  </span>
                </div>
                <h2 class="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <span>{{ editingStockId ? 'Edit Stock Item Master' : 'Register New Stock Item' }}</span>
                </h2>
                <p class="text-[9px] sm:text-[10px] font-bold text-indigo-100 uppercase tracking-widest">
                  ENTER: NEXT FIELD • INSERT / CTRL+N: ADD BATCH • F8: SAVE MASTER • ESC: CLOSE
                </p>
              </div>

              <button 
                @click="closeQuickAddStock" 
                type="button" 
                class="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xl font-bold"
                title="Close (ESC)"
              >
                &times;
              </button>
            </header>

            <!-- Modal Body -->
            <div class="overflow-y-auto p-5 sm:p-6 flex-1 custom-scrollbar space-y-6">
              <form @submit.prevent="handleQuickAddStock" id="stock-item-form" class="space-y-5" @keydown.enter="onStockFormEnter($event)" @keydown.backspace="onFormBackspace($event)">
                
                <!-- Section 1: Item Basic Identity & Categorization -->
                <div class="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                  <h3 class="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span>1. ITEM SPECIFICATIONS & CLASSIFICATION</span>
                  </h3>

                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                    <!-- Item Name -->
                    <div class="sm:col-span-6 space-y-1">
                      <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        ITEM DESCRIPTION / NAME *
                      </label>
                      <input 
                        ref="quickStockNameInput"
                        type="text" 
                        v-model="newStockForm.item" 
                        required 
                        class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" 
                        placeholder="e.g. Castrol MAGNATEC 5W-30 (1L)" 
                      />
                    </div>

                    <!-- SKU / Part No -->
                    <div class="sm:col-span-3 space-y-1">
                      <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        SKU / PART NUMBER
                      </label>
                      <input 
                        type="text" 
                        v-model="newStockForm.pno" 
                        class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" 
                        placeholder="PNO-1002" 
                      />
                    </div>

                    <!-- OEM / Brand -->
                    <div class="sm:col-span-3 space-y-1">
                      <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        OEM / MANUFACTURER BRAND
                      </label>
                      <input 
                        type="text" 
                        v-model="newStockForm.oem" 
                        class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" 
                        placeholder="e.g. Castrol / Bosch" 
                      />
                    </div>

                    <!-- HSN Code -->
                    <div class="sm:col-span-3 space-y-1">
                      <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        HSN / SAC CODE *
                      </label>
                      <input 
                        type="text" 
                        v-model="newStockForm.hsn" 
                        required
                        class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900 outline-none focus:border-indigo-500" 
                        placeholder="27101981" 
                      />
                    </div>

                    <!-- Primary UOM -->
                    <div class="sm:col-span-3 space-y-1">
                      <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        DEFAULT UNIT OF MEASURE (UOM)
                      </label>
                      <select 
                        v-model="newStockForm.uom" 
                        class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-indigo-500"
                        @change="syncStockUomToBatches"
                      >
                        <option value="PCS">PCS (Pieces)</option>
                        <option value="NOS">NOS (Numbers)</option>
                        <option value="KGS">KGS (Kilograms)</option>
                        <option value="LTR">LTR (Litres)</option>
                        <option value="BOX">BOX (Boxes)</option>
                        <option value="MTR">MTR (Metres)</option>
                        <option value="SET">SET (Sets)</option>
                        <option value="PAC">PAC (Packs)</option>
                        <option value="UNT">UNT (Units)</option>
                      </select>
                    </div>

                    <!-- Default GST % -->
                    <div class="sm:col-span-3 space-y-1">
                      <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        DEFAULT GST RATE (%)
                      </label>
                      <select 
                        v-model.number="newStockForm.grate" 
                        class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-indigo-500"
                        @change="syncStockGrateToBatches"
                      >
                        <option :value="0">0% (Nil / Exempt)</option>
                        <option :value="5">5% GST</option>
                        <option :value="12">12% GST</option>
                        <option :value="18">18% GST</option>
                        <option :value="28">28% GST</option>
                      </select>
                    </div>

                    <!-- Reorder / Min Level -->
                    <div class="sm:col-span-3 space-y-1">
                      <label class="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        MIN REORDER LEVEL
                      </label>
                      <input 
                        type="number" 
                        v-model.number="newStockForm.minLevel" 
                        min="0"
                        class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs text-slate-900 outline-none focus:border-indigo-500" 
                        placeholder="0" 
                      />
                    </div>
                  </div>
                </div>

                <!-- Section 2: Multi-Batch Inventory & Pricing Matrix -->
                <div class="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-200/80 space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                        <svg class="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>2. BATCHES, STOCK QUANTITIES & RATES</span>
                      </h3>
                      <p class="text-[9px] font-bold text-indigo-600/80 uppercase tracking-widest mt-0.5">
                        TOTAL OPENING STOCK: {{ totalStockOpeningQty }} {{ newStockForm.uom }} • STOCK VALUE: ₹{{ Number(totalStockValuation).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                      </p>
                    </div>

                    <button 
                      type="button" 
                      @click="addStockBatch" 
                      class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                    >
                      <span class="text-xs font-black">+</span>
                      <span>ADD BATCH (INSERT)</span>
                    </button>
                  </div>

                  <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table class="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr class="bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <th class="px-3 py-2">BATCH NO</th>
                          <th class="px-3 py-2 text-right">OPENING QTY</th>
                          <th class="px-3 py-2">UOM</th>
                          <th class="px-3 py-2 text-right">PURCHASE RATE (₹)</th>
                          <th class="px-3 py-2 text-right">SALE RATE / UNIT (₹)</th>
                          <th class="px-3 py-2 text-right">MRP (₹)</th>
                          <th class="px-3 py-2 text-right">GST %</th>
                          <th class="px-3 py-2">EXPIRY DATE</th>
                          <th class="px-2 py-2 text-center w-10">ACT</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100">
                        <tr 
                          v-for="(batch, idx) in newStockForm.batches" 
                          :key="idx" 
                          class="hover:bg-slate-50 transition-colors"
                        >
                          <!-- Batch No -->
                          <td class="px-2.5 py-1.5">
                            <input 
                              type="text" 
                              v-model="batch.batch" 
                              placeholder="DEFAULT / B01" 
                              class="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs outline-none"
                            />
                          </td>

                          <!-- Qty -->
                          <td class="px-2.5 py-1.5">
                            <input 
                              type="number" 
                              step="any"
                              min="0"
                              v-model.number="batch.qty" 
                              class="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs text-right outline-none"
                            />
                          </td>

                          <!-- UOM -->
                          <td class="px-2.5 py-1.5">
                            <select 
                              v-model="batch.uom"
                              class="px-1.5 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-bold text-[11px] outline-none"
                            >
                              <option value="PCS">PCS</option>
                              <option value="NOS">NOS</option>
                              <option value="KGS">KGS</option>
                              <option value="LTR">LTR</option>
                              <option value="BOX">BOX</option>
                              <option value="MTR">MTR</option>
                              <option value="SET">SET</option>
                              <option value="PAC">PAC</option>
                              <option value="UNT">UNT</option>
                            </select>
                          </td>

                          <!-- Purchase Rate -->
                          <td class="px-2.5 py-1.5">
                            <input 
                              type="number" 
                              step="any"
                              min="0"
                              v-model.number="batch.rate" 
                              class="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs text-right outline-none"
                              placeholder="0.00"
                            />
                          </td>

                          <!-- Sale Rate -->
                          <td class="px-2.5 py-1.5">
                            <input 
                              type="number" 
                              step="any"
                              min="0"
                              v-model.number="batch.sale_rate" 
                              class="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs text-right outline-none text-emerald-600 font-bold"
                              placeholder="0.00"
                            />
                          </td>

                          <!-- MRP -->
                          <td class="px-2.5 py-1.5">
                            <input 
                              type="number" 
                              step="any"
                              min="0"
                              v-model.number="batch.mrp" 
                              class="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs text-right outline-none"
                              placeholder="0.00"
                            />
                          </td>

                          <!-- GST % -->
                          <td class="px-2.5 py-1.5">
                            <input 
                              type="number" 
                              v-model.number="batch.grate" 
                              class="w-14 px-1.5 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs text-right outline-none"
                            />
                          </td>

                          <!-- Expiry -->
                          <td class="px-2.5 py-1.5">
                            <input 
                              type="date" 
                              v-model="batch.expiry" 
                              class="px-1.5 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono text-[10px] outline-none"
                            />
                          </td>

                          <!-- Action -->
                          <td class="px-2 py-1.5 text-center">
                            <button 
                              type="button" 
                              @click="removeStockBatch(idx)" 
                              :disabled="newStockForm.batches.length <= 1"
                              class="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                              title="Remove batch row"
                            >
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </form>
            </div>

            <!-- Modal Footer -->
            <footer class="p-4 sm:p-5 border-t border-slate-100 flex justify-between items-center shrink-0 bg-slate-50">
              <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">
                SHORTCUT: PRESS <kbd class="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded font-mono font-bold">F8</kbd> TO SAVE MASTER
              </div>
              <div class="flex items-center gap-2 ml-auto">
                <button 
                  type="button" 
                  @click="closeQuickAddStock" 
                  class="px-4 py-2 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors cursor-pointer"
                >
                  DISCARD (ESC)
                </button>
                <button 
                  type="button" 
                  @click="handleQuickAddStock" 
                  class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{{ editingStockId ? 'UPDATE STOCK ITEM (F8)' : 'SAVE STOCK ITEM (F8)' }}</span>
                </button>
              </div>
            </footer>
          </div>
        </div>

        <!-- 8. Print & Success Modal with Complete Zero-Mouse Keyboard Support (P, E, W, ESC) -->
        <div v-if="showPrintModal" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4" style="z-index: 60;" @click.self="closePrintModal">
          <div 
            tabindex="0" 
            class="print-modal-container bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-150 outline-none" 
            @keydown="handlePrintModalKeydown"
          >
            <div class="p-3 bg-emerald-50 rounded-full text-emerald-600 border border-emerald-200">
              <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900">
                {{ mode === 'purchase' ? 'Purchase Bill' : 'Sales Invoice' }} Saved Successfully
              </h3>
              <p class="text-xs text-slate-500 mt-1 font-medium">
                Press <kbd class="px-1.5 py-0.5 bg-slate-100 rounded font-bold font-mono">P</kbd> for PDF, <kbd class="px-1.5 py-0.5 bg-slate-100 rounded font-bold font-mono">E</kbd> for Excel, <kbd class="px-1.5 py-0.5 bg-slate-100 rounded font-bold font-mono">W</kbd> for Word, or <kbd class="px-1.5 py-0.5 bg-slate-100 rounded font-bold font-mono">ESC</kbd> for Next Bill
              </p>
            </div>
            <div class="flex flex-wrap gap-2 mt-2 w-full justify-center">
              <button
                type="button"
                @click="downloadCreatedPDF"
                class="px-3 py-2 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Download PDF</span>
                <span class="px-1 bg-blue-800 text-[10px] rounded font-mono">P</span>
              </button>
              <button
                type="button"
                @click="downloadCreatedExcel"
                class="px-3 py-2 rounded-lg text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Export Excel</span>
                <span class="px-1 bg-emerald-200 text-[10px] rounded font-mono">E</span>
              </button>
              <button
                type="button"
                @click="downloadCreatedWord"
                class="px-3 py-2 rounded-lg text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Download Word</span>
                <span class="px-1 bg-indigo-200 text-[10px] rounded font-mono">W</span>
              </button>
              <button
                type="button"
                @click="closePrintModal"
                class="px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-300 shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Next Bill</span>
                <span class="px-1 bg-slate-200 text-[10px] rounded font-mono">ESC</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `
  };

  global.InvoiceWorkspaceComponent = InvoiceWorkspaceComponent;
})(window);
