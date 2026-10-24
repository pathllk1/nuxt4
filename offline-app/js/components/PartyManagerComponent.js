// components/PartyManagerComponent.js
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
    methods: {
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '₹' + Number(val).toFixed(2);
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
                type="text"
                :value="searchQuery"
                @input="$emit('update:searchQuery', $event.target.value)"
                placeholder="Search party name, GSTIN, phone..."
                class="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
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
            @click="showModal = true"
            class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs shadow-indigo-500/20 transition-all cursor-pointer shrink-0"
          >
            <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Add Party</span>
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
                  No parties registered yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Add Party Modal -->
        <div v-if="showModal" class="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs" style="z-index: 60;" @click.self="showModal = false" @keydown.esc="showModal = false">
          <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-md p-4 shadow-xl text-slate-800">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
              <h3 class="text-sm font-bold text-slate-900">Add Customer or Supplier</h3>
              <button @click="showModal = false" class="text-slate-400 hover:text-slate-700">&times;</button>
            </div>

            <form @submit.prevent="handleSave" class="space-y-2.5 text-xs">
              <div>
                <label class="block font-bold text-slate-700 mb-0.5">Party / Business Name *</label>
                <input type="text" v-model="form.name" required placeholder="Party / Company Name" class="w-full bg-white border border-slate-300 rounded px-2.5 py-1" />
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block font-bold text-slate-700 mb-0.5">Role Type</label>
                  <select v-model="form.partyType" class="w-full bg-white border border-slate-300 rounded px-2 py-1 font-semibold">
                    <option value="CUSTOMER">Customer (Client)</option>
                    <option value="SUPPLIER">Supplier (Vendor)</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-0.5">GSTIN</label>
                  <input type="text" v-model="form.gstin" placeholder="27AABCA1234F1Z1" class="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono uppercase" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block font-bold text-slate-700 mb-0.5">Contact Phone</label>
                  <input type="text" v-model="form.contact" placeholder="+91 98000 00000" class="w-full bg-white border border-slate-300 rounded px-2 py-1" />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-0.5">State Code</label>
                  <input type="text" v-model="form.stateCode" placeholder="27" class="w-full bg-white border border-slate-300 rounded px-2 py-1 font-mono" />
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-0.5">Address</label>
                <textarea v-model="form.address" rows="2" placeholder="Full address" class="w-full bg-white border border-slate-300 rounded px-2 py-1"></textarea>
              </div>

              <div class="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                <button type="button" @click="showModal = false" class="px-3 py-1 rounded text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" class="px-3 py-1 rounded font-bold text-white bg-indigo-600 hover:bg-indigo-700">Save Party</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `
  };

  global.PartyManagerComponent = PartyManagerComponent;
})(window);
