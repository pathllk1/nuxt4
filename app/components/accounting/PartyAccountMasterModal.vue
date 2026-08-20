<template>
  <div 
    v-if="modelValue" 
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    @keydown="handleGlobalModalKeydown"
  >
    <div 
      ref="modalContainerRef" 
      role="dialog"
      aria-modal="true"
      aria-labelledby="master-modal-title"
      class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-scale-in flex flex-col"
    >
      <!-- Header -->
      <header class="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-6 py-4 text-white flex justify-between items-center shrink-0">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-white/20">
              {{ isEditing ? 'Edit Master Record' : 'Universal Master Registration' }}
            </span>
            <span class="text-xs opacity-80 font-mono" v-if="form._id">ID: {{ form._id.slice(-6) }}</span>
          </div>
          <h2 id="master-modal-title" class="text-lg font-black uppercase tracking-tight mt-0.5">
            {{ isEditing ? `Edit: ${form.account_name || 'Account Head'}` : (modalTitleByType) }}
          </h2>
          <p class="text-[10px] font-bold opacity-80 uppercase tracking-wider mt-0.5">
            Enter: Next Field • Insert: Add Location • F8: Save Master • ESC: Close
          </p>
        </div>
        <button 
          @click="closeModal" 
          type="button" 
          aria-label="Close dialog"
          class="w-8 h-8 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </header>

      <!-- Scrollable Form Body -->
      <div class="overflow-y-auto p-5 flex-1 custom-scrollbar space-y-4">
        <form @submit.prevent="saveMasterRecord" id="master-party-form" class="space-y-4">
          
          <!-- Classification Selector (Adaptive Switch) -->
          <div class="p-3 bg-slate-50 dark:bg-zinc-800/70 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-1.5">
            <label class="block text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Account Classification / Entity Type *
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                v-for="opt in typeOptions"
                :key="opt.value"
                type="button"
                @click="setType(opt.value)"
                class="px-2.5 py-2 rounded-xl text-left border text-xs font-black transition-all flex items-center gap-2 cursor-pointer"
                :class="form.account_type === opt.value
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-300'"
              >
                <span class="text-sm shrink-0">{{ opt.icon }}</span>
                <span class="truncate">{{ opt.label }}</span>
              </button>
            </div>
          </div>

          <!-- Section 1: Basic Identity Information -->
          <div class="p-4 bg-slate-50/70 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <UIcon name="i-heroicons-identification" class="w-4 h-4 text-emerald-600" />
              <span>1. Basic Identity & Credentials</span>
            </h3>

            <div class="flex flex-wrap gap-3">
              <!-- Name -->
              <div class="flex-[2] min-w-[240px] space-y-1">
                <label class="block text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  {{ isLaborLeader ? 'Leader / Contractor Name *' : (isParty ? 'Party / Firm Trade Name *' : 'Account Head Name *') }}
                </label>
                <input
                  type="text"
                  v-model="form.account_name"
                  required
                  placeholder="e.g. Ramesh Kumar / Acme Corp India"
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none font-bold text-xs text-slate-900 dark:text-white first-input"
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <!-- Contact / Phone (For Party & Labor) -->
              <div class="flex-1 min-w-[160px] space-y-1" v-if="requiresContact">
                <label class="block text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Contact Phone</label>
                <input
                  type="text"
                  v-model="form.phone"
                  placeholder="10-digit Mobile"
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none font-bold text-xs text-slate-900 dark:text-white"
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <!-- PAN Number (For Party & Labor) -->
              <div class="flex-1 min-w-[160px] space-y-1" v-if="requiresPan">
                <label class="block text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">PAN Number</label>
                <input
                  type="text"
                  v-model="form.pan"
                  maxlength="10"
                  placeholder="ABCDE1234F"
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none font-mono font-bold uppercase text-xs text-slate-900 dark:text-white"
                  @input="form.pan = form.pan.toUpperCase()"
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <!-- Aadhaar Number (Strictly for Labor Leader) -->
              <div class="flex-1 min-w-[160px] space-y-1" v-if="requiresAadhaar">
                <label class="block text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Aadhaar Number (12 Digits)</label>
                <input
                  type="text"
                  v-model="form.aadhaar_number"
                  maxlength="12"
                  placeholder="123456789012"
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none font-mono font-bold text-xs text-slate-900 dark:text-white"
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>
            </div>
          </div>

          <!-- Section 2: Multi-Location GST Registrations (Visible ONLY for Customer / Supplier) -->
          <div v-if="requiresGstSection" class="p-4 bg-slate-50/70 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <UIcon name="i-heroicons-building-office-2" class="w-4 h-4 text-emerald-600" />
                <span>2. GST Registrations & Warehouse Locations</span>
              </h3>
              <button 
                type="button" 
                @click="addGstLocation" 
                class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest hover:underline flex items-center gap-1 cursor-pointer"
              >
                <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
                <span>Add Location (Insert)</span>
              </button>
            </div>

            <div class="space-y-3">
              <div 
                v-for="(loc, index) in form.gstLocations" 
                :key="loc._uid" 
                class="bg-white dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700 p-3 relative transition-all shadow-sm"
                :class="{ 'ring-2 ring-emerald-500': loc.isPrimary }"
              >
                <div class="absolute top-2.5 right-2.5 flex items-center gap-2">
                  <label class="flex items-center gap-1 cursor-pointer select-none">
                    <input 
                      type="radio" 
                      name="primaryGstLocation" 
                      :checked="loc.isPrimary" 
                      @change="setPrimaryGstLocation(index)" 
                      class="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500" 
                    />
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Primary</span>
                  </label>
                  <button 
                    v-if="form.gstLocations.length > 1" 
                    type="button" 
                    @click="removeGstLocation(index)" 
                    class="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                    title="Remove Location"
                  >
                    <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <!-- GSTIN + 1-Click Fetch Button -->
                  <div class="sm:col-span-4 space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>GSTIN</span>
                      <span v-if="loc.fetchStatus === 'success'" class="text-[8px] text-emerald-600 font-black">Verified</span>
                      <span v-if="loc.fetchStatus === 'failed'" class="text-[8px] text-rose-600 font-black">Not Found</span>
                    </label>
                    <div class="flex gap-1">
                      <input
                        type="text"
                        v-model="loc.gstin"
                        maxlength="15"
                        placeholder="27ABCDE1234F1Z5"
                        class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs uppercase text-slate-900 dark:text-white outline-none"
                        @input="loc.gstin = loc.gstin.toUpperCase()"
                        @blur="onGstinBlur(index)"
                        @keydown.enter.prevent="onGstinEnter($event, index)"
                      />
                      <button
                        type="button"
                        @click="fetchGstForLocation(index)"
                        :disabled="fetchingGstIndices.has(index) || !loc.gstin || loc.gstin.length < 15"
                        class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded-lg text-[10px] font-black uppercase disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        <UIcon v-if="fetchingGstIndices.has(index)" name="i-heroicons-arrow-path" class="w-3.5 h-3.5 animate-spin" />
                        <span v-else>Fetch</span>
                      </button>
                    </div>
                  </div>

                  <!-- State -->
                  <div class="sm:col-span-5 space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider">State</label>
                    <input
                      type="text"
                      v-model="loc.state"
                      placeholder="State Name"
                      class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none"
                      @keydown.enter.prevent="onInputEnter($event)"
                    />
                  </div>

                  <!-- Pincode -->
                  <div class="sm:col-span-3 space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Pincode</label>
                    <input
                      type="text"
                      v-model="loc.pincode"
                      maxlength="6"
                      placeholder="6-digit PIN"
                      class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs text-slate-900 dark:text-white outline-none"
                      @keydown.enter.prevent="onInputEnter($event)"
                    />
                  </div>

                  <!-- Address -->
                  <div class="sm:col-span-12 space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Full Address / Street</label>
                    <input
                      type="text"
                      v-model="loc.address"
                      placeholder="Street address, building, premises..."
                      class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none"
                      @keydown.enter.prevent="onInputEnter($event)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: Corporate Banking & CMS Details (For Labor, Supplier & Bank) -->
          <div v-if="requiresBankSection" class="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                <UIcon name="i-heroicons-building-library" class="w-4 h-4 text-blue-600" />
                <span>3. Corporate Banking & CMS Payout Details</span>
              </h3>
              <span v-if="ifscVerified" class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                <UIcon name="i-heroicons-check-badge" class="w-3.5 h-3.5" />
                <span>IFSC Verified</span>
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <!-- IFSC Code + 1-Click Fetch Button -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">IFSC Code</label>
                <div class="flex gap-1">
                  <input
                    type="text"
                    v-model="form.ifsc_code"
                    maxlength="11"
                    placeholder="SBIN0001171"
                    class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-mono font-bold uppercase text-xs text-slate-900 dark:text-white outline-none"
                    @blur="onIfscBlur"
                    @input="onIfscInput"
                    @keydown.enter.prevent="onIfscEnter($event)"
                  />
                  <button
                    type="button"
                    @click="fetchIfscDetails"
                    :disabled="isFetchingIfsc || !form.ifsc_code || form.ifsc_code.length < 11"
                    class="px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 rounded-lg text-[10px] font-black uppercase disabled:opacity-40 cursor-pointer shrink-0"
                    title="Fetch Bank & Branch details"
                  >
                    <UIcon v-if="isFetchingIfsc" name="i-heroicons-arrow-path" class="w-3.5 h-3.5 animate-spin" />
                    <span v-else>Fetch</span>
                  </button>
                </div>
              </div>

              <!-- Bank Name -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Bank Name</label>
                <input
                  type="text"
                  v-model="form.bank_name"
                  placeholder="e.g. State Bank of India"
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none"
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <!-- Branch Name -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Branch / City</label>
                <input
                  type="text"
                  v-model="form.branch_name"
                  placeholder="e.g. Rangiya"
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none"
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <!-- Account Number -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Account Number</label>
                <input
                  type="text"
                  v-model="form.account_number"
                  placeholder="A/C Number"
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs text-slate-900 dark:text-white outline-none"
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <!-- Bank-Specific Fields: Type & Status (Visible only when BANK classification) -->
              <div v-if="isBank" class="sm:col-span-6 space-y-1">
                <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Account Type</label>
                <select
                  v-model="form.bank_account_type"
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none"
                >
                  <option value="CURRENT">Current Account</option>
                  <option value="SAVINGS">Savings Account</option>
                  <option value="OD">Overdraft (OD)</option>
                  <option value="CC">Cash Credit (CC)</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div v-if="isBank" class="sm:col-span-6 space-y-1">
                <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Status</label>
                <select
                  v-model="form.status"
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div v-if="isBank" class="sm:col-span-12 mt-1">
                <label class="flex items-center gap-3 p-3 rounded-xl bg-blue-100/60 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/60 cursor-pointer group transition-all">
                  <input
                    type="checkbox"
                    v-model="form.is_default"
                    class="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <p class="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-tight">Set as Primary Treasury Account</p>
                    <p class="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase mt-0.5">Used by default for company payouts, transfers and receipts</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Section 4: HSN/SAC & Tax Rates (For Expense / Income / Taxes) -->
          <div v-if="requiresTaxHsnSection" class="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 space-y-3">
            <h3 class="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
              <UIcon name="i-heroicons-calculator" class="w-4 h-4 text-amber-600" />
              <span>4. Statutory Tax Rates & HSN/SAC Mapping</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div class="sm:col-span-4 space-y-1">
                <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">HSN / SAC Code</label>
                <input
                  type="text"
                  v-model="form.hsn_sac"
                  placeholder="e.g. 996511"
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs text-slate-900 dark:text-white outline-none"
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <div class="sm:col-span-4 space-y-1">
                <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Default GST Rate (%)</label>
                <select
                  v-model.number="form.gst_rate"
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none"
                >
                  <option :value="null">-- No Default Tax Rate --</option>
                  <option :value="0">0% (Nil / Exempt)</option>
                  <option :value="5">5% (Essential Goods/Services)</option>
                  <option :value="12">12% (Standard)</option>
                  <option :value="18">18% (Standard Services)</option>
                  <option :value="28">28% (Luxury / Sin)</option>
                </select>
              </div>

              <div class="sm:col-span-4 space-y-1">
                <label class="text-[9px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Description / Remarks</label>
                <input
                  type="text"
                  v-model="form.description"
                  placeholder="Ledger purpose"
                  class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs text-slate-900 dark:text-white outline-none"
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>
            </div>
          </div>

          <!-- Section 5: Opening Balance (Ledgers) -->
          <div class="p-3 bg-slate-50/70 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-scale" class="w-4 h-4 text-slate-500" />
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">Financial Opening Balance:</span>
            </div>

            <div class="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                v-model.number="form.opening_balance"
                placeholder="0.00"
                class="w-32 px-2.5 py-1 text-right bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-mono font-bold text-xs text-slate-900 dark:text-white outline-none"
                @keydown.enter.prevent="onInputEnter($event)"
              />
              <select
                v-model="form.balance_type"
                class="px-2 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-bold text-xs text-slate-900 dark:text-white outline-none"
                @keydown.enter.prevent="onInputEnter($event)"
              >
                <option value="DR">Debit (DR)</option>
                <option value="CR">Credit (CR)</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      <!-- Modal Footer -->
      <footer class="px-6 py-3 bg-slate-100 dark:bg-zinc-800/70 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
        <button
          type="button"
          @click="closeModal"
          class="px-4 py-2 rounded-xl text-xs font-black text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Discard (ESC)
        </button>

        <button
          type="button"
          @click="saveMasterRecord"
          :disabled="isSaving || !form.account_name.trim()"
          class="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-black text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <UIcon v-if="isSaving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
          <UIcon v-else name="i-heroicons-check" class="w-4 h-4" />
          <span>{{ isEditing ? 'Update Master (F8)' : 'Register Master (F8)' }}</span>
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useApi } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  accountId?: string | null;
  initialData?: any;
  defaultType?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved', account: any): void;
}>();

