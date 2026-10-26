// components/StockModalComponent.js
// 100% Faithful Replica of Nuxt 4 app/components/inventory/ItemStockMasterModal.vue
(function (global) {
  'use strict';

  const StockModalComponent = {
    props: {
      show: { type: Boolean, default: false },
      stockToEdit: { type: Object, default: null }
    },
    emits: ['close', 'save'],
    data() {
      return {
        form: {
          _id: '',
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
        }
      };
    },
    computed: {
      isEditing() {
        return !!(this.stockToEdit && (this.stockToEdit.id || this.stockToEdit._id));
      },
      totalOpeningQty() {
        if (!this.form.batches) return 0;
        return this.form.batches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);
      },
      totalStockValuation() {
        if (!this.form.batches) return 0;
        return this.form.batches.reduce((sum, b) => sum + ((Number(b.qty) || 0) * (Number(b.rate) || 0)), 0);
      }
    },
    watch: {
      show(isOpen) {
        if (isOpen) {
          if (this.stockToEdit) {
            this.hydrateFormData(this.stockToEdit);
          } else {
            this.resetForm();
          }
          const focusInput = () => {
            const input = this.$refs.itemNameInput || (this.$el && this.$el.querySelector('input[placeholder*="Item / Part Name"], #stock-item-form input'));
            if (input && typeof input.focus === 'function' && input.offsetHeight > 0) {
              input.focus();
              if (typeof input.select === 'function') input.select();
              return true;
            }
            return false;
          };
          this.$nextTick(() => {
            if (!focusInput()) {
              setTimeout(focusInput, 30);
              setTimeout(focusInput, 90);
              setTimeout(focusInput, 200);
            }
          });
          setTimeout(focusInput, 30);
          setTimeout(focusInput, 90);
          setTimeout(focusInput, 200);
        }
      }
    },
    methods: {
      resetForm() {
        this.form = {
          _id: '',
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
        };
      },
      hydrateFormData(data) {
        let parsedBatches = [];
        if (data.batches) {
          try {
            parsedBatches = typeof data.batches === 'string' ? JSON.parse(data.batches) : data.batches;
          } catch (e) {
            parsedBatches = [];
          }
        }

        if (!Array.isArray(parsedBatches) || parsedBatches.length === 0) {
          parsedBatches = [
            {
              batch: data.batch || 'DEFAULT / B01',
              qty: Number(data.qty) || 0,
              uom: data.uom || 'PCS',
              rate: Number(data.cost_rate || data.rate) || 0,
              sale_rate: Number(data.rate) || 0,
              grate: data.grate !== undefined ? Number(data.grate) : 18,
              mrp: Number(data.mrp) || 0,
              expiry: ''
            }
          ];
        }

        this.form = {
          _id: String(data.id || data._id || ''),
          item: data.item || '',
          pno: data.pno || '',
          oem: data.oem || '',
          hsn: data.hsn || '',
          uom: data.uom || 'PCS',
          grate: data.grate !== undefined ? Number(data.grate) : 18,
          minLevel: Number(data.min_qty || data.minLevel) || 0,
          batches: parsedBatches
        };
      },
      syncUomToBatches() {
        this.form.batches.forEach(b => {
          b.uom = this.form.uom;
        });
      },
      syncGrateToBatches() {
        this.form.batches.forEach(b => {
          b.grate = this.form.grate;
        });
      },
      addBatch() {
        this.form.batches.push({
          batch: '',
          qty: 0,
          uom: this.form.uom,
          rate: 0,
          sale_rate: 0,
          grate: this.form.grate,
          mrp: 0,
          expiry: ''
        });
      },
      removeBatch(idx) {
        if (this.form.batches.length <= 1) return;
        this.form.batches.splice(idx, 1);
      },
      handleSubmit() {
        if (!this.form.item || !this.form.item.trim()) {
          if (this.$notify) this.$notify('Item Description / Name is required', 'warning');
          return;
        }
        if (!this.form.hsn || !this.form.hsn.trim()) {
          if (this.$notify) this.$notify('HSN / SAC Code is required', 'warning');
          return;
        }
        if (!this.form.batches || this.form.batches.length === 0) {
          if (this.$notify) this.$notify('At least one batch row is required', 'warning');
          return;
        }

        const b0 = this.form.batches[0];
        const totalQty = this.totalOpeningQty;
        const primaryRate = Number(b0.sale_rate || b0.rate) || 0;
        const primaryCostRate = Number(b0.rate) || primaryRate;
        const primaryGrate = Number(this.form.grate !== undefined ? this.form.grate : b0.grate) || 18;
        const primaryMrp = Number(b0.mrp) || 0;

        const payload = {
          item: this.form.item.trim(),
          pno: this.form.pno ? this.form.pno.trim() : '',
          oem: this.form.oem ? this.form.oem.trim() : '',
          hsn: this.form.hsn.trim(),
          uom: this.form.uom || 'PCS',
          rate: primaryRate,
          cost_rate: primaryCostRate,
          grate: primaryGrate,
          min_qty: Number(this.form.minLevel) || 0,
          mrp: primaryMrp,
          batch: b0.batch || '',
          batches: JSON.parse(JSON.stringify(this.form.batches)),
          qty: totalQty
        };

        this.$emit('save', payload);
      },
      onInputEnter(e) {
        const target = e.target;
        if (target && target.tagName === 'TEXTAREA' && !e.ctrlKey) return;
        const formEl = (target && target.closest('form')) || (this.$el && typeof this.$el.querySelector === 'function' ? this.$el.querySelector('form') : document.querySelector('form'));
        if (!formEl) return;
        const focusable = Array.from(
          formEl.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])')
        ).filter(el => el.offsetHeight > 0);
        const idx = focusable.indexOf(target);
        if (idx > -1 && idx < focusable.length - 1) {
          e.preventDefault();
          focusable[idx + 1].focus();
          if (typeof focusable[idx + 1].select === 'function') focusable[idx + 1].select();
        } else {
          e.preventDefault();
          this.handleSubmit();
        }
      },
      onInputBackspace(e) {
        const target = e.target;
        if (!target) return;

        let shouldMoveBack = false;

        if (target instanceof HTMLInputElement) {
          const textTypes = ['text', 'number', 'search', 'tel', 'url', 'date', 'email', 'password'];
          if (textTypes.includes(target.type)) {
            // Only move back if field is empty or cursor is at the start with no text selected
            if (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0)) {
              shouldMoveBack = true;
            }
          } else if (target.type === 'checkbox' || target.type === 'radio') {
            shouldMoveBack = true;
          }
        } else if (target instanceof HTMLSelectElement) {
          shouldMoveBack = true;
        } else if (target instanceof HTMLTextAreaElement) {
          if (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0)) {
            shouldMoveBack = true;
          }
        }

        if (shouldMoveBack) {
          const formEl = (target && target.closest('form')) || (this.$el && typeof this.$el.querySelector === 'function' ? this.$el.querySelector('form') : document.querySelector('form'));
          if (!formEl) return;
          const focusable = Array.from(
            formEl.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])')
          ).filter(el => el.offsetHeight > 0);
          const idx = focusable.indexOf(target);
          if (idx > 0) {
            e.preventDefault();
            const prev = focusable[idx - 1];
            prev.focus();
            if (typeof prev.select === 'function') prev.select();
          }
        }
      },
      handleModalKeydown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.$emit('close');
        } else if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's' || e.key === 'Enter'))) {
          e.preventDefault();
          e.stopPropagation();
          this.handleSubmit();
        } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
          e.preventDefault();
          e.stopPropagation();
          this.addBatch();
        }
      }
    },
    mounted() {
      this._windowKeyHandler = (e) => {
        if (!this.show) return;
        this.handleModalKeydown(e);
      };
      window.addEventListener('keydown', this._windowKeyHandler, true);
    },
    beforeUnmount() {
      if (this._windowKeyHandler) {
        window.removeEventListener('keydown', this._windowKeyHandler, true);
      }
    },
    template: `
      <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md" style="z-index: 60;" @click.self="$emit('close')">
        <div 
          class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-scale-in flex flex-col"
        >
          <!-- Modal Header (Vibrant Gradient Matching Nuxt 4) -->
          <header class="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 px-6 sm:px-8 py-4 text-white flex justify-between items-center shrink-0">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-md bg-white/20 text-[9px] font-black uppercase tracking-wider">
                  {{ isEditing ? 'Edit Stock Master' : 'Stock Master Registration' }}
                </span>
                <span v-if="form.hsn" class="px-2 py-0.5 rounded-md bg-indigo-950/40 text-[9px] font-mono font-bold tracking-wider">
                  HSN: {{ form.hsn }}
                </span>
              </div>
              <h2 class="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <span>{{ isEditing ? ('Edit: ' + (form.item || 'Stock Item')) : 'Register New Stock Item' }}</span>
              </h2>
              <p class="text-[9px] sm:text-[10px] font-bold text-indigo-100 uppercase tracking-widest">
                ENTER: NEXT FIELD • BACKSPACE: PREVIOUS FIELD • INSERT / CTRL+N: ADD BATCH • F8: SAVE • ESC: CLOSE
              </p>
            </div>

            <button 
              @click="$emit('close')" 
              type="button" 
              class="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xl font-bold"
              title="Close (ESC)"
            >
              &times;
            </button>
          </header>

          <!-- Modal Body -->
          <div class="overflow-y-auto p-5 sm:p-6 flex-1 custom-scrollbar space-y-6">
            <form @submit.prevent="handleSubmit" id="stock-master-modal-form" class="space-y-5" @keydown.enter="onInputEnter($event)" @keydown.backspace="onInputBackspace($event)">
              
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
                      ref="itemNameInput"
                      type="text" 
                      v-model="form.item" 
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
                      v-model="form.pno" 
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
                      v-model="form.oem" 
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
                      v-model="form.hsn" 
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
                      v-model="form.uom" 
                      class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-indigo-500"
                      @change="syncUomToBatches"
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
                      v-model.number="form.grate" 
                      class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 outline-none focus:border-indigo-500"
                      @change="syncGrateToBatches"
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
                      v-model.number="form.minLevel" 
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
                      TOTAL OPENING STOCK: {{ totalOpeningQty }} {{ form.uom }} • STOCK VALUE: ₹{{ Number(totalStockValuation).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                    </p>
                  </div>

                  <button 
                    type="button" 
                    @click="addBatch" 
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
                        v-for="(batch, idx) in form.batches" 
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
                            @click="removeBatch(idx)" 
                            :disabled="form.batches.length <= 1"
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
              SHORTCUT: PRESS <kbd class="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded font-mono font-bold">F8</kbd> TO {{ isEditing ? 'UPDATE' : 'SAVE' }} MASTER
            </div>
            <div class="flex items-center gap-2 ml-auto">
              <button 
                type="button" 
                @click="$emit('close')" 
                class="px-4 py-2 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors cursor-pointer"
              >
                DISCARD (ESC)
              </button>
              <button 
                type="button" 
                @click="handleSubmit" 
                class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span>{{ isEditing ? 'UPDATE STOCK ITEM (F8)' : 'SAVE STOCK ITEM (F8)' }}</span>
              </button>
            </div>
          </footer>
        </div>
      </div>
    `
  };

  global.StockModalComponent = StockModalComponent;
})(window);
