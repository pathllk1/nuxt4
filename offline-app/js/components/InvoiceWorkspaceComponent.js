// components/InvoiceWorkspaceComponent.js
// 100% Faithful Replica of Nuxt 4 app/pages/accounting/sales/new.vue & purchases/new.vue
(function (global) {
  'use strict';

  const InvoiceWorkspaceComponent = {
    components: {
      InvoicePartyDrawerComponent: global.InvoicePartyDrawerComponent,
      InvoiceStockSelectorModal: global.InvoiceStockSelectorModal,
      InvoiceChargesModal: global.InvoiceChargesModal,
      InvoiceHistoryModalComponent: global.InvoiceHistoryModalComponent,
      InvoiceQuickPartyModal: global.InvoiceQuickPartyModal,
      StockModalComponent: global.StockModalComponent,
      InvoiceHelpModal: global.InvoiceHelpModal,
      InvoicePrintModal: global.InvoicePrintModal
    },
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
        selectedPartyLocation: null,
        selectedConsignee: {
          name: '',
          address: '',
          gstin: '',
          state: 'Maharashtra',
          stateCode: '27',
          pin: '',
          contact: '',
          deliveryInstructions: ''
        },
        consigneeSameAsBillTo: true,
        cart: [], // Starts empty (0 lines) matching Image 1
        otherCharges: [], // F4 modal charges [{ label: 'Freight', amount: 0, grate: 18 }]

        // Modals state
        showStockSelectorModal: false,
        editingStock: null,
        showPartyDrawer: false,
        partySearchQuery: '',
        showOtherChargesModal: false,
        showHistoryModal: false,
        showQuickAddPartyModal: false,
        showQuickAddStockModal: false,
        showPrintModal: false,
        showHelpModal: false,
        wasStockSelectorOpen: false,
        wasPartyDrawerOpen: false,
        editingParty: null,

        // History modal state
        historyItemIndex: null,
        historyRecords: [],
        historyLoading: false,

        // Last saved bill result for the print modal
        createdBill: null,
        createdItems: [],

        gstEnabled: this.firm && this.firm.gst_enabled !== undefined && this.firm.gst_enabled !== null ? Boolean(Number(this.firm.gst_enabled)) : true,
        loading: false
      };
    },
    watch: {
      sourceBill: {
        immediate: true,
        async handler(newBill) {
          if (this.isReturnMode && newBill) {
            await this.loadSourceBill(newBill);
          }
        }
      },
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
          this.selectedPartyJustSet = false;
        } else {
          if (!this.selectedPartyJustSet && !this.showQuickAddPartyModal && !this.wasPartyDrawerOpen) {
            this.restoreFocus();
          }
        }
      },
      showStockSelectorModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
          this.stockItemJustInserted = false;
        } else {
          if (!this.stockItemJustInserted && !this.showQuickAddStockModal && !this.wasStockSelectorOpen) {
            this.restoreFocus();
          }
        }
      },
      showOtherChargesModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
        } else {
          this.restoreFocus();
        }
      },
      showHistoryModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
          this.historyRateJustApplied = false;
        } else {
          if (!this.historyRateJustApplied) {
            this.restoreFocus();
          }
        }
      },
      showHelpModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
        } else {
          this.restoreFocus();
        }
      },
      showQuickAddPartyModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
        } else {
          if (!this.wasPartyDrawerOpen) {
            this.restoreFocus();
          }
        }
      },
      showQuickAddStockModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
        } else {
          if (!this.wasStockSelectorOpen) {
            this.restoreFocus();
          }
        }
      },
      showPrintModal(isOpen) {
        if (isOpen) {
          this.saveFocus();
        } else {
          this.restoreFocus();
        }
      }
    },
    computed: {
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
      activeHistoryItem() {
        if (this.historyItemIndex !== null && this.cart[this.historyItemIndex]) {
          return this.cart[this.historyItemIndex];
        }
        return null;
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
      },
      selectedPartyLocations() {
        if (!this.selectedParty || !this.selectedParty.gstLocations) return [];
        if (Array.isArray(this.selectedParty.gstLocations)) return this.selectedParty.gstLocations;
        try {
          const parsed = JSON.parse(this.selectedParty.gstLocations);
          return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
          return [];
        }
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
        this.selectedPartyLocation = (this.selectedPartyLocations && this.selectedPartyLocations[0]) || null;
        this.buildConsigneeFromParty();
        this.determineTaxType();
        this.showPartyDrawer = false;
        setTimeout(() => {
          // Focus the 'Ship to billing address' toggle checkbox or the billing branch selector
          const targetInput = this.$el.querySelector('.same-toggle input, .consignee-block input, .party-panel select');
          if (targetInput) {
            targetInput.focus();
          } else {
            const sideInput = this.$el.querySelector('.side-panel input, .field-grid input');
            if (sideInput) {
              sideInput.focus();
              if (typeof sideInput.select === 'function') sideInput.select();
            }
          }
        }, 60);
      },
      handleConsigneeToggle() {
        if (this.consigneeSameAsBillTo) {
          this.buildConsigneeFromParty();
          return;
        }
        this.ensureConsignee();
        this.$nextTick(() => {
          const firstShipInput = this.$el.querySelector('.ship-fields input, .ship-fields select');
          if (firstShipInput) {
            firstShipInput.focus();
            if (typeof firstShipInput.select === 'function') firstShipInput.select();
          }
        });
      },
      ensureConsignee() {
        if (!this.selectedConsignee || !this.selectedConsignee.name) {
          this.buildConsigneeFromParty();
        }
      },
      buildConsigneeFromParty() {
        const p = this.selectedParty || {};
        this.selectedConsignee = {
          name: p.name || '',
          address: (this.selectedPartyLocation && this.selectedPartyLocation.address) || p.address || '',
          gstin: (this.selectedPartyLocation && this.selectedPartyLocation.gstin) || p.gstin || 'UNREGISTERED',
          state: (this.selectedPartyLocation && this.selectedPartyLocation.state) || p.state || 'Maharashtra',
          stateCode: (this.selectedPartyLocation && this.selectedPartyLocation.stateCode) || p.stateCode || '27',
          pin: (this.selectedPartyLocation && this.selectedPartyLocation.pin) || p.pin || p.pincode || '',
          contact: (this.selectedPartyLocation && this.selectedPartyLocation.contact) || p.contact || p.phone || '',
          deliveryInstructions: this.selectedConsignee?.deliveryInstructions || ''
        };
      },
      onPartyGstinChange(e) {
        const gstin = e.target.value;
        const loc = this.selectedPartyLocations.find((l) => (l.gstin || l.id) === gstin) || null;
        this.selectedPartyLocation = loc;
        if (loc) {
          if (loc.state) this.selectedParty.state = loc.state;
          if (loc.stateCode) this.selectedParty.stateCode = loc.stateCode;
          this.determineTaxType();
        }
      },
      onConsigneeLocationChange(e) {
        const gstin = e.target.value;
        if (!gstin) return;
        const loc = this.selectedPartyLocations.find((l) => (l.gstin || l.id) === gstin);
        if (loc) {
          this.selectedConsignee.name = this.selectedParty?.name || '';
          this.selectedConsignee.gstin = loc.gstin || 'UNREGISTERED';
          this.selectedConsignee.address = loc.address || '';
          this.selectedConsignee.state = loc.state || '';
          this.selectedConsignee.stateCode = loc.stateCode || (loc.gstin && loc.gstin.length >= 2 ? loc.gstin.substring(0, 2) : '');
          this.selectedConsignee.pin = loc.pincode || loc.pin || '';
          this.selectedConsignee.contact = loc.contact || this.selectedParty?.contact || '';
        }
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
      selectStockFromCatalog({ stock, batch }) {
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
        this.editingStock = null;
        this.wasStockSelectorOpen = this.showStockSelectorModal;
        this.showStockSelectorModal = false;
        this.showQuickAddStockModal = true;
      },
      openEditStock(stock) {
        this.editingStock = stock;
        this.wasStockSelectorOpen = this.showStockSelectorModal;
        this.showStockSelectorModal = false;
        this.showQuickAddStockModal = true;
      },
      closeQuickAddStock() {
        this.showQuickAddStockModal = false;
        this.editingStock = null;
        if (this.wasStockSelectorOpen) {
          this.wasStockSelectorOpen = false;
          this.showStockSelectorModal = true;
        } else {
          this.restoreFocus();
        }
      },
      async handleSavedStock(payload) {
        if (this.editingStock && (this.editingStock.id || this.editingStock._id)) {
          const stockId = this.editingStock.id || this.editingStock._id;
          const now = new Date().toISOString();
          try {
            await global.WebSqlService.executeSql(
              `UPDATE stocks SET item = ?, pno = ?, oem = ?, hsn = ?, uom = ?, rate = ?, cost_rate = ?, grate = ?, min_qty = ?, mrp = ?, batches = ?, updated_at = ? WHERE id = ?`,
              [
                payload.item,
                payload.pno,
                payload.oem,
                payload.hsn,
                payload.uom,
                payload.rate,
                payload.cost_rate,
                payload.grate,
                payload.min_qty,
                payload.mrp,
                JSON.stringify(payload.batches),
                now,
                stockId
              ]
            );
            const found = this.stocks.find(s => (s.id || s._id) === stockId);
            if (found) {
              Object.assign(found, payload, { id: stockId, _id: stockId });
            }
            if (this.$notify) this.$notify('Stock item updated successfully', 'success');
          } catch (err) {
            console.error('Failed to update stock:', err);
          }
          this.editingStock = null;
          this.showQuickAddStockModal = false;
          this.showStockSelectorModal = true;
          return;
        }

        const newStock = {
          id: Date.now(),
          ...payload
        };
        this.$emit('add-stock', newStock);
        this.insertStockIntoCart(newStock);
        this.showQuickAddStockModal = false;
        this.showStockSelectorModal = false;
        this.wasStockSelectorOpen = false;
        this.editingStock = null;
        if (this.$notify) this.$notify(`Stock "${payload.item}" created & added to invoice`, 'success');
      },
      addBlankLineFromModal() {
        this.addCartRow(this.mode === 'purchase' ? 'GOODS' : 'GOODS');
        this.showStockSelectorModal = false;
      },
      removeCartRow(index) {
        this.cart.splice(index, 1);
        this.$nextTick(() => {
          if (this.cart.length > 0) {
            const nextIdx = Math.min(index, this.cart.length - 1);
            const targetInput = this.$el.querySelector(`tr[data-row="${nextIdx}"] input.qty-input, tr[data-row="${nextIdx}"] input.item-name-input`);
            if (targetInput) {
              targetInput.focus();
              if (typeof targetInput.select === 'function') targetInput.select();
            }
          } else {
            this.showStockSelectorModal = true;
          }
        });
      },

      // Other Charges (F4)
      addOtherChargeRow() {
        this.otherCharges.push({ label: 'Freight & Transportation', amount: 0, grate: 18 });
      },
      removeOtherCharge(idx) {
        this.otherCharges.splice(idx, 1);
      },

      // Party-Item Rate History (Alt+H / F7)
      async openHistoryModal(index) {
        this.saveFocus();
        this.historyItemIndex = index;
        const row = this.cart[index];
        if (!row || (!row.item && !row.stockId)) {
          if (this.$notify) this.$notify('Please select or specify an item description first', 'warning');
          return;
        }

        this.historyLoading = true;
        this.showHistoryModal = true;
        this.historyRecords = [];
        this.historySelectedIndex = 0;

        try {
          const db = global.WebSqlService || global.webSqlService;
          if (db) {
            const query = `
              SELECT bi.item, bi.rate, bi.qty, bi.uom, bi.disc, bi.grate, b.bno, b.btype, b.bdate, b.partyId, b.partyName as party_name
              FROM bill_items bi
              JOIN bills b ON bi.billId = b.id
              WHERE (bi.item LIKE ? OR (bi.stockId = ? AND ? IS NOT NULL))
              ORDER BY b.bdate DESC LIMIT 40
            `;
            const stockIdParam = row.stockId || null;
            const res = await (db.executeSql
              ? db.executeSql(query, [`%${row.item || ''}%`, stockIdParam, stockIdParam])
              : db.execute(query, [`%${row.item || ''}%`, stockIdParam, stockIdParam]));
            this.historyRecords = (res && res.rows) || [];

            // Auto-set filter to PARTY if party has history, else ALL
            if (this.selectedParty && this.partyHistoryCount > 0) {
              this.historyFilter = 'PARTY';
            } else {
              this.historyFilter = 'ALL';
            }
          }
        } catch (err) {
          console.error('History fetch error:', err);
        } finally {
          this.historyLoading = false;
          this.$nextTick(() => {
            const el = this.$el.querySelector ? this.$el.querySelector('.history-modal-container') : document.querySelector('.history-modal-container');
            if (el) el.focus();
          });
        }
      },

      applyHistoryRate(record) {
        const rowIdx = this.historyItemIndex;
        if (rowIdx !== null && this.cart[rowIdx]) {
          this.cart[rowIdx].rate = record.rate;
          if (record.disc !== undefined && record.disc !== null) this.cart[rowIdx].disc = record.disc;
          if (record.grate !== undefined && record.grate !== null) this.cart[rowIdx].grate = record.grate;
          if (this.$notify) {
            this.$notify(`Applied rate ₹${Number(record.rate).toFixed(2)} from ${record.bno || 'previous bill'}`, 'success');
          }
        }
        this.historyRateJustApplied = true;
        this.showHistoryModal = false;
        setTimeout(() => {
          if (rowIdx !== null) {
            const target = this.$el.querySelector(`tr[data-row="${rowIdx}"] input.rate-input`);
            if (target) {
              target.focus();
              if (typeof target.select === 'function') target.select();
            }
          }
        }, 80);
      },

      closeHistoryModal() {
        this.showHistoryModal = false;
        const rowIdx = this.historyItemIndex;
        setTimeout(() => {
          if (rowIdx !== null && rowIdx !== undefined && this.cart[rowIdx]) {
            const target = this.$el.querySelector(`tr[data-row="${rowIdx}"] input.rate-input, tr[data-row="${rowIdx}"] input.qty-input, tr[data-row="${rowIdx}"] input.item-name-input`);
            if (target) {
              target.focus();
              if (typeof target.select === 'function') target.select();
            } else {
              this.restoreFocus();
            }
          } else {
            this.restoreFocus();
          }
        }, 50);
      },

      // Return Workflow: Load source bill header and line items
      async loadSourceBill(bill) {
        if (!bill || this._isLoadingSourceBill) return;
        this._isLoadingSourceBill = true;

        try {
          // 1. Resolve and select party
          if (bill.partyId || bill.partyName) {
            const p = (this.parties || []).find(
              (item) => (bill.partyId && Number(item.id) === Number(bill.partyId)) ||
                        (item.name && item.name.toLowerCase().trim() === (bill.partyName || '').toLowerCase().trim())
            );
            if (p) {
              this.selectParty(p);
            } else {
              this.selectedParty = {
                id: bill.partyId || null,
                name: bill.partyName || 'Cash Party',
                gstin: bill.partyGstin || 'UNREGISTERED',
                address: bill.partyAddress || '',
                state: bill.partyState || '',
                state_code: bill.partyStateCode || '27'
              };
              this.selectedPartyGstin = bill.partyGstin || 'UNREGISTERED';
            }
          }

          // 2. Set bill metadata, tax subtype, and references
          if (bill.partyGstin) this.selectedPartyGstin = bill.partyGstin;
          const isInterState = (Number(bill.igst) || 0) > 0 || (bill.billType === 'inter-state');
          this.meta.billType = isInterState ? 'inter-state' : 'intra-state';
          this.meta.reverseCharge = Boolean(bill.reverseCharge);
          this.meta.referenceNo = bill.bno ? `Return of ${bill.bno}` : (bill.orderNo || '');
          if (bill.vehicleNo) this.meta.vehicleNo = bill.vehicleNo;
          if (bill.dispatchThrough) this.meta.dispatchThrough = bill.dispatchThrough;

          // Consignee / Ship-to details if present
          if (bill.consigneeName) {
            this.consigneeSameAsBillTo = false;
            this.selectedConsignee = {
              name: bill.consigneeName || '',
              gstin: bill.consigneeGstin || '',
              address: bill.consigneeAddress || '',
              state: bill.consigneeState || '',
              stateCode: bill.consigneeStateCode || '27',
              pin: bill.consigneePin || '',
              contact: '',
              deliveryInstructions: ''
            };
          }

          // 3. Fetch line items from passed bill or SQLite
          let items = Array.isArray(bill.items) && bill.items.length > 0 ? bill.items : [];
          if (items.length === 0 && bill.id) {
            try {
              const db = global.WebSqlService || global.webSqlService;
              if (db) {
                const query = 'SELECT * FROM bill_items WHERE billId = ? ORDER BY id ASC';
                const res = await (db.executeSql ? db.executeSql(query, [Number(bill.id)]) : db.execute(query, [Number(bill.id)]));
                items = (res && res.rows) || [];
              }
            } catch (err) {
              console.error('[InvoiceWorkspaceComponent] Error fetching return bill items:', err);
            }
          }

          // 4. Populate cart with items and pre-fill return quantities
          if (items.length > 0) {
            this.cart = items.map((it) => {
              const qtyNum = Number(it.qty) || 0;
              return {
                stockId: it.stockId || null,
                item: it.item || '',
                hsn: it.hsn || '',
                qty: qtyNum,
                origQty: qtyNum,
                returnQty: qtyNum,
                uom: it.uom || 'PCS',
                rate: Number(it.rate) || 0,
                grate: it.grate !== undefined && it.grate !== null ? Number(it.grate) : 18,
                disc: Number(it.disc) || 0,
                batch: it.batch || '',
                itemType: it.itemType || 'GOODS',
                narration: it.narration || '',
                originalItem: true
              };
            });

            this.$nextTick(() => {
              const firstQtyInput = this.$el.querySelector ? this.$el.querySelector('tr[data-row="0"] input.qty-input') : document.querySelector('tr[data-row="0"] input.qty-input');
              if (firstQtyInput) {
                firstQtyInput.focus();
                if (typeof firstQtyInput.select === 'function') firstQtyInput.select();
              }
            });
          }
        } finally {
          this._isLoadingSourceBill = false;
        }
      },

      openEditPartyModal(party) {
        if (!party) return;
        this.editingParty = party;
        this.wasPartyDrawerOpen = this.showPartyDrawer;
        this.showPartyDrawer = false;
        this.showQuickAddPartyModal = true;
      },
      openQuickAddParty(searchQuery) {
        this.editingParty = null;
        if (searchQuery) this.partySearchQuery = searchQuery;
        this.wasPartyDrawerOpen = this.showPartyDrawer;
        this.showPartyDrawer = false;
        this.showQuickAddPartyModal = true;
      },
      closeQuickAddParty() {
        this.showQuickAddPartyModal = false;
        this.editingParty = null;
        if (this.wasPartyDrawerOpen) {
          this.wasPartyDrawerOpen = false;
          this.showPartyDrawer = true;
        } else {
          this.restoreFocus();
        }
      },
      async handleQuickAddParty(partyData) {
        const partyName = (partyData.name || partyData.account_name || '').trim();
        if (!partyName) {
          if (this.$notify) this.$notify('Party Name is required', 'warning');
          return;
        }

        const partyId = partyData.id || (this.editingParty && this.editingParty.id) || null;
        const normalized = {
          ...partyData,
          id: partyId,
          name: partyName,
          account_name: partyName,
          partyType: partyData.partyType || partyData.account_type || (this.mode === 'purchase' ? 'SUPPLIER' : 'CUSTOMER'),
          type: partyData.partyType || partyData.account_type || (this.mode === 'purchase' ? 'SUPPLIER' : 'CUSTOMER'),
          gstin: (partyData.gstin && partyData.gstin.trim().toUpperCase()) || 'UNREGISTERED',
          contact: (partyData.contact || partyData.phone || '').trim(),
          phone: (partyData.phone || partyData.contact || '').trim(),
          address: (partyData.address || '').trim(),
          state: partyData.state || 'Maharashtra',
          stateCode: partyData.stateCode || '27'
        };

        this.$emit('add-party', normalized);
        this.selectParty(normalized);
        this.editingParty = null;
        this.showQuickAddPartyModal = false;
        this.showPartyDrawer = false;
        this.wasPartyDrawerOpen = false;
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
          if (!this.selectedParty) {
            if (this.$notify) this.$notify('Please select a customer / supplier party first (F3)', 'warning');
            this.saveFocus();
            this.showPartyDrawer = true;
          } else {
            if (this.$notify) this.$notify('Please add at least one item with valid quantity (F2)', 'warning');
            this.saveFocus();
            this.showStockSelectorModal = true;
          }
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
          consigneeName: this.consigneeSameAsBillTo ? this.selectedParty.name : (this.selectedConsignee.name || this.selectedParty.name),
          consigneeAddress: this.consigneeSameAsBillTo ? this.selectedParty.address : (this.selectedConsignee.address || this.selectedParty.address),
          consigneeGstin: this.consigneeSameAsBillTo ? (this.selectedParty.gstin || '') : (this.selectedConsignee.gstin || ''),
          consigneeState: this.consigneeSameAsBillTo ? (this.selectedParty.state || '') : (this.selectedConsignee.state || this.selectedParty.state || ''),
          consigneePin: this.consigneeSameAsBillTo ? (this.selectedParty.pin || '') : (this.selectedConsignee.pin || ''),
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
          global.ExcelExportService.exportSingleBill(this.createdBill, this.createdItems, this.firm);
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
        if (this.showQuickAddStockModal || this.showQuickAddPartyModal || this.showStockSelectorModal || this.showPartyDrawer || this.showOtherChargesModal || this.showHistoryModal || this.showHelpModal || this.showPrintModal) {
          return;
        }

        // Root Page Shortcuts (Only active when ALL modals are closed)
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
          this.handleSave();
        } else if (e.key === 'F9') {
          e.preventDefault();
          this.$emit('cancel');
        } else if ((e.altKey && (e.key.toLowerCase() === 'h' || e.code === 'KeyH')) || e.key === 'F7') {
          e.preventDefault();
          let targetIdx = 0;
          const activeRowEl = document.activeElement && document.activeElement.closest('tr[data-row]');
          if (activeRowEl) {
            targetIdx = parseInt(activeRowEl.getAttribute('data-row'), 10) || 0;
          } else if (this.historyItemIndex !== null && this.historyItemIndex < this.cart.length) {
            targetIdx = this.historyItemIndex;
          }
          if (this.cart.length > 0 && targetIdx < this.cart.length) {
            this.openHistoryModal(targetIdx);
          } else if (this.cart.length > 0) {
            this.openHistoryModal(0);
          } else {
            if (this.$notify) this.$notify('Add an item to the cart first to view rate history', 'info');
          }
        } else if (e.altKey && (e.key === 'e' || e.key === 'E')) {
          e.preventDefault();
          if (this.selectedParty && !this.isReturnMode) {
            this.openEditPartyModal(this.selectedParty);
          }
        } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') || (e.altKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC'))) {
          e.preventDefault();
          const isInsideCart = document.activeElement && document.activeElement.closest('.table-wrap, .cart-table');
          if (isInsideCart) {
            this.openQuickAddStock();
          } else {
            this.openQuickAddParty();
          }
        }
      },
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
            const sideInput = this.$el.querySelector('.same-toggle input, .consignee-block input, .party-panel select, .detail-panel input, .field-grid input');
            if (sideInput) {
              sideInput.focus();
              if (typeof sideInput.select === 'function') sideInput.select();
            }
          }
        }
      },
      onHeaderBackspace(e) {
        const container = this.$el.querySelector('.header-fields');
        if (container && this.nav) this.nav.handleBackspaceKey(e, container);
      },

      // Party & Consignee Navigation (Ship to billing address & Custom Ship Fields)
      onPartyInputEnter(e) {
        const container = (e.target && e.target.closest('.side-panel')) || this.$el.querySelector('.side-panel');
        if (container && this.nav) {
          this.nav.handleEnterKey(e, container, () => {
            this.focusFirstCartRowOrAddStock();
          });
        }
      },
      onPartyInputBackspace(e) {
        const target = e.target;
        // If backspace on same-toggle checkbox or the first field in side panel, move focus back to header
        if (target && (target.closest('.same-toggle') || target.closest('.consignee-block'))) {
          const sideInputs = this.nav ? this.nav.getFocusableInputs(this.$el.querySelector('.side-panel')) : [];
          if (sideInputs.indexOf(target) <= 0) {
            e.preventDefault();
            const headerInputs = this.nav ? this.nav.getFocusableInputs(this.$el.querySelector('.header-fields')) : [];
            if (headerInputs.length > 0) {
              const lastHeaderInput = headerInputs[headerInputs.length - 1];
              if (lastHeaderInput) {
                lastHeaderInput.focus();
                if (lastHeaderInput.select) lastHeaderInput.select();
              }
            }
            return;
          }
        }
        const container = (e.target && e.target.closest('.side-panel')) || this.$el.querySelector('.side-panel');
        if (container && this.nav) {
          this.nav.handleBackspaceKey(e, container);
        }
      },
      onSameToggleEnter(e) {
        e.preventDefault();
        if (this.consigneeSameAsBillTo) {
          // Checkbox is checked -> jump directly to Reference / PO in detail-panel
          const refInput = this.$el.querySelector('.detail-panel input, .field-grid input');
          if (refInput) {
            refInput.focus();
            if (typeof refInput.select === 'function') refInput.select();
          }
        } else {
          // Checkbox is unchecked -> jump into the first ship field
          const firstShipInput = this.$el.querySelector('.ship-fields input, .ship-fields select, .ship-fields textarea');
          if (firstShipInput) {
            firstShipInput.focus();
            if (typeof firstShipInput.select === 'function') firstShipInput.select();
          }
        }
      },
      onConsigneeAddressEnter(e) {
        if (e.shiftKey) return; // Shift+Enter allows newline in delivery address
        e.preventDefault();
        const container = (e.target && e.target.closest('.side-panel')) || this.$el.querySelector('.side-panel');
        if (container && this.nav) {
          this.nav.handleEnterKey(e, container);
        }
      },

      // Details Panel Navigation (Reference, Vehicle, Dispatch, Narration)
      onDetailEnter(e) {
        const container = (e.target && e.target.closest('.side-panel')) || this.$el.querySelector('.side-panel');
        if (container && this.nav) {
          this.nav.handleEnterKey(e, container, () => {
            this.focusFirstCartRowOrAddStock();
          });
        }
      },
      onDetailBackspace(e) {
        const target = e.target;
        // If in referenceNo and it's empty, and backspace pressed:
        // Move back to either the last ship-to field (if visible) or same-toggle checkbox
        if (target && target.closest('.field-grid') && (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0))) {
          const sideInputs = this.nav ? this.nav.getFocusableInputs(this.$el.querySelector('.side-panel')) : [];
          const idx = sideInputs.indexOf(target);
          if (idx > 0) {
            e.preventDefault();
            const prev = sideInputs[idx - 1];
            if (prev) {
              prev.focus();
              if (prev.select) prev.select();
              return;
            }
          }
        }
        const container = (e.target && e.target.closest('.side-panel')) || this.$el.querySelector('.side-panel');
        if (container && this.nav) {
          this.nav.handleBackspaceKey(e, container);
        }
      },
      onNarrationEnter(e) {
        if (e.shiftKey) return;
        e.preventDefault();
        this.focusFirstCartRowOrAddStock();
      },
      focusFirstCartRowOrAddStock() {
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
        if (this.isReturnMode) {
          const saveBtn = this.$el.querySelector('button.bg-emerald-600, button.bg-blue-600, .save-invoice-btn, footer button:last-child');
          if (saveBtn) {
            saveBtn.focus();
            return;
          }
        }
        this.saveFocus();
        this.showStockSelectorModal = true;
      },
      onCellBackspace(e) {
        const target = e.target;
        // If in row 0, first editable cell, and backspace pressed on empty cell:
        if (target && (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0))) {
          const activeRow = target.closest('tr[data-row="0"]');
          if (activeRow) {
            const rowInputs = this.nav ? this.nav.getFocusableInputs(activeRow) : [];
            if (rowInputs.indexOf(target) <= 0) {
              e.preventDefault();
              const narration = this.$el.querySelector('.field-grid textarea');
              if (narration) {
                narration.focus();
                if (narration.select) narration.select();
                return;
              }
            }
          }
        }
        const container = (e.target && e.target.closest('.table-wrap')) || this.$el.querySelector('.table-wrap');
        if (container && this.nav) this.nav.handleBackspaceKey(e, container);
      }
    },
    async mounted() {
      if (this.isReturnMode && this.sourceBill) {
        await this.loadSourceBill(this.sourceBill);
      }
      if (global.useKeyboardNavigation) {
        this.nav = global.useKeyboardNavigation();
        this.nav.trackPageFocus(this.$el);
        if (this.isReturnMode && this.cart.length > 0) {
          this.$nextTick(() => {
            const firstQtyInput = this.$el.querySelector ? this.$el.querySelector('tr[data-row="0"] input.qty-input') : document.querySelector('tr[data-row="0"] input.qty-input');
            if (firstQtyInput) {
              firstQtyInput.focus();
              if (typeof firstQtyInput.select === 'function') firstQtyInput.select();
            }
          });
        } else {
          this.nav.focusFirstInput(this.$el);
        }
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
                    <p class="font-mono text-xs font-bold text-slate-500">{{ (selectedPartyLocation && selectedPartyLocation.gstin) || selectedParty.gstin || 'UNREGISTERED' }}</p>
                  </div>
                  <button v-if="!isReturnMode" class="change-btn shrink-0" type="button" title="Change party (F3)" @click="showPartyDrawer = true">
                    Change (F3)
                  </button>
                </div>

                <!-- GST Location Selector for Billing (Bill-To) if Party has multiple branches -->
                <div v-if="gstEnabled && selectedPartyLocations && selectedPartyLocations.length > 1" class="mt-1.5">
                  <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    <span>Billing GSTIN / Branch</span>
                    <select 
                      :value="selectedPartyLocation?.gstin || selectedParty.gstin || ''" 
                      @change="onPartyGstinChange" 
                      @keydown.enter.prevent="onPartyInputEnter($event)"
                      @keydown.backspace="onPartyInputBackspace($event)"
                      class="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-700 outline-none"
                    >
                      <option 
                        v-for="loc in selectedPartyLocations" 
                        :key="loc.gstin || loc.stateCode || loc.state" 
                        :value="loc.gstin || ''"
                      >
                        {{ loc.gstin || 'UNREGISTERED' }} - {{ loc.state || loc.stateCode || '' }}{{ loc.isPrimary ? ' (Primary)' : '' }}
                      </option>
                    </select>
                  </label>
                </div>

                <div class="text-[11px] text-slate-600 mt-1 truncate">{{ (selectedPartyLocation && selectedPartyLocation.address) || selectedParty.address || '-' }}</div>
                <div class="text-[10px] text-slate-500 font-semibold mt-0.5">State: {{ (selectedPartyLocation && selectedPartyLocation.state) || selectedParty.state }} ({{ (selectedPartyLocation && selectedPartyLocation.stateCode) || selectedParty.stateCode }})</div>

                <!-- Consignee / Ship-To Section (100% Matching Nuxt 4 PartyManager.vue lines 79-194) -->
                <div class="consignee-block">
                  <label class="same-toggle">
                    <input 
                      type="checkbox" 
                      v-model="consigneeSameAsBillTo" 
                      @change="handleConsigneeToggle"
                      @keydown.enter.prevent="onSameToggleEnter($event)"
                      @keydown.backspace="onPartyInputBackspace($event)"
                    />
                    <span>Ship to billing address</span>
                  </label>

                  <!-- Different Consignee / Ship-To View -->
                  <div v-if="!consigneeSameAsBillTo && selectedConsignee" class="ship-fields">
                    <!-- Quick Pick from Party Locations if Party has multiple branches -->
                    <div v-if="selectedPartyLocations && selectedPartyLocations.length > 1" class="party-branch-picker">
                      <label>
                        <span>Ship to Party Branch:</span>
                        <select 
                          @change="onConsigneeLocationChange" 
                          @keydown.enter.prevent="onPartyInputEnter($event)"
                          @keydown.backspace="onPartyInputBackspace($event)"
                          class="w-full"
                        >
                          <option value="">-- Choose Party Location or Custom --</option>
                          <option 
                            v-for="loc in selectedPartyLocations" 
                            :key="loc.gstin || loc.stateCode || loc.state" 
                            :value="loc.gstin || ''"
                          >
                            {{ loc.gstin || 'Branch' }} - {{ loc.state || '' }} ({{ loc.address ? loc.address.substring(0, 25) + '...' : '' }})
                          </option>
                        </select>
                      </label>
                    </div>

                    <label>
                      <span>Consignee Name *</span>
                      <input 
                        v-model="selectedConsignee.name" 
                        type="text" 
                        placeholder="Consignee / Company name" 
                        @keydown.enter.prevent="onPartyInputEnter($event)"
                        @keydown.backspace="onPartyInputBackspace($event)"
                      />
                    </label>

                    <label>
                      <span>Delivery Address *</span>
                      <textarea 
                        v-model="selectedConsignee.address" 
                        rows="2" 
                        placeholder="Delivery address (Shift+Enter for newline)"
                        @keydown.enter="onConsigneeAddressEnter($event)"
                        @keydown.backspace="onPartyInputBackspace($event)"
                      ></textarea>
                    </label>

                    <div class="ship-grid">
                      <label v-if="gstEnabled">
                        <span>GSTIN</span>
                        <input 
                          v-model="selectedConsignee.gstin" 
                          type="text" 
                          maxlength="15" 
                          placeholder="27ABCDE1234F1Z5" 
                          @keydown.enter.prevent="onPartyInputEnter($event)"
                          @keydown.backspace="onPartyInputBackspace($event)"
                          class="uppercase font-mono"
                        />
                      </label>
                      <label :style="!gstEnabled ? 'grid-column: span 2;' : ''">
                        <span>State *</span>
                        <input 
                          v-model="selectedConsignee.state" 
                          type="text" 
                          placeholder="e.g. Maharashtra" 
                          @keydown.enter.prevent="onPartyInputEnter($event)"
                          @keydown.backspace="onPartyInputBackspace($event)"
                        />
                      </label>
                    </div>

                    <div class="ship-grid">
                      <label>
                        <span>PIN Code</span>
                        <input 
                          v-model="selectedConsignee.pin" 
                          type="text" 
                          maxlength="6" 
                          placeholder="PIN" 
                          @keydown.enter.prevent="onPartyInputEnter($event)"
                          @keydown.backspace="onPartyInputBackspace($event)"
                          class="font-mono"
                        />
                      </label>
                      <label>
                        <span>Contact</span>
                        <input 
                          v-model="selectedConsignee.contact" 
                          type="text" 
                          placeholder="Phone / Contact" 
                          @keydown.enter.prevent="onPartyInputEnter($event)"
                          @keydown.backspace="onPartyInputBackspace($event)"
                        />
                      </label>
                    </div>

                    <label>
                      <span>Delivery Instructions</span>
                      <input 
                        v-model="selectedConsignee.deliveryInstructions" 
                        type="text" 
                        placeholder="Special dispatch instructions"
                        @keydown.enter.prevent="onPartyInputEnter($event)"
                        @keydown.backspace="onPartyInputBackspace($event)"
                      />
                    </label>
                  </div>
                </div>
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
        <invoice-party-drawer-component
          :show="showPartyDrawer"
          :parties="parties"
          :selected-party="selectedParty"
          :mode="mode"
          @close="showPartyDrawer = false"
          @select="selectParty"
          @open-quick-add="openQuickAddParty"
        ></invoice-party-drawer-component>

        <!-- 2. Stock Item Selector Modal (F2) -->
        <invoice-stock-selector-modal
          :show="showStockSelectorModal"
          :stocks="stocks"
          :mode="mode"
          @close="showStockSelectorModal = false"
          @select-stock="selectStockFromCatalog"
          @register-new="openQuickAddStock"
          @edit-stock="openEditStock"
          @add-blank="addBlankLineFromModal"
        ></invoice-stock-selector-modal>

        <!-- 3. Other Charges Modal (F4) -->
        <invoice-charges-modal
          :show="showOtherChargesModal"
          :charges="otherCharges"
          @close="showOtherChargesModal = false"
          @add-row="addOtherChargeRow"
          @remove-row="removeOtherCharge"
        ></invoice-charges-modal>


        <!-- 4. Party-Item Rate History Modal (Alt+H) -->
        <invoice-history-modal-component
          :show="showHistoryModal"
          :active-item="activeHistoryItem"
          :selected-party="selectedParty"
          :history-records="historyRecords"
          :loading="historyLoading"
          @close="showHistoryModal = false; closeHistoryModal()"
          @apply-rate="applyHistoryRate"
        ></invoice-history-modal-component>


        <!-- 5. Help & Shortcuts Modal (F1 / Shift+?) -->
        <invoice-help-modal
          :show="showHelpModal"
          @close="showHelpModal = false"
        ></invoice-help-modal>

        <!-- 6. Quick Add Party Modal (Insert) -->
        <invoice-quick-party-modal
          :show="showQuickAddPartyModal"
          :editing-party="editingParty"
          :initial-name="partySearchQuery"
          :mode="mode"
          @close="closeQuickAddParty"
          @save="handleQuickAddParty"
        ></invoice-quick-party-modal>

        <!-- 7. Stock Master Modal (Reusing StockModalComponent) -->
        <stock-modal-component
          :show="showQuickAddStockModal"
          :stock-to-edit="editingStock"
          @close="closeQuickAddStock"
          @save="handleSavedStock"
        ></stock-modal-component>

        <!-- 8. Print Modal -->
        <invoice-print-modal
          :show="showPrintModal"
          :bill="createdBill"
          :items="createdItems"
          :firm="firm"
          @close="closePrintModal"
          @download-pdf="downloadCreatedPDF"
          @download-excel="downloadCreatedExcel"
          @download-word="downloadCreatedWord"
        ></invoice-print-modal>
      </div>
    `
  };

  global.InvoiceWorkspaceComponent = InvoiceWorkspaceComponent;
})(window);