const api = useApi();
const toast = useToast();

let uidCounter = 0;
function nextUid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `loc_${Date.now()}_${uidCounter++}`;
}

const modalContainerRef = ref<HTMLElement | null>(null);
const isSaving = ref(false);
const fetchingGstIndices = ref<Set<number>>(new Set());
const isFetchingIfsc = ref(false);
const ifscVerified = ref(false);

const typeOptions = [
  { value: 'SUNDRY_DEBTORS', label: 'Customer', icon: '🏢' },
  { value: 'SUNDRY_CREDITORS', label: 'Supplier / Vendor', icon: '🏭' },
  { value: 'LABOR_LEADER', label: 'Labor Leader', icon: '👷' },
  { value: 'EXPENSE', label: 'Expense Head', icon: '🧾' },
  { value: 'INCOME', label: 'Income Head', icon: '📈' },
  { value: 'BANK', label: 'Bank Account', icon: '🏦' },
  { value: 'DUTIES_AND_TAXES', label: 'Duties & Taxes', icon: '⚖️' },
  { value: 'FIXED_ASSETS', label: 'Fixed Assets', icon: '🏗️' }
];

const form = ref({
  _id: '',
  account_name: '',
  account_type: 'SUNDRY_DEBTORS',
  phone: '',
  pan: '',
  aadhaar_number: '',
  bank_name: '',
  branch_name: '',
  account_number: '',
  ifsc_code: '',
  bank_account_type: 'CURRENT',
  is_default: false,
  status: 'ACTIVE',
  hsn_sac: '',
  gst_rate: null as number | null,
  description: '',
  opening_balance: 0,
  balance_type: 'DR',
  gstLocations: [
    { _uid: nextUid(), gstin: '', state: '', stateCode: '', address: '', pincode: '', contact: '', isPrimary: true, fetchStatus: 'none' }
  ]
});

