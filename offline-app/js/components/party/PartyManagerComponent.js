// components/PartyManagerComponent.js
(function (global) {
  'use strict';

  const PartyManagerComponent = {
    components: {
      PartyModalComponent: global.PartyModalComponent
    },
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
        partyToEdit: null,
        selectedPartyIndex: -1
      };
    },
    computed: {
      filteredParties() {
        let list = this.parties || [];
        const filter = (this.typeFilter || 'ALL').toUpperCase();

        if (filter !== 'ALL') {
          list = list.filter(p => {
            const t = (p.partyType || p.type || p.account_type || '').toUpperCase();
            if (filter === 'CUSTOMER') return t === 'CUSTOMER' || t === 'SUNDRY_DEBTORS' || t === 'BOTH';
            if (filter === 'SUPPLIER') return t === 'SUPPLIER' || t === 'SUNDRY_CREDITORS' || t === 'BOTH';
            if (filter === 'TRANSPORTER') return t === 'TRANSPORTER';
            if (filter === 'LABOR') return t === 'CASUAL_LABOR' || t === 'LABOR_LEADER';
            if (filter === 'STAFF') return t === 'STAFF';
            return t === filter;
          });
        }

        const q = (this.searchQuery || '').trim().toLowerCase();
        if (q) {
          list = list.filter(p => {
            const name = (p.name || p.account_name || '').toLowerCase();
            const gstin = (p.gstin || '').toLowerCase();
            const contact = (p.contact || p.phone || '').toLowerCase();
            const pan = (p.pan || '').toLowerCase();
            const city = (p.state || '').toLowerCase();
            return name.includes(q) || gstin.includes(q) || contact.includes(q) || pan.includes(q) || city.includes(q);
          });
        }
        return list;
      }
    },
    watch: {
      showModal(isOpen) {
        if (!isOpen) {
          this.$nextTick(() => {
            const btn = this.$el.querySelector('.add-party-btn') || this.$refs.searchInput;
            if (btn && typeof btn.focus === 'function') btn.focus();
          });
        }
      },
      filteredParties() {
        if (this.selectedPartyIndex >= this.filteredParties.length) {
          this.selectedPartyIndex = Math.max(0, this.filteredParties.length - 1);
        }
      }
    },
    mounted() {
      window.addEventListener('keydown', this.handleKeydown);
    },
    beforeUnmount() {
      window.removeEventListener('keydown', this.handleKeydown);
    },
    methods: {
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      openAddModal() {
        this.partyToEdit = null;
        this.showModal = true;
      },
      openEditModal(party) {
        this.partyToEdit = party;
        this.showModal = true;
      },
      closeModal() {
        this.showModal = false;
        this.partyToEdit = null;
      },
      handleSaveParty(payload) {
        this.$emit('add-party', payload);
        this.closeModal();
      },
      handleKeydown(e) {
        // If modal is active, let PartyModalComponent handle shortcuts
        if (this.showModal) return;

        // Open Add Modal
        if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
          e.preventDefault();
          this.openAddModal();
          return;
        }

        // Focus Search bar
        if (e.key === 'F2' || (e.key === '/' && document.activeElement && document.activeElement.tagName !== 'INPUT')) {
          e.preventDefault();
          const searchInput = this.$refs.searchInput;
          if (searchInput) {
            searchInput.focus();
            if (searchInput.select) searchInput.select();
          }
          return;
        }

        // Table Keyboard Navigation
        const len = this.filteredParties.length;
        if (len === 0) return;

        if (e.key === 'ArrowDown') {
          if (document.activeElement && document.activeElement === this.$refs.searchInput) {
            e.preventDefault();
            this.selectedPartyIndex = 0;
            this.focusRow(0);
            return;
          }
          if (this.selectedPartyIndex < len - 1) {
            e.preventDefault();
            this.selectedPartyIndex++;
            this.focusRow(this.selectedPartyIndex);
          }
        } else if (e.key === 'ArrowUp') {
          if (this.selectedPartyIndex > 0) {
            e.preventDefault();
            this.selectedPartyIndex--;
            this.focusRow(this.selectedPartyIndex);
          } else if (this.selectedPartyIndex === 0) {
            e.preventDefault();
            this.selectedPartyIndex = -1;
            if (this.$refs.searchInput) this.$refs.searchInput.focus();
          }
        } else if (e.key === 'Enter') {
          if (this.selectedPartyIndex >= 0 && this.selectedPartyIndex < len && document.activeElement !== this.$refs.searchInput) {
            e.preventDefault();
            this.openEditModal(this.filteredParties[this.selectedPartyIndex]);
          }
        } else if (e.key.toLowerCase() === 'e' && e.altKey) {
          if (this.selectedPartyIndex >= 0 && this.selectedPartyIndex < len) {
            e.preventDefault();
            this.openEditModal(this.filteredParties[this.selectedPartyIndex]);
          }
        } else if (e.key === 'Delete') {
          if (this.selectedPartyIndex >= 0 && this.selectedPartyIndex < len && document.activeElement !== this.$refs.searchInput) {
            e.preventDefault();
            const party = this.filteredParties[this.selectedPartyIndex];
            if (confirm(`Are you sure you want to delete master party "${party.name}"?`)) {
              this.$emit('delete-party', party);
            }
          }
        }
      },
      focusRow(idx) {
        this.$nextTick(() => {
          const row = this.$el.querySelector(`tbody tr[data-index="${idx}"]`);
          if (row) {
            row.scrollIntoView({ block: 'nearest' });
          }
        });
      },
      getRoleBadge(party) {
        const t = (party.partyType || party.type || party.account_type || 'CUSTOMER').toUpperCase();
        switch (t) {
          case 'CUSTOMER':
          case 'SUNDRY_DEBTORS':
            return { label: 'Customer', class: 'bg-blue-50 text-blue-700 border-blue-200' };
          case 'SUPPLIER':
          case 'SUNDRY_CREDITORS':
            return { label: 'Supplier', class: 'bg-amber-50 text-amber-700 border-amber-200' };
          case 'TRANSPORTER':
            return { label: 'Transporter', class: 'bg-purple-50 text-purple-700 border-purple-200' };
          case 'CASUAL_LABOR':
            return { label: 'Casual Labour', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
          case 'LABOR_LEADER':
            return { label: 'Labor Leader', class: 'bg-teal-50 text-teal-700 border-teal-200' };
          case 'STAFF':
            return { label: 'Staff / Payroll', class: 'bg-sky-50 text-sky-700 border-sky-200' };
          case 'LOANS_BORROWINGS':
          case 'LOANS_ADVANCES':
            return { label: 'Loan A/c', class: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
          case 'CAPITAL':
            return { label: 'Capital & Equity', class: 'bg-violet-50 text-violet-700 border-violet-200' };
          case 'BANK':
            return { label: 'Bank A/c', class: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
          case 'CASH':
            return { label: 'Cash Drawer', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
          default:
            return { label: t, class: 'bg-slate-50 text-slate-700 border-slate-200' };
        }
      },
      getLocationCount(party) {
        if (Array.isArray(party.gstLocations) && party.gstLocations.length > 1) {
          return party.gstLocations.length;
        }
        if (typeof party.gstLocations === 'string' && party.gstLocations.startsWith('[')) {
          try {
            const arr = JSON.parse(party.gstLocations);
            if (Array.isArray(arr) && arr.length > 1) return arr.length;
          } catch (_) {}
        }
        return 0;
      },
      exportExcel() {
        if (global.ExcelExportService) {
          global.ExcelExportService.exportParties(this.filteredParties);
        }
      }
    },
    template: `
      <div class="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden w-full flex flex-col">
        <!-- Control Header -->
        <div class="p-3 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
          <div class="flex items-center space-x-2 flex-1">
            <div class="relative flex-1 max-w-sm">
              <svg class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref="searchInput"
                type="text"
                :value="searchQuery"
                @input="$emit('update:searchQuery', $event.target.value)"
                @keydown.esc.prevent="$event.target.blur()"
                @keydown.enter.prevent="$event.target.blur(); if (filteredParties.length > 0) openEditModal(filteredParties[selectedPartyIndex >= 0 ? selectedPartyIndex : 0])"
                placeholder="Search party name, GSTIN, PAN, phone... (/ to focus • ESC to blur)"
                class="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-2xs font-medium"
              />
            </div>

            <select
              :value="typeFilter"
              @change="$emit('update:typeFilter', $event.target.value)"
              class="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-2xs cursor-pointer font-bold"
            >
              <option value="ALL">All Categories</option>
              <option value="CUSTOMER">Customers (Debtors)</option>
              <option value="SUPPLIER">Suppliers (Creditors)</option>
              <option value="TRANSPORTER">Transporters</option>
              <option value="LABOR">Labor & Workers</option>
              <option value="STAFF">Staff & Payroll</option>
            </select>
          </div>

          <!-- Add Party & Export Buttons -->
          <div class="flex items-center space-x-2">
            <span class="text-[11px] font-mono font-medium text-slate-400 hidden lg:inline">
              Total: <strong class="text-slate-800">{{ filteredParties.length }}</strong> accounts
            </span>
            <!-- Export Excel -->
            <button
              type="button"
              @click="exportExcel"
              title="Export Filtered Parties to Excel Worksheet (ExcelJS)"
              class="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs shrink-0"
            >
              <svg class="w-3.5 h-3.5 mr-1 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              @click="openAddModal"
              class="add-party-btn inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
              title="Create New Party / Account Head (Insert / Ctrl+N)"
            >
              <svg class="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Add Party (Insert)</span>
            </button>
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto w-full">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-100/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th class="py-2.5 px-3">Party / Account Name</th>
                <th class="py-2.5 px-3 whitespace-nowrap">Entity Category</th>
                <th class="py-2.5 px-3 whitespace-nowrap">GSTIN & PAN</th>
                <th class="py-2.5 px-3 whitespace-nowrap">Contact</th>
                <th class="py-2.5 px-3 whitespace-nowrap">State & Region</th>
                <th class="py-2.5 px-3 min-w-[180px]">Address</th>
                <th class="py-2.5 px-3 text-right whitespace-nowrap">Balance</th>
                <th class="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="(p, idx) in filteredParties"
                :key="p.id || idx"
                :data-index="idx"
                @click="selectedPartyIndex = idx"
                @dblclick="openEditModal(p)"
                :class="selectedPartyIndex === idx ? 'bg-emerald-50/60 ring-1 ring-inset ring-emerald-500/30' : 'hover:bg-slate-50/80'"
                class="transition-colors cursor-pointer select-none"
              >
                <!-- Party Name -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-900">{{ p.name }}</span>
                    <span v-if="getLocationCount(p) > 1" class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200" title="Multi-location registered">
                      {{ getLocationCount(p) }} Locations
                    </span>
                    <span v-if="p.bankName || p.accountNumber" class="text-slate-400" title="Bank Details Configured">
                      🏦
                    </span>
                  </div>
                </td>

                <!-- Role Badge -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                  <span
                    :class="getRoleBadge(p).class"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border"
                  >
                    {{ getRoleBadge(p).label }}
                  </span>
                </td>

                <!-- GSTIN & PAN -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                  <div class="flex flex-col gap-0.5">
                    <span v-if="p.gstin && p.gstin !== 'UNREGISTERED'" class="font-mono text-[11px] font-semibold text-emerald-700">
                      {{ p.gstin }}
                    </span>
                    <span v-else class="text-[10px] text-slate-400 font-medium">
                      Unregistered
                    </span>
                    <span v-if="p.pan" class="font-mono text-[10px] text-slate-500">
                      PAN: {{ p.pan }}
                    </span>
                  </div>
                </td>

                <!-- Contact -->
                <td class="py-2.5 px-3 whitespace-nowrap text-slate-700">
                  <span v-if="p.contact || p.phone" class="font-mono text-[11px]">
                    {{ p.contact || p.phone }}
                  </span>
                  <span v-else class="text-slate-400">-</span>
                </td>

                <!-- State -->
                <td class="py-2.5 px-3 whitespace-nowrap text-slate-700">
                  <span>{{ p.state || 'Maharashtra' }}</span>
                  <span class="text-[10px] text-slate-400 font-mono ml-1">({{ p.stateCode || '27' }})</span>
                </td>

                <!-- Address -->
                <td class="py-2.5 px-3 text-slate-600 text-[11px] max-w-[240px] truncate" :title="p.address">
                  {{ p.address || '-' }}
                </td>

                <!-- Balance -->
                <td class="py-2.5 px-3 text-right whitespace-nowrap font-mono text-[11px] font-bold">
                  <span :class="(p.balanceType || 'CR') === 'DR' ? 'text-blue-700' : 'text-slate-900'">
                    {{ formatCurrency(p.currentBalance !== undefined ? p.currentBalance : p.openingBalance) }}
                  </span>
                  <span
                    :class="(p.balanceType || 'CR') === 'DR' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'"
                    class="ml-1 text-[9px] px-1 py-0.2 rounded font-bold"
                  >
                    {{ p.balanceType || 'CR' }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="py-2.5 px-3 text-right whitespace-nowrap" @click.stop>
                  <div class="inline-flex items-center space-x-1">
                    <!-- Edit Button -->
                    <button
                      type="button"
                      @click="openEditModal(p)"
                      title="Edit Master Party (Enter / Alt+E)"
                      class="p-1 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    <!-- Delete Button -->
                    <button
                      type="button"
                      @click="$emit('delete-party', p)"
                      title="Delete Party (Del)"
                      class="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-if="!loading && (!filteredParties || filteredParties.length === 0)">
                <td colspan="8" class="py-12 text-center text-slate-400 bg-white">
                  <div class="flex flex-col items-center justify-center space-y-2">
                    <svg class="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p class="font-medium text-xs">No matching party accounts found</p>
                    <p class="text-[11px] text-slate-400">
                      Press <kbd class="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-700">Insert</kbd> to create a master account head.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer / Shortcuts Helper -->
        <div class="p-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <div class="flex items-center space-x-3">
            <span><kbd class="px-1 py-0.2 bg-white border border-slate-300 rounded font-mono text-slate-700">Insert</kbd> Add Party</span>
            <span><kbd class="px-1 py-0.2 bg-white border border-slate-300 rounded font-mono text-slate-700">Enter / Alt+E</kbd> Edit</span>
            <span><kbd class="px-1 py-0.2 bg-white border border-slate-300 rounded font-mono text-slate-700">Del</kbd> Delete</span>
            <span><kbd class="px-1 py-0.2 bg-white border border-slate-300 rounded font-mono text-slate-700">F2 / /</kbd> Search</span>
          </div>
          <span class="text-slate-400">Master Chart of Accounts • Nuxt 4 Unified Architecture</span>
        </div>

        <!-- Master Party Modal (Faithful Nuxt 4 Replica) -->
        <party-modal-component
          :show="showModal"
          :party-to-edit="partyToEdit"
          :initial-name="partyToEdit ? '' : searchQuery"
          :default-type="typeFilter === 'SUPPLIER' ? 'SUNDRY_CREDITORS' : 'SUNDRY_DEBTORS'"
          @close="closeModal"
          @save="handleSaveParty"
        ></party-modal-component>
      </div>
    `
  };

  global.PartyManagerComponent = PartyManagerComponent;
})(window);
