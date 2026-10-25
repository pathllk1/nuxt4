ppppppp// components/PartyManagerComponent.js
(function (global) {
  'use strict';

  const PartyManagerComponent = {
    props: {
      parties: { type: Array, default: () => [] },
      searchQuery: { type: String, default: '' },
      typeFilter: { type: String, default: 'ALL' },
      loading: { type: Boolean, default: false }
    },
    emits: ['update:searchQuery', 'update:typeFilter', 'add-party', 'delete-party'],
    data() {
      return {
        showModal: false,
        form: {
          name: '',
          partyType: 'CUSTOMER',
          gstin: '',
          contact: '',
          state: 'Maharashtra',
          stateCode: '27',
          address: '',
          openingBalance: 0,
          balanceType: 'CR'
        }
      };
    },
    watch: {
      showModal(isOpen) {
        if (isOpen) {
          this.focusPartyNameInput();
        } else {
          this.$nextTick(() => {
            const btn = this.$el.querySelector('.add-party-btn') || this.$refs.searchInput;
            if (btn && typeof btn.focus === 'function') btn.focus();
          });
        }
      }
    },
    mounted() {
      if (global.useKeyboardNavigation) {
        this.nav = global.useKeyboardNavigation();
      }
      window.addEventListener('keydown', this.handleKeydown);
    },
    beforeUnmount() {
      window.removeEventListener('keydown', this.handleKeydown);
    },
    methods: {
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '₹' + Number(val).toFixed(2);
      },
      openAddModal() {
        this.form = {
          name: this.searchQuery ? this.searchQuery.trim() : '',
          partyType: this.typeFilter === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER',
          gstin: '',
          contact: '',
          state: 'Maharashtra',
          stateCode: '27',
          address: '',
          openingBalance: 0,
          balanceType: 'CR'
        };
        this.showModal = true;
        this.focusPartyNameInput();
      },
      focusPartyNameInput() {
        const tryFocus = () => {
          const el = this.$refs.partyNameInput || (this.$el && this.$el.querySelector('.party-modal-container input, #party-name-input, input[placeholder*="Party / Company Name"]'));
          if (el && typeof el.focus === 'function' && el.offsetHeight > 0) {
            el.focus();
            if (typeof el.select === 'function') el.select();
            return true;
          }
          return false;
        };
        this.$nextTick(tryFocus);
        setTimeout(tryFocus, 25);
        setTimeout(tryFocus, 80);
        setTimeout(tryFocus, 180);
      },
      handleKeydown(e) {
        // Modal is active
        if (this.showModal) {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.showModal = false;
          } else if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's'))) {
            e.preventDefault();
            this.handleSave();
          }
          return;
        }

        // Modal is not active (Table / Page View)
        if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
          e.preventDefault();
          this.openAddModal();
        } else if (e.key === 'F2' || (e.key === '/' && document.activeElement && document.activeElement.tagName !== 'INPUT')) {
          e.preventDefault();
          const searchInput = this.$refs.searchInput;
          if (searchInput) {
            searchInput.focus();
            if (searchInput.select) searchInput.select();
          }
        }
      },
      onFormEnter(e) {
        const form = (e.target && e.target.closest('form')) || (this.$el && this.$el.querySelector('.party-modal-form'));
        if (form && this.nav) {
          this.nav.handleEnterKey(e, form, () => {
            this.handleSave();
          });
        }
      },
      onFormBackspace(e) {
        const form = (e.target && e.target.closest('form')) || (this.$el && this.$el.querySelector('.party-modal-form'));
        if (form && this.nav) {
          this.nav.handleBackspaceKey(e, form);
        }
      },
      handleSave() {
        if (!this.form.name.trim()) return;
        this.$emit('add-party', { ...this.form });
        this.showModal = false;
        this.form = {
          name: '',
          partyType: 'CUSTOMER',
          gstin: '',
          contact: '',
          state: 'Maharashtra',
          stateCode: '27',
          address: '',
          openingBalance: 0,
          balanceType: 'CR'
        };
      }
    },
    template: `
      <div class="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden w-full">
        <!-- Control Header -->
        <div class="p-2 sm:p-2.5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 w-full">
          <div class="flex items-center space-x-2 flex-1">
            <div class="relative flex-1 max-w-sm">
              <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref="searchInput"
                type="text"
                :value="searchQuery"
                @input="$emit('update:searchQuery', $event.target.value)"
                placeholder="Search party name, GSTIN, phone... (F2 / /)"
                class="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs font-medium"
              />
            </div>

            <select
              :value="typeFilter"
              @change="$emit('update:typeFilter', $event.target.value)"
              class="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer font-medium"
            >
              <option value="ALL">All Parties</option>
              <option value="CUSTOMER">Customers Only</option>
              <option value="SUPPLIER">Suppliers Only</option>
            </select>
          </div>

          <!-- Add Party Button -->
          <button
            type="button"
            @click="openAddModal"
            class="add-party-btn inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs shadow-indigo-500/20 transition-all cursor-pointer shrink-0"
            title="Create Party (Insert / Ctrl+N)"
          >
            <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Add Party (Insert)</span>
          </button>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto w-full">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th class="py-2 px-3">Party Name</th>
                <th class="py-2 px-3 whitespace-nowrap">Role</th>
                <th class="py-2 px-3 whitespace-nowrap">GSTIN</th>
                <th class="py-2 px-3 whitespace-nowrap">Contact</th>
                <th class="py-2 px-3 whitespace-nowrap">State</th>
                <th class="py-2 px-3 min-w-[200px]">Address</th>
                <th class="py-2 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="p in parties"
                :key="p.id"
                class="hover:bg-indigo-50/30 transition-colors"
              >
                <!-- Party Name -->
                <td class="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                  {{ p.name }}
                </td>

                <!-- Role Badge -->
                <td class="py-2 px-3 whitespace-nowrap">
                  <span
                    :class="p.partyType === 'CUSTOMER' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-amber-100 text-amber-800 border-amber-200'"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border"
                  >
                    {{ p.partyType }}
                  </span>
                </td>

                <!-- GSTIN -->
                <td class="py-2 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                  {{ p.gstin || 'UNREGISTERED' }}
                </td>

                <!-- Contact -->
                <td class="py-2 px-3 whitespace-nowrap text-slate-600">
                  {{ p.contact || '-' }}
                </td>

                <!-- State -->
                <td class="py-2 px-3 whitespace-nowrap text-slate-700">
                  {{ p.state }} <span class="text-[10px] text-slate-400 font-mono">({{ p.stateCode }})</span>
                </td>

                <!-- Address -->
                <td class="py-2 px-3 text-slate-600 text-[11px]">
                  {{ p.address || '-' }}
                </td>

                <!-- Actions -->
                <td class="py-2 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    @click="$emit('delete-party', p)"
                    title="Delete Party"
                    class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-if="!loading && (!parties || parties.length === 0)">
                <td colspan="7" class="py-8 text-center text-slate-400 bg-white">
                  No parties registered yet. Press <kbd class="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-700">Insert</kbd> to add your first party.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Add Party Modal -->
        <div v-if="showModal" class="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-2xs" style="z-index: 60;" @click.self="showModal = false">
          <div class="party-modal-container relative bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 shadow-2xl text-slate-800">
            <div class="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                <h3 class="text-sm font-black text-slate-900 uppercase">Add Customer or Supplier (Insert)</h3>
              </div>
              <button @click="showModal = false" class="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer" title="Close (ESC)">&times;</button>
            </div>

            <form @submit.prevent="handleSave" class="party-modal-form space-y-3 text-xs" @keydown.enter="onFormEnter($event)" @keydown.backspace="onFormBackspace($event)">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Party / Business Name *</label>
                <input ref="partyNameInput" id="party-name-input" type="text" v-model="form.name" required placeholder="Party / Company Name" class="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100" />
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Role Type</label>
                  <select v-model="form.partyType" class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold outline-none focus:border-indigo-500">
                    <option value="CUSTOMER">Customer (Client)</option>
                    <option value="SUPPLIER">Supplier (Vendor)</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">GSTIN</label>
                  <input type="text" v-model="form.gstin" placeholder="27AABCA1234F1Z1" class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono uppercase outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input type="text" v-model="form.contact" placeholder="+91 98000 00000" class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">State Code</label>
                  <input type="text" v-model="form.stateCode" placeholder="27" class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Address</label>
                <textarea v-model="form.address" rows="2" placeholder="Full address" class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-500"></textarea>
              </div>

              <div class="flex items-center justify-between pt-3 border-t border-slate-200">
                <span class="text-[10px] text-slate-400 font-bold hidden sm:inline">ENTER: Next • F8/Ctrl+S: Save • ESC: Cancel</span>
                <div class="flex items-center space-x-2">
                  <button type="button" @click="showModal = false" class="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-bold cursor-pointer">Cancel (ESC)</button>
                  <button type="submit" class="px-4 py-1.5 rounded-lg font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm cursor-pointer">Save Party (F8)</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    `
  };

  global.PartyManagerComponent = PartyManagerComponent;
})(window);