const isEditing = computed(() => !!form.value._id);

const isLaborLeader = computed(() => form.value.account_type === 'LABOR_LEADER');
const isParty = computed(() => ['SUNDRY_DEBTORS', 'SUNDRY_CREDITORS', 'BOTH'].includes(form.value.account_type));
const isBank = computed(() => form.value.account_type === 'BANK');
const isTaxOrExpense = computed(() => ['EXPENSE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'INCOME', 'DIRECT_INCOME', 'DUTIES_AND_TAXES'].includes(form.value.account_type));

const requiresContact = computed(() => isParty.value || isLaborLeader.value);
const requiresPan = computed(() => isParty.value || isLaborLeader.value);
const requiresAadhaar = computed(() => isLaborLeader.value);
const requiresGstSection = computed(() => isParty.value && !isLaborLeader.value);
const requiresBankSection = computed(() => isLaborLeader.value || form.value.account_type === 'SUNDRY_CREDITORS' || isBank.value);
const requiresTaxHsnSection = computed(() => isTaxOrExpense.value);

const modalTitleByType = computed(() => {
  if (isLaborLeader.value) return 'Register Labor Leader / Contractor';
  if (form.value.account_type === 'SUNDRY_DEBTORS') return 'Register Customer Master';
  if (form.value.account_type === 'SUNDRY_CREDITORS') return 'Register Supplier / Vendor Master';
  if (isBank.value) return 'Register Bank Account';
  if (isTaxOrExpense.value) return 'Register Expense / Tax Head';
  return 'Create Account Head';
});

function setType(val: string) {
  form.value.account_type = val;

  // Clear fields tied to sections that just became hidden, so switching
  // classification doesn't silently carry stale data into the save payload.
  const willShowAadhaar = val === 'LABOR_LEADER';
  const willShowGst = ['SUNDRY_DEBTORS', 'SUNDRY_CREDITORS'].includes(val) && val !== 'LABOR_LEADER';
  const willShowBank = val === 'LABOR_LEADER' || val === 'SUNDRY_CREDITORS' || val === 'BANK';
  const willShowTaxHsn = ['EXPENSE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'INCOME', 'DIRECT_INCOME', 'DUTIES_AND_TAXES'].includes(val);

  if (!willShowAadhaar) form.value.aadhaar_number = '';
  if (!willShowGst) {
    form.value.gstLocations = [
      { _uid: nextUid(), gstin: '', state: '', stateCode: '', address: '', pincode: '', contact: '', isPrimary: true, fetchStatus: 'none' }
    ];
  }
  if (!willShowBank) {
    form.value.bank_name = '';
    form.value.branch_name = '';
    form.value.account_number = '';
    form.value.ifsc_code = '';
    form.value.is_default = false;
    ifscVerified.value = false;
  }
  if (!willShowTaxHsn) {
    form.value.hsn_sac = '';
    form.value.gst_rate = null;
  }
}

function resetForm() {
  form.value = {
    _id: '',
    account_name: '',
    account_type: props.defaultType || 'SUNDRY_DEBTORS',
    phone: '',
    pan: '',
    aadhaar_number: '',
    bank_name: '',
    branch_name: '',
    account_number: '',
    ifsc_code: '',
    bank_account_type: 'CURRENT',
    is_default: false,
    status: 'ACTIVE',
    hsn_sac: '',
    gst_rate: null,
    description: '',
    opening_balance: 0,
    balance_type: 'DR',
    gstLocations: [
      { _uid: nextUid(), gstin: '', state: '', stateCode: '', address: '', pincode: '', contact: '', isPrimary: true, fetchStatus: 'none' }
    ]
  };
  ifscVerified.value = false;
}

watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleGlobalModalKeydown);
    if (props.initialData) {
      hydrateInitialData(props.initialData);
    } else if (props.accountId) {
      await loadAccount(props.accountId);
    } else {
      resetForm();
    }
    nextTick(() => {
      focusFirstInput();
    });
  } else {
    window.removeEventListener('keydown', handleGlobalModalKeydown);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalModalKeydown);
});

