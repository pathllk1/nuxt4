// components/FirmSettingsComponent.js
// 100% Faithful Replica of Nuxt 4 FirmFormModal.vue & FirmsManagement.vue
(function (global) {
  'use strict';

  const FirmSettingsComponent = {
    props: {
      firm: { type: Object, default: () => ({}) },
      loading: { type: Boolean, default: false }
    },
    emits: ['save-firm', 'close'],
    data() {
      return {
        form: {
          name: '',
          legal_name: '',
          code: '',
          description: '',
          phone_number: '',
          secondary_phone: '',
          email: '',
          website: '',
          business_type: 'Private Limited',
          industry_type: '',
          establishment_year: new Date().getFullYear(),
          employee_count: 0,
          registration_number: '',
          registration_date: '',
          cin_number: '',
          pan_number: '',
          address: '',
          city: '',
          state: 'Maharashtra',
          country: 'India',
          pincode: '',
          bank_name: '',
          bank_account_number: '',
          bank_branch: '',
          ifsc_code: '',
          payment_terms: 'Payment within 30 days',
          currency: 'INR',
          locations: [],
          gst_enabled: true
        },
        activeTab: 'identity' // 'identity' | 'locations' | 'banking' | 'tax'
      };
    },
    watch: {
      firm: {
        immediate: true,
        handler(val) {
          if (val) {
            this.form = {
              name: val.name || '',
              legal_name: val.legal_name || '',
              code: val.code || '',
              description: val.description || '',
              phone_number: val.phone_number || '',
              secondary_phone: val.secondary_phone || '',
              email: val.email || '',
              website: val.website || '',
              business_type: val.business_type || 'Private Limited',
              industry_type: val.industry_type || '',
              establishment_year: val.establishment_year || new Date().getFullYear(),
              employee_count: val.employee_count || 0,
              registration_number: val.registration_number || '',
              registration_date: val.registration_date || '',
              cin_number: val.cin_number || '',
              pan_number: val.pan_number || '',
              address: val.address || '',
              city: val.city || '',
              state: val.state || 'Maharashtra',
              country: val.country || 'India',
              pincode: val.pincode || '',
              bank_name: val.bank_name || '',
              bank_account_number: val.bank_account_number || '',
              bank_branch: val.bank_branch || '',
              ifsc_code: val.ifsc_code || '',
              payment_terms: val.payment_terms || 'Payment within 30 days',
              currency: val.currency || 'INR',
              locations: Array.isArray(val.locations) ? JSON.parse(JSON.stringify(val.locations)) : [],
              gst_enabled: val.gst_enabled !== undefined && val.gst_enabled !== null ? Boolean(Number(val.gst_enabled)) : true
            };
          }
        }
      }
    },
    methods: {
      addLocationRow() {
        this.form.locations.push({
          gst_number: '',
          state: 'Maharashtra',
          state_code: '27',
          registration_type: this.form.locations.length === 0 ? 'PPOB' : 'APOB',
          address: this.form.address || '',
          city: this.form.city || '',
          pincode: this.form.pincode || '',
          is_default: this.form.locations.length === 0
        });
      },
      removeLocationRow(idx) {
        const wasDefault = this.form.locations[idx]?.is_default;
        this.form.locations.splice(idx, 1);
        if (wasDefault && this.form.locations.length > 0) {
          this.form.locations[0].is_default = true;
        }
      },
      setDefaultLocation(idx) {
        this.form.locations.forEach((loc, i) => {
          loc.is_default = i === idx;
        });
      },
      onGstInput(idx, event) {
        const val = event.target.value.trim().toUpperCase();
        this.form.locations[idx].gst_number = val;
        // Auto-extract state code if valid length >= 2
        if (val.length >= 2) {
          const sc = val.substring(0, 2);
          this.form.locations[idx].state_code = sc;
          if (global.Validators && global.Validators.getStateFromGstin) {
            const st = global.Validators.getStateFromGstin(val);
            if (st) this.form.locations[idx].state = st;
          }
        }
      },
      handleSubmit() {
        if (!this.form.name.trim()) {
          if (this.$notify) this.$notify('Firm / Company Name is required', 'warning');
          this.activeTab = 'identity';
          return;
        }
        this.$emit('save-firm', this.form);
      }
    },
    template: `
      <div class="space-y-4 w-full text-slate-800">
        <!-- Header Section (Matching Nuxt 4 Admin Header) -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 class="text-base sm:text-lg font-black uppercase text-slate-900 tracking-tight leading-none">
                Firm Settings & Company Profile
              </h1>
              <p class="text-[11px] font-medium text-slate-500 mt-1">
                Configure your enterprise identity, multi-GSTIN locations, registered addresses, and bank accounts
              </p>
            </div>
          </div>

          <div class="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              @click="$emit('close')"
              class="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="loading"
              @click="handleSubmit"
              class="px-4 py-1.5 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-xs shadow-blue-500/20 transition-all cursor-pointer"
            >
              {{ loading ? 'Saving...' : 'Save Firm Settings' }}
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 gap-2 text-xs font-bold">
          <button
            type="button"
            @click="activeTab = 'identity'"
            :class="activeTab === 'identity' ? 'border-b-2 border-blue-600 text-blue-600 pb-2.5' : 'text-slate-500 hover:text-slate-900 pb-2.5'"
            class="transition-colors cursor-pointer px-2"
          >
            1. Company Identity
          </button>
          <button
            type="button"
            @click="activeTab = 'locations'"
            :class="activeTab === 'locations' ? 'border-b-2 border-blue-600 text-blue-600 pb-2.5' : 'text-slate-500 hover:text-slate-900 pb-2.5'"
            class="transition-colors cursor-pointer px-2 flex items-center gap-1.5"
          >
            <span>2. Multi-GSTIN Locations</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">{{ form.locations.length }}</span>
          </button>
          <button
            type="button"
            @click="activeTab = 'banking'"
            :class="activeTab === 'banking' ? 'border-b-2 border-blue-600 text-blue-600 pb-2.5' : 'text-slate-500 hover:text-slate-900 pb-2.5'"
            class="transition-colors cursor-pointer px-2"
          >
            3. Banking & Settlement
          </button>
          <button
            type="button"
            @click="activeTab = 'tax'"
            :class="activeTab === 'tax' ? 'border-b-2 border-blue-600 text-blue-600 pb-2.5' : 'text-slate-500 hover:text-slate-900 pb-2.5'"
            class="transition-colors cursor-pointer px-2"
          >
            4. Statutory & PAN
          </button>
        </div>

        <!-- Tab 1: Company Identity -->
        <div v-if="activeTab === 'identity'" class="bg-white border border-slate-200 rounded-b-xl p-5 shadow-xs space-y-4">
          <!-- GST Compliance Mode Toggle Card -->
          <div class="p-4 rounded-xl border transition-all" :class="form.gst_enabled ? 'bg-blue-50/70 border-blue-200' : 'bg-slate-50 border-slate-200'">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0" :class="form.gst_enabled ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'">
                  {{ form.gst_enabled ? 'GST' : 'NON' }}
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="text-xs font-black uppercase tracking-wide text-slate-900">
                      GST Compliance Mode:
                    </h4>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase" :class="form.gst_enabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-700'">
                      {{ form.gst_enabled ? 'Registered (GST ON)' : 'Non-GST / Unregistered (GST OFF)' }}
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-500 mt-0.5">
                    {{ form.gst_enabled ? 'Generates Tax Invoices with CGST/SGST/IGST rates and HSN codes across Sales & Purchases.' : 'Business is unregistered, composition, or below GST limit. Generates clean Non-GST Bills of Supply without tax calculations.' }}
                  </p>
                </div>
              </div>

              <!-- Interactive Toggle Switch -->
              <label class="relative inline-flex items-center cursor-pointer shrink-0">
                <input type="checkbox" v-model="form.gst_enabled" class="sr-only peer" />
                <div class="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span class="ml-2.5 text-xs font-black uppercase tracking-wider" :class="form.gst_enabled ? 'text-blue-700' : 'text-slate-500'">
                  {{ form.gst_enabled ? 'GST ON' : 'GST OFF' }}
                </span>
              </label>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Trade / Display Name *</label>
              <input type="text" v-model="form.name" placeholder="Firm display name" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Legal Registered Name</label>
              <input type="text" v-model="form.legal_name" placeholder="Legal registered entity name" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Firm Short Code</label>
              <input type="text" v-model="form.code" placeholder="CODE" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Business Constitution</label>
              <select v-model="form.business_type" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="Private Limited">Private Limited Company</option>
                <option value="Proprietorship">Sole Proprietorship</option>
                <option value="Partnership">Partnership Firm</option>
                <option value="LLP">Limited Liability Partnership (LLP)</option>
                <option value="Public Limited">Public Limited</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Phone Number</label>
              <input type="text" v-model="form.phone_number" placeholder="+91..." class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Official Email</label>
              <input type="email" v-model="form.email" placeholder="billing@company.com" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div class="sm:col-span-2">
              <label class="block font-bold text-slate-700 mb-1">Registered Head Office Address</label>
              <input type="text" v-model="form.address" placeholder="Premises, Street, Area" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">City</label>
              <input type="text" v-model="form.city" placeholder="City" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">State / Province</label>
              <input type="text" v-model="form.state" placeholder="e.g. Maharashtra" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">PIN / Postal Code</label>
              <input type="text" v-model="form.pincode" placeholder="400001" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Website</label>
              <input type="text" v-model="form.website" placeholder="https://..." class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <!-- Tab 2: Multi-GSTIN Locations (Nuxt 4 FirmFormModal.vue lines 53-64) -->
        <div v-if="activeTab === 'locations'" class="bg-white border border-slate-200 rounded-b-xl p-5 shadow-xs space-y-4">
          <!-- Non-GST Notice when GST is turned off -->
          <div v-if="!form.gst_enabled" class="py-10 px-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
            <span class="text-3xl block">📋</span>
            <h4 class="text-xs font-black uppercase text-slate-800">GST Registration Is Turned OFF</h4>
            <p class="text-[11px] text-slate-500 max-w-md mx-auto">
              Your firm is currently operating in Non-GST mode. No GSTIN locations are required, and your sales/purchase invoices will automatically be issued as Bills of Supply.
            </p>
            <button
              type="button"
              @click="form.gst_enabled = true"
              class="mt-2 px-3.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 cursor-pointer"
            >
              Turn On GST Registration
            </button>
          </div>

          <template v-else>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-black uppercase text-slate-900">Billing GSTIN Locations</h3>
                <p class="text-[10px] text-slate-500 mt-0.5">Manage state-wise GSTIN numbers for branch & head offices</p>
              </div>
              <button
                type="button"
                @click="addLocationRow"
                class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-all cursor-pointer"
              >
                + Add GSTIN Location
              </button>
            </div>

            <div v-if="form.locations.length" class="space-y-3">
              <div
                v-for="(loc, lIdx) in form.locations"
                :key="lIdx"
                class="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-slate-900">Location #{{ lIdx + 1 }}</span>
                    <span v-if="loc.is_default" class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Default Billing GSTIN
                    </span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <button
                      v-if="!loc.is_default"
                      type="button"
                      @click="setDefaultLocation(lIdx)"
                      class="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Set as Default
                    </button>
                    <button
                      type="button"
                      @click="removeLocationRow(lIdx)"
                      class="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label class="block font-bold text-slate-600 mb-0.5">GSTIN *</label>
                    <input
                      type="text"
                      :value="loc.gst_number"
                      @input="onGstInput(lIdx, $event)"
                      placeholder="15-character GSTIN"
                      class="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 uppercase"
                    />
                  </div>

                  <div>
                    <label class="block font-bold text-slate-600 mb-0.5">State</label>
                    <input type="text" v-model="loc.state" placeholder="State" class="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900" />
                  </div>

                  <div>
                    <label class="block font-bold text-slate-600 mb-0.5">State Code</label>
                    <input type="text" v-model="loc.state_code" placeholder="e.g. 27" class="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900" />
                  </div>

                  <div>
                    <label class="block font-bold text-slate-600 mb-0.5">Registration Type</label>
                    <select v-model="loc.registration_type" class="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-800">
                      <option value="PPOB">PPOB (Principal Place)</option>
                      <option value="APOB">APOB (Additional Place)</option>
                    </select>
                  </div>

                  <div class="sm:col-span-3">
                    <label class="block font-bold text-slate-600 mb-0.5">Branch Street Address</label>
                    <input type="text" v-model="loc.address" placeholder="Address for this GSTIN location" class="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900" />
                  </div>

                  <div>
                    <label class="block font-bold text-slate-600 mb-0.5">Pincode</label>
                    <input type="text" v-model="loc.pincode" placeholder="Pincode" class="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900" />
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p>No GSTIN locations configured yet.</p>
              <button
                type="button"
                @click="addLocationRow"
                class="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 cursor-pointer"
              >
                + Add First GSTIN Location
              </button>
            </div>
          </template>
        </div>

        <!-- Tab 3: Banking & Settlement -->
        <div v-if="activeTab === 'banking'" class="bg-white border border-slate-200 rounded-b-xl p-5 shadow-xs space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Bank Name</label>
              <input type="text" v-model="form.bank_name" placeholder="e.g. HDFC Bank, SBI, ICICI" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Account Number</label>
              <input type="text" v-model="form.bank_account_number" placeholder="Bank Account Number" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">IFSC Code</label>
              <input type="text" v-model="form.ifsc_code" placeholder="HDFC0001234" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono uppercase font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Branch Name</label>
              <input type="text" v-model="form.bank_branch" placeholder="Branch location" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div class="sm:col-span-2">
              <label class="block font-bold text-slate-700 mb-1">Default Invoice Payment Terms</label>
              <input type="text" v-model="form.payment_terms" placeholder="Payment within 30 days of invoice" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <!-- Tab 4: Statutory & Tax Identifiers -->
        <div v-if="activeTab === 'tax'" class="bg-white border border-slate-200 rounded-b-xl p-5 shadow-xs space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Permanent Account Number (PAN)</label>
              <input type="text" v-model="form.pan_number" placeholder="ABCDE1234F" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold uppercase text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Corporate Identification Number (CIN)</label>
              <input type="text" v-model="form.cin_number" placeholder="U12345MH2020PTC..." class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono uppercase text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Registration / MSME Number</label>
              <input type="text" v-model="form.registration_number" placeholder="Optional MSME or Reg No" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      </div>
    `
  };

  global.FirmSettingsComponent = FirmSettingsComponent;
})(window);