function hydrateInitialData(data: any) {
  resetForm();
  if (data._id) form.value._id = String(data._id);
  if (data.account_name || data.name || data.firm) form.value.account_name = data.account_name || data.name || data.firm;

  // 1. Initial type assignment from defaultType if provided
  if (props.defaultType) {
    form.value.account_type = props.defaultType;
  }

  // 2. Parse classification or account type
  if (data.account_type || data.partyType || data.type) {
    let t = String(data.account_type || data.partyType || data.type).toUpperCase();
    if (t === 'CUSTOMER' || t === 'SUNDRY_DEBTORS') {
      form.value.account_type = 'SUNDRY_DEBTORS';
    } else if (t === 'SUPPLIER' || t === 'SUNDRY_CREDITORS') {
      form.value.account_type = 'SUNDRY_CREDITORS';
    } else if (['CURRENT', 'SAVINGS', 'OD', 'CC', 'OTHER'].includes(t)) {
      form.value.account_type = 'BANK';
      form.value.bank_account_type = t;
    } else if (typeOptions.some(opt => opt.value === t)) {
      form.value.account_type = t;
    }
  }

  // If bank credentials exist or defaultType is BANK, ensure account_type is 'BANK'
  if ((data.bank_name || data.bankName || data.account_number || data.accountNumber) && (props.defaultType === 'BANK' || form.value.account_type === 'BANK')) {
    form.value.account_type = 'BANK';
  }

  if (data.phone || data.contact) form.value.phone = data.phone || data.contact;
  if (data.pan) form.value.pan = data.pan;
  if (data.aadhaar_number || data.aadhaar) form.value.aadhaar_number = data.aadhaar_number || data.aadhaar;
  if (data.bank_name || data.bankName) form.value.bank_name = data.bank_name || data.bankName;
  if (data.branch_name || data.branchName) form.value.branch_name = data.branch_name || data.branchName;
  if (data.account_number || data.accountNumber) form.value.account_number = data.account_number || data.accountNumber;
  if (data.ifsc_code || data.ifscCode || data.ifsc) {
    form.value.ifsc_code = data.ifsc_code || data.ifscCode || data.ifsc;
    ifscVerified.value = true;
  }
  if (data.bank_account_type) form.value.bank_account_type = data.bank_account_type;
  if (data.is_default !== undefined) form.value.is_default = !!data.is_default;
  if (data.status) form.value.status = data.status;
  if (data.hsn_sac || data.hsn) form.value.hsn_sac = data.hsn_sac || data.hsn;
  if (data.gst_rate !== undefined) form.value.gst_rate = data.gst_rate;
  if (data.description || data.notes) form.value.description = data.description || data.notes;
  if (data.opening_balance !== undefined || data.openingBalance !== undefined || data.balance !== undefined) {
    form.value.opening_balance = data.opening_balance ?? data.openingBalance ?? data.balance ?? 0;
  }
  if (data.balance_type || data.balanceType) {
    form.value.balance_type = data.balance_type || data.balanceType || 'DR';
  }
  if (data.gstLocations && data.gstLocations.length > 0) {
    form.value.gstLocations = data.gstLocations.map((l: any) => ({
      _uid: l._uid || nextUid(),
      fetchStatus: l.fetchStatus || (l.gstin && l.gstin.length === 15 ? 'success' : 'none'),
      gstin: l.gstin || '',
      state: l.state || '',
      stateCode: l.stateCode || (l.gstin && l.gstin.length >= 2 && l.gstin !== 'UNREGISTERED' ? l.gstin.substring(0, 2) : ''),
      address: l.address || '',
      pincode: l.pincode || l.pin || '',
      contact: l.contact || '',
      isPrimary: !!l.isPrimary
    }));
  } else if (data.gstin || data.address || data.state) {
    form.value.gstLocations = [{
      _uid: nextUid(),
      gstin: data.gstin === 'UNREGISTERED' ? '' : (data.gstin || ''),
      state: data.state || '',
      stateCode: data.stateCode || (data.gstin && data.gstin.length >= 2 && data.gstin !== 'UNREGISTERED' ? data.gstin.substring(0, 2) : ''),
      address: data.address || '',
      pincode: data.pin || data.pincode || '',
      contact: data.contact || data.phone || '',
      isPrimary: true,
      fetchStatus: data.gstin && data.gstin.length === 15 ? 'success' : 'none'
    }];
  }
}

async function loadAccount(id: string) {
  try {
    const [coaRes, partyRes]: any = await Promise.all([
      api.get('/accounting/coa').catch(() => null),
      api.get('/accounting/parties').catch(() => null)
    ]);

    let match = coaRes?.data?.find((a: any) => a._id === id);
    if (!match && (props.initialData?.name || props.initialData?.account_name)) {
      const targetName = (props.initialData.name || props.initialData.account_name).trim().toLowerCase();
      match = coaRes?.data?.find((a: any) => (a.account_name || '').trim().toLowerCase() === targetName);
    }

    const partyNameTarget = (match?.account_name || props.initialData?.name || props.initialData?.account_name || '').trim().toLowerCase();
    const partyMatch = partyRes?.data?.find((p: any) => 
      p._id === id || 
      (p.name && p.name.trim().toLowerCase() === partyNameTarget) ||
      (match?.gstin && p.gstin && p.gstin === match.gstin)
    );

    if (match || partyMatch) {
      const merged = {
        ...(match || {}),
        ...(partyMatch || {}),
        account_name: match?.account_name || partyMatch?.name || '',
        account_type: match?.account_type || partyMatch?.partyType || partyMatch?.type || 'SUNDRY_DEBTORS',
        address: partyMatch?.address || match?.address || '',
        state: partyMatch?.state || match?.state || '',
        stateCode: partyMatch?.stateCode || match?.stateCode || '',
        pin: partyMatch?.pin || partyMatch?.pincode || match?.pin || match?.pincode || '',
        pincode: partyMatch?.pincode || partyMatch?.pin || match?.pincode || match?.pin || '',
        pan: match?.pan || partyMatch?.pan || '',
        phone: match?.phone || partyMatch?.contact || partyMatch?.phone || '',
        opening_balance: match?.opening_balance ?? partyMatch?.openingBalance ?? 0,
        balance_type: match?.balance_type || partyMatch?.balanceType || 'DR',
        gstLocations: (partyMatch?.gstLocations && partyMatch.gstLocations.length > 0)
          ? partyMatch.gstLocations
          : (match?.gstLocations || [])
      };
      hydrateInitialData(merged);
      return;
    }
  } catch (err: any) {
    console.error('Failed to load account for editing:', err);
  }
}

function focusFirstInput() {
  const el = modalContainerRef.value?.querySelector('.first-input') as HTMLInputElement;
  if (el) {
    el.focus();
    el.select();
  }
}

function closeModal() {
  emit('update:modelValue', false);
}

function addGstLocation() {
  form.value.gstLocations.push({
    _uid: nextUid(),
    gstin: '',
    state: '',
    stateCode: '',
    address: '',
    pincode: '',
    contact: '',
    isPrimary: false,
    fetchStatus: 'none'
  });
}

function removeGstLocation(idx: number) {
  form.value.gstLocations.splice(idx, 1);
  const firstLoc = form.value.gstLocations[0];
  if (!form.value.gstLocations.some(l => l.isPrimary) && firstLoc) {
    firstLoc.isPrimary = true;
  }
}

function setPrimaryGstLocation(idx: number) {
  form.value.gstLocations.forEach((l, i) => l.isPrimary = i === idx);
}

async function fetchGstForLocation(index: number) {
  const loc = form.value.gstLocations[index];
  if (!loc || !loc.gstin || loc.gstin.length !== 15) return;

  fetchingGstIndices.value.add(index);
  loc.fetchStatus = 'none';

  try {
    const res: any = await api.get(`/accounting/gst/lookup?gstin=${loc.gstin}`);
    if (res && res.success && res.data) {
      const details = extractGstDetails(res.data, loc.gstin);

      if (!form.value.account_name) {
        form.value.account_name = details.displayName;
      }

      loc.state = details.state;
      loc.stateCode = details.stateCode;
      loc.address = details.address;
      loc.pincode = details.pincode;

      if (details.pan && !form.value.pan) {
        form.value.pan = details.pan;
      }

      loc.fetchStatus = 'success';
      toast.add({ title: 'GSTIN Verified', description: `${details.legalName || details.tradeName || 'Verified'}`, color: 'success' });
    } else {
      loc.fetchStatus = 'failed';
    }
  } catch {
    loc.fetchStatus = 'failed';
  } finally {
    fetchingGstIndices.value.delete(index);
  }
}

function onGstinBlur(index: number) {
  const loc = form.value.gstLocations[index];
  if (loc && loc.gstin && loc.gstin.length === 15 && loc.fetchStatus === 'none') {
    fetchGstForLocation(index);
  }
}

function onGstinEnter(e: KeyboardEvent, index: number) {
  const loc = form.value.gstLocations[index];
  if (loc && loc.gstin && loc.gstin.length === 15 && loc.fetchStatus === 'none') {
    fetchGstForLocation(index);
  }
  onInputEnter(e);
}

async function fetchIfscDetails() {
  const ifsc = (form.value.ifsc_code || '').trim().toUpperCase();
  if (!ifsc || ifsc.length !== 11) return;

  isFetchingIfsc.value = true;
  try {
    const res: any = await api.get(`/master-rolls/lookup/ifsc/${ifsc}`);
    if (res && res.success && res.data) {
      form.value.bank_name = res.data.BANK || form.value.bank_name;
      form.value.branch_name = res.data.BRANCH || form.value.branch_name;
      ifscVerified.value = true;
      toast.add({ 
        title: 'IFSC Verified', 
        description: `${res.data.BANK} - ${res.data.BRANCH}`, 
        color: 'success' 
      });
    } else {
      ifscVerified.value = false;
    }
  } catch {
    ifscVerified.value = false;
    toast.add({ 
      title: 'IFSC Not Found', 
      description: 'Could not fetch bank details for this IFSC', 
      color: 'error' 
    });
  } finally {
    isFetchingIfsc.value = false;
  }
}

function onIfscInput() {
  const ifsc = (form.value.ifsc_code || '').toUpperCase();
  if (form.value.ifsc_code !== ifsc) form.value.ifsc_code = ifsc;
  if (ifsc.length === 11 && !ifscVerified.value) {
    fetchIfscDetails();
  } else if (ifsc.length < 11) {
    ifscVerified.value = false;
  }
}

function onIfscBlur() {
  const ifsc = (form.value.ifsc_code || '').trim().toUpperCase();
  if (ifsc.length === 11 && !ifscVerified.value) {
    fetchIfscDetails();
  }
}

function onIfscEnter(e: KeyboardEvent) {
  const ifsc = (form.value.ifsc_code || '').trim().toUpperCase();
  if (ifsc.length === 11 && !ifscVerified.value) {
    fetchIfscDetails();
  }
  onInputEnter(e);
}

function onInputEnter(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  const formEl = target.closest('form');
  if (!formEl) return;
  const focusable = Array.from(
    formEl.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])')
  ) as HTMLElement[];
  const idx = focusable.indexOf(target);
  const nextEl = idx > -1 ? focusable[idx + 1] : undefined;
  if (nextEl) {
    nextEl.focus();
  } else {
    saveMasterRecord();
  }
}

function handleGlobalModalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal();
  } else if (e.key === 'F8') {
    e.preventDefault();
    saveMasterRecord();
  } else if (e.key === 'Insert' || (e.ctrlKey && e.key.toLowerCase() === 'n')) {
    if (requiresGstSection.value) {
      e.preventDefault();
      addGstLocation();
    }
  }
}

async function saveMasterRecord() {
  if (!form.value.account_name.trim()) {
    toast.add({ title: 'Account Name is required', color: 'error' });
    return;
  }

  isSaving.value = true;
  try {
    const payload = {
      account_name: form.value.account_name.trim(),
      name: form.value.account_name.trim(),
      account_type: form.value.account_type,
      phone: form.value.phone,
      contact: form.value.phone,
      pan: form.value.pan ? form.value.pan.toUpperCase() : null,
      aadhaar_number: form.value.aadhaar_number || null,
      bank_name: form.value.bank_name || null,
      branch_name: form.value.branch_name || null,
      account_number: form.value.account_number || null,
      ifsc_code: form.value.ifsc_code ? form.value.ifsc_code.toUpperCase() : null,
      bank_account_type: form.value.bank_account_type || 'CURRENT',
      is_default: !!form.value.is_default,
      status: form.value.status || 'ACTIVE',
      hsn_sac: form.value.hsn_sac || null,
      gst_rate: form.value.gst_rate,
      description: form.value.description || null,
      opening_balance: form.value.opening_balance || 0,
      balance_type: form.value.balance_type || 'DR',
      gstLocations: form.value.gstLocations.map(({ _uid, ...rest }) => rest)
    };

    let res: any;
    if (isEditing.value) {
      try {
        res = await api.put(`/accounting/coa/${form.value._id}`, payload);
      } catch (err: any) {
        if (form.value.account_type === 'BANK') {
          res = await api.put(`/banking/${form.value._id}`, payload);
        } else {
          throw err;
        }
      }
    } else {
      res = await api.post('/accounting/coa', payload);
    }

    if (res && (res.success || res.data)) {
      const savedDoc = res.data || res;
      toast.add({ 
        title: isEditing.value ? 'Master Record Updated' : 'Master Record Created', 
        description: `${payload.account_name} saved successfully`, 
        color: 'success' 
      });
      emit('saved', savedDoc);
      closeModal();
    }
  } catch (err: any) {
    toast.add({ 
      title: 'Failed to save master record', 
      description: err.data?.statusMessage || err.message, 
      color: 'error' 
    });
  } finally {
    isSaving.value = false;
  }
}
</script>
