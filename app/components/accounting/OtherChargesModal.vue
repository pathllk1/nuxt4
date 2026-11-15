<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div 
        v-if="modelValue" 
        class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/60 dark:bg-black/75 backdrop-blur-sm"
        @click.self="closeModal"
        @keydown="handleGlobalKeydown"
      >
        <div 
          ref="modalContainerRef" 
          class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col transform transition-all"
          role="dialog"
          aria-modal="true"
        >
          <!-- Modern Enterprise Header -->
          <div class="bg-gradient-to-r from-slate-50 via-blue-50/40 to-indigo-50/50 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-indigo-950/30 px-6 py-4.5 flex justify-between items-center border-b border-slate-200/80 dark:border-zinc-800 shrink-0">
            <div class="flex items-center gap-3.5">
              <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
              </div>
              <div>
                <div class="flex items-center gap-2.5 flex-wrap">
                  <h2 class="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase">
                    Other Charges & Freight
                  </h2>
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-blue-100/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                    {{ otherCharges.length }} Line{{ otherCharges.length === 1 ? '' : 's' }}
                  </span>
                  <span v-if="netTotal > 0" class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                    Net: ₹{{ formatCurrency(netTotal) }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-medium">
                  Additional freight, packaging, insurance & overhead charges with GST distribution
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <div class="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700">
                <span class="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-700 rounded font-mono text-slate-700 dark:text-zinc-200 font-black">Ins</span>
                <span>Add</span>
                <span class="mx-1 opacity-30">•</span>
                <span class="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-700 rounded font-mono text-slate-700 dark:text-zinc-200 font-black">F8</span>
                <span>Apply</span>
                <span class="mx-1 opacity-30">•</span>
                <span class="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-700 rounded font-mono text-slate-700 dark:text-zinc-200 font-black">Esc</span>
                <span>Close</span>
              </div>
              <button 
                @click="closeModal" 
                type="button" 
                class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Quick Presets Bar (Instant One-Click / Keyboard Add) -->
          <div class="px-6 py-3 bg-slate-50/90 dark:bg-zinc-800/40 border-b border-slate-200/60 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 shrink-0 flex items-center gap-1.5 mr-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Presets:
            </span>
            <div class="flex items-center gap-2 flex-nowrap">
              <button
                v-for="preset in quickPresets"
                :key="preset.name"
                type="button"
                @click="applyPreset(preset)"
                class="px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer active:scale-95 bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 shadow-2xs group"
                :title="`Add ${preset.name} (${preset.grate}% GST)`"
              >
                <span class="text-xs group-hover:scale-110 transition-transform">{{ preset.icon }}</span>
                <span>{{ preset.name }}</span>
                <span class="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 font-bold">{{ preset.grate }}%</span>
              </button>
            </div>
          </div>

          <!-- Table Column Labels (Desktop) -->
          <div 
            class="hidden md:grid items-center gap-3 px-7 sm:px-10 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/40 dark:bg-zinc-900 shrink-0"
            style="grid-template-columns: 36px minmax(180px, 1fr) 95px 120px 75px 110px 120px 36px;"
          >
            <div class="text-center">#</div>
            <div>Charge Description</div>
            <div class="text-center">HSN / SAC</div>
            <div class="text-right">Taxable Amt (₹)</div>
            <div class="text-right">GST %</div>
            <div class="text-right whitespace-nowrap">GST (₹)</div>
            <div class="text-right whitespace-nowrap">Total (₹)</div>
            <div></div>
          </div>

          <!-- Main Scrollable Lines Container -->
          <div 
            class="p-4 sm:p-6 space-y-3.5 max-h-[52vh] min-h-[260px] overflow-y-auto custom-scrollbar charges-container flex-1"
            @scroll="updateDropdownPosition"
          >
            <!-- Empty State -->
            <div v-if="otherCharges.length === 0" class="py-12 px-4 text-center flex flex-col items-center justify-center">
              <div class="w-14 h-14 rounded-3xl bg-blue-50 dark:bg-zinc-800 flex items-center justify-center text-2xl text-blue-600 dark:text-blue-400 mb-3 border border-blue-100 dark:border-zinc-700 shadow-inner">
                🚚
              </div>
              <h3 class="text-sm font-bold text-slate-800 dark:text-zinc-200">No other charges applied yet</h3>
              <p class="text-xs text-slate-400 dark:text-zinc-500 max-w-sm mt-1">
                Click one of the quick presets above or add a custom charge line to apply freight, handling, or insurance.
              </p>
              <button 
                @click="addCharge()" 
                type="button" 
                class="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-2"
              >
                <span>+ Add First Line</span>
                <span class="text-[10px] font-mono px-1 py-0.5 rounded bg-white/20">Insert</span>
              </button>
            </div>

            <!-- Charge Lines -->
            <div 
              v-for="(charge, index) in otherCharges" 
              :key="index" 
              :data-charge-row="index" 
              class="bg-slate-50/70 dark:bg-zinc-800/50 hover:bg-slate-50 dark:hover:bg-zinc-800/80 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-700/60 transition-all shadow-2xs group relative"
            >
              <!-- Desktop Layout (md+) -->
              <div 
                class="hidden md:grid items-center gap-3"
                style="grid-template-columns: 36px minmax(180px, 1fr) 95px 120px 75px 110px 120px 36px;"
              >
                <!-- Index -->
                <div class="flex items-center justify-center">
                  <span class="w-7 h-7 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 font-mono text-xs font-bold flex items-center justify-center shadow-2xs">
                    {{ index + 1 }}
                  </span>
                </div>

                <!-- Charge Description (Autocomplete Input) -->
                <div class="relative">
                  <input 
                    type="text" 
                    v-model="charge.name" 
                    @focus="onNameFocus(index)" 
                    @input="onNameInput(index)"
                    @keydown="onNameInputKeydown($event, index)"
                    @keydown.backspace="onNameBackspace($event, index)"
                    placeholder="e.g. Freight Charges" 
                    class="w-full px-3.5 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 name-input transition-all shadow-2xs" 
                  />
                </div>

                <!-- HSN / SAC -->
                <div>
                  <input 
                    type="text" 
                    v-model="charge.hsnSac" 
                    @keydown="onHsnKeydown($event, index)"
                    placeholder="e.g. 9965" 
                    class="w-full px-2.5 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-xs font-mono font-bold uppercase text-center text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 hsn-input shadow-2xs" 
                  />
                </div>

                <!-- Taxable Amount (₹) -->
                <div>
                  <div class="relative">
                    <span class="absolute left-2.5 top-2 text-xs font-bold text-slate-400 dark:text-zinc-500">₹</span>
                    <input 
                      type="number" 
                      step="any" 
                      v-model="charge.amount" 
                      @keydown="onAmountKeydown($event, index)"
                      class="w-full pl-6 pr-2.5 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-xs font-bold text-right font-mono text-slate-900 dark:text-white amount-input shadow-2xs" 
                    />
                  </div>
                </div>

                <!-- GST % -->
                <div>
                  <input 
                    type="number" 
                    step="any" 
                    v-model="charge.grate" 
                    @keydown="onGrateKeydown($event, index)"
                    class="w-full px-2 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none text-xs font-bold text-right font-mono text-slate-900 dark:text-white grate-input shadow-2xs" 
                  />
                </div>

                <!-- Calculated GST (₹) -->
                <div class="text-right">
                  <div class="inline-flex items-center justify-end px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50">
                    <span class="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      ₹{{ formatCurrency(getLineTax(charge)) }}
                    </span>
                  </div>
                </div>

                <!-- Line Total (₹) -->
                <div class="text-right">
                  <div class="inline-flex items-center justify-end px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-zinc-700/60 border border-slate-200/70 dark:border-zinc-600/50">
                    <span class="text-xs font-mono font-black text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                      ₹{{ formatCurrency(getLineTotal(charge)) }}
                    </span>
                  </div>
                </div>

                <!-- Delete Action -->
                <div class="flex items-center justify-center">
                  <button 
                    @click="removeCharge(index)" 
                    type="button" 
                    class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-600 dark:text-zinc-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Remove Line"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Mobile / Tablet Responsive Layout (< md) -->
              <div class="md:hidden space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 flex-1">
                    <span class="w-6 h-6 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                      #{{ index + 1 }}
                    </span>
                    <input 
                      type="text" 
                      v-model="charge.name" 
                      @focus="onNameFocus(index)" 
                      @input="onNameInput(index)"
                      @keydown="onNameInputKeydown($event, index)"
                      @keydown.backspace="onNameBackspace($event, index)"
                      placeholder="e.g. Freight Charges" 
                      class="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white name-input" 
                    />
                  </div>
                  <button 
                    @click="removeCharge(index)" 
                    type="button" 
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">HSN/SAC</label>
                    <input 
                      type="text" 
                      v-model="charge.hsnSac" 
                      @keydown="onHsnKeydown($event, index)"
                      placeholder="9965" 
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold uppercase hsn-input" 
                    />
                  </div>
                  <div>
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Amount (₹)</label>
                    <input 
                      type="number" 
                      step="any" 
                      v-model="charge.amount" 
                      @keydown="onAmountKeydown($event, index)"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-right amount-input" 
                    />
                  </div>
                  <div>
                    <label class="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">GST %</label>
                    <input 
                      type="number" 
                      step="any" 
                      v-model="charge.grate" 
                      @keydown="onGrateKeydown($event, index)"
                      class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-right grate-input" 
                    />
                  </div>
                </div>

                <div class="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-zinc-700/50 text-[11px] font-mono">
                  <span class="text-slate-500">Tax: <strong class="text-emerald-600 dark:text-emerald-400">₹{{ formatCurrency(getLineTax(charge)) }}</strong></span>
                  <span class="text-slate-800 dark:text-zinc-200 font-bold">Line Total: <strong>₹{{ formatCurrency(getLineTotal(charge)) }}</strong></span>
                </div>
              </div>
            </div>

            <!-- Add Another Charge Line Button -->
            <div v-if="otherCharges.length > 0" class="pt-2">
              <button 
                @click="addCharge()" 
                type="button" 
                class="w-full py-3 border-2 border-dashed border-slate-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-zinc-800/50 font-bold uppercase text-[11px] tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer group"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Another Charge Line</span>
                <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-700 text-[9px] font-mono font-normal">Insert / Ctrl+N</span>
              </button>
            </div>
          </div>

          <!-- Financial Breakdown & Actions Footer -->
          <div class="p-4 sm:p-6 border-t border-slate-200/80 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-800/60 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
            <!-- 3-Way Financial Breakdown -->
            <div class="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
              <div class="flex flex-col">
                <span class="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Taxable Total</span>
                <span class="text-sm font-bold font-mono text-slate-700 dark:text-zinc-200">₹{{ formatCurrency(taxableTotal) }}</span>
              </div>
              <div class="h-8 w-px bg-slate-200 dark:bg-zinc-700"></div>
              <div class="flex flex-col">
                <span class="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total GST</span>
                <span class="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">+₹{{ formatCurrency(gstTotal) }}</span>
              </div>
              <div class="h-8 w-px bg-slate-200 dark:bg-zinc-700"></div>
              <div class="flex flex-col">
                <span class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Net Charges Total</span>
                <span class="text-lg font-black font-mono text-blue-900 dark:text-blue-300">₹{{ formatCurrency(netTotal) }}</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                v-if="otherCharges.length > 0"
                @click="clearAllCharges"
                type="button"
                class="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-rose-600 hover:border-rose-300 dark:hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
              >
                Clear All
              </button>
              <button 
                @click="closeModal" 
                type="button" 
                class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel (Esc)
              </button>
              <button 
                @click="closeModal" 
                type="button" 
                class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all transform active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <span>Apply Charges</span>
                <span class="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">F8</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Teleported Floating Autocomplete Suggestions Dropdown -->
    <!-- Breaks completely out of modal clipping, table containers and footers so vertically all items show -->
    <div 
      v-if="isDropdownOpen" 
      class="fixed inset-0 z-[99990]" 
      @mousedown="closeDropdown" 
    />

    <div 
      v-if="isDropdownOpen && currentSuggestions.length > 0" 
      ref="floatingDropdownRef"
      class="fixed z-[99999] bg-white/98 dark:bg-zinc-800/98 backdrop-blur-xl border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-zinc-700/60 ring-1 ring-black/10 dark:ring-white/10 animate-scale-in flex flex-col"
      :style="dropdownFloatingStyle"
      @mousedown.prevent
    >
      <!-- Dropdown Header with Database & Source Count -->
      <div class="px-3.5 py-2 bg-slate-50/90 dark:bg-zinc-850/90 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider flex justify-between items-center border-b border-slate-100 dark:border-zinc-700/60 shrink-0">
        <span class="flex items-center gap-1.5 font-bold text-slate-700 dark:text-zinc-300">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
          <span>Charges Master ({{ currentSuggestions.length }})</span>
        </span>
        <span class="text-[9px] font-mono">↑↓ Navigate • ↵ Select</span>
      </div>

      <!-- Scrollable List of All Items (Full vertical height without container clipping) -->
      <div ref="dropdownListRef" class="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-slate-100/60 dark:divide-zinc-700/40">
        <button 
          v-for="(sug, sIdx) in currentSuggestions" 
          :key="sug.name + sIdx" 
          :data-sug-idx="sIdx"
          type="button"
          @mousedown.prevent="selectSuggestion(activeDropdownIndex!, sug)"
          class="w-full px-3.5 py-2.5 text-left text-xs transition-colors flex items-center justify-between gap-3 cursor-pointer group"
          :class="[
            suggestionSelectedIndex === sIdx ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/60 text-slate-800 dark:text-zinc-200'
          ]"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="text-sm shrink-0 w-6 h-6 rounded-lg flex items-center justify-center shadow-2xs" :class="suggestionSelectedIndex === sIdx ? 'bg-white/20' : 'bg-slate-100 dark:bg-zinc-700/80'">
              {{ sug.icon || '📌' }}
            </span>
            <div class="truncate flex flex-col">
              <span class="truncate font-semibold">{{ sug.name }}</span>
              <span class="text-[9px] uppercase font-mono tracking-wider" :class="suggestionSelectedIndex === sIdx ? 'text-blue-100' : 'text-slate-400 dark:text-zinc-500'">
                {{ sug.source === 'coa' ? 'Database Ledger' : sug.source === 'history' ? 'Invoice History' : 'Standard GST' }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0 font-mono">
            <span 
              v-if="sug.hsnSac" 
              class="text-[10px] px-1.5 py-0.5 rounded border"
              :class="suggestionSelectedIndex === sIdx ? 'bg-blue-500/50 border-blue-400 text-white' : 'bg-slate-100 dark:bg-zinc-700 border-slate-200 dark:border-zinc-600 text-slate-500 dark:text-zinc-400'"
            >
              SAC {{ sug.hsnSac }}
            </span>
            <span 
              class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
              :class="suggestionSelectedIndex === sIdx ? 'bg-blue-500/50 border-blue-400 text-white' : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'"
            >
              {{ sug.grate }}%
            </span>
          </div>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useApi } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  otherCharges: any[];
}>();

const emit = defineEmits(['update:modelValue']);
const api = useApi();

const modalContainerRef = ref<HTMLElement | null>(null);
const floatingDropdownRef = ref<HTMLElement | null>(null);
const dropdownListRef = ref<HTMLElement | null>(null);

const historicalTypes = ref<any[]>([]);
const activeDropdownIndex = ref<number | null>(null);
const suggestionSelectedIndex = ref(0);
const dropdownFloatingStyle = ref<Record<string, string>>({});

const quickPresets = [
  { name: 'Freight Charges', hsnSac: '9965', grate: 18, icon: '🚚', source: 'default' },
  { name: 'Packaging & Handling', hsnSac: '9985', grate: 18, icon: '📦', source: 'default' },
  { name: 'Insurance Charges', hsnSac: '9971', grate: 18, icon: '🛡️', source: 'default' },
  { name: 'Loading / Unloading', hsnSac: '9965', grate: 18, icon: '🏗️', source: 'default' },
  { name: 'Courier & Delivery', hsnSac: '9968', grate: 18, icon: '⚡', source: 'default' },
  { name: 'Round Off', hsnSac: '9999', grate: 0, icon: '🎯', source: 'default' },
];

function getLineAmount(charge: any): number {
  return parseFloat(charge?.amount) || 0;
}

function getLineGrate(charge: any): number {
  return parseFloat(charge?.grate ?? charge?.gstRate) || 0;
}

function getLineTax(charge: any): number {
  const amt = getLineAmount(charge);
  const rate = getLineGrate(charge);
  return (amt * rate) / 100;
}

function getLineTotal(charge: any): number {
  return getLineAmount(charge) + getLineTax(charge);
}

const taxableTotal = computed(() => {
  return (props.otherCharges || []).reduce((sum, c) => sum + getLineAmount(c), 0);
});

const gstTotal = computed(() => {
  return (props.otherCharges || []).reduce((sum, c) => sum + getLineTax(c), 0);
});

const netTotal = computed(() => {
  return taxableTotal.value + gstTotal.value;
});

function formatCurrency(val: number | string): string {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (!num || isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function fetchHistoricalTypes() {
  try {
    const res = await api.get('/accounting/other-charges/types');
    if (res.success && Array.isArray(res.data)) {
      historicalTypes.value = res.data;
    }
  } catch (err) {
    console.error('Failed to fetch other charges types:', err);
  }
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    fetchHistoricalTypes();
    if (!props.otherCharges.length) {
      addCharge();
    } else {
      nextTick(() => {
        focusRowInput(0, 'name');
      });
    }
  } else {
    closeDropdown();
  }
});

function closeModal() {
  closeDropdown();
  emit('update:modelValue', false);
}

function closeDropdown() {
  activeDropdownIndex.value = null;
}

const activeDropdownQuery = computed(() => {
  if (activeDropdownIndex.value === null) return '';
  return props.otherCharges[activeDropdownIndex.value]?.name || '';
});

const currentSuggestions = computed(() => {
  return filteredSuggestions(activeDropdownQuery.value);
});

const isDropdownOpen = computed(() => {
  return activeDropdownIndex.value !== null && currentSuggestions.value.length > 0;
});

function filteredSuggestions(name: string) {
  const query = (name || '').toLowerCase().trim();
  
  const map = new Map<string, any>();
  for (const preset of quickPresets) {
    map.set(preset.name.toLowerCase(), { ...preset });
  }
  for (const item of historicalTypes.value) {
    if (item.name) {
      const lower = item.name.toLowerCase();
      const existing = map.get(lower) || {};
      map.set(lower, {
        ...existing,
        ...item,
        icon: item.icon || existing.icon || '📌',
        hsnSac: item.hsnSac || existing.hsnSac || '',
        grate: item.grate !== undefined ? item.grate : (existing.grate !== undefined ? existing.grate : 18),
        source: item.source || existing.source || 'coa'
      });
    }
  }

  const all = Array.from(map.values());
  if (!query) return all;
  return all.filter(s => s.name.toLowerCase().includes(query));
}

function updateDropdownPosition() {
  if (activeDropdownIndex.value === null || !modalContainerRef.value || !import.meta.client) return;
  const row = modalContainerRef.value.querySelector(`[data-charge-row="${activeDropdownIndex.value}"]`) as HTMLElement;
  if (!row) return;
  const input = row.querySelector('input.name-input') as HTMLInputElement;
  if (!input) return;

  const rect = input.getBoundingClientRect();
  const dropdownWidth = Math.min(384, window.innerWidth - 32);
  const dropdownHeight = 340; // Max vertical height allocation

  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUpward = spaceBelow < 280 && spaceAbove > spaceBelow;

  let top = openUpward ? rect.top - dropdownHeight - 6 : rect.bottom + 6;
  if (top < 12) top = 12;
  if (!openUpward && top + dropdownHeight > window.innerHeight - 12) {
    top = window.innerHeight - dropdownHeight - 12;
  }

  let left = rect.left;
  if (left + dropdownWidth > window.innerWidth - 16) {
    left = window.innerWidth - dropdownWidth - 16;
  }
  if (left < 16) left = 16;

  dropdownFloatingStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(dropdownWidth)}px`,
    maxHeight: `${dropdownHeight}px`,
    zIndex: '99999'
  };
}

function scrollActiveSuggestionIntoView() {
  nextTick(() => {
    if (!dropdownListRef.value) return;
    const activeEl = dropdownListRef.value.querySelector(`[data-sug-idx="${suggestionSelectedIndex.value}"]`) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  });
}

function onNameFocus(index: number) {
  activeDropdownIndex.value = index;
  suggestionSelectedIndex.value = 0;
  nextTick(() => {
    updateDropdownPosition();
  });
}

function onNameInput(index: number) {
  activeDropdownIndex.value = index;
  suggestionSelectedIndex.value = 0;
  nextTick(() => {
    updateDropdownPosition();
  });
}

function selectSuggestion(index: number, sug: any) {
  if (!props.otherCharges[index]) return;
  props.otherCharges[index].name = sug.name;
  props.otherCharges[index].hsnSac = sug.hsnSac || '';
  props.otherCharges[index].grate = sug.grate !== undefined ? sug.grate : 18;
  closeDropdown();

  nextTick(() => {
    focusRowInput(index, 'amount');
  });
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') || (e.altKey && e.key.toLowerCase() === 'a')) {
    e.preventDefault();
    e.stopPropagation();
    addCharge();
  } else if (e.key === 'F8') {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  } else if (e.key === 'Escape') {
    if (isDropdownOpen.value) {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  }
}

function focusRowInput(index: number, field: 'name' | 'hsn' | 'amount' | 'grate') {
  nextTick(() => {
    const row = modalContainerRef.value?.querySelector(`[data-charge-row="${index}"]`) as HTMLElement;
    if (!row) return;
    const input = row.querySelector(`input.${field}-input`) as HTMLInputElement;
    if (input) {
      input.focus();
      input.select();
    }
  });
}

function onNameInputKeydown(e: KeyboardEvent, index: number) {
  const suggestions = currentSuggestions.value;
  const isMenuOpen = isDropdownOpen.value;

  if (e.key === 'ArrowDown') {
    if (isMenuOpen && suggestions.length > 0) {
      e.preventDefault();
      suggestionSelectedIndex.value = (suggestionSelectedIndex.value + 1) % suggestions.length;
      scrollActiveSuggestionIntoView();
      return;
    } else if (suggestions.length > 0) {
      activeDropdownIndex.value = index;
      suggestionSelectedIndex.value = 0;
      updateDropdownPosition();
      return;
    }
  } else if (e.key === 'ArrowUp') {
    if (isMenuOpen && suggestions.length > 0) {
      e.preventDefault();
      suggestionSelectedIndex.value = (suggestionSelectedIndex.value - 1 + suggestions.length) % suggestions.length;
      scrollActiveSuggestionIntoView();
      return;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (isMenuOpen && suggestionSelectedIndex.value >= 0 && suggestionSelectedIndex.value < suggestions.length) {
      selectSuggestion(index, suggestions[suggestionSelectedIndex.value]);
      return;
    }
    closeDropdown();
    focusRowInput(index, 'hsn');
  }
}

function onNameBackspace(e: KeyboardEvent, index: number) {
  const input = e.target as HTMLInputElement;
  if ((input.value === '' || (input.selectionStart === 0 && input.selectionEnd === 0)) && index > 0) {
    e.preventDefault();
    closeDropdown();
    focusRowInput(index - 1, 'grate');
  }
}

function onHsnKeydown(e: KeyboardEvent, index: number) {
  if (e.key === 'Enter') {
    e.preventDefault();
    focusRowInput(index, 'amount');
  } else if (e.key === 'Backspace') {
    const input = e.target as HTMLInputElement;
    if (input.selectionStart === 0 && input.selectionEnd === 0) {
      e.preventDefault();
      focusRowInput(index, 'name');
    }
  }
}

function onAmountKeydown(e: KeyboardEvent, index: number) {
  if (e.key === 'Enter') {
    e.preventDefault();
    focusRowInput(index, 'grate');
  } else if (e.key === 'Backspace') {
    const input = e.target as HTMLInputElement;
    if (input.value === '' || (input.selectionStart === 0 && input.selectionEnd === 0)) {
      e.preventDefault();
      focusRowInput(index, 'hsn');
    }
  }
}

function onGrateKeydown(e: KeyboardEvent, index: number) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (index === props.otherCharges.length - 1) {
      const current = props.otherCharges[index];
      if (current.name || (parseFloat(current.amount) || 0) > 0) {
        addCharge();
      } else {
        closeModal();
      }
    } else {
      focusRowInput(index + 1, 'name');
    }
  } else if (e.key === 'Backspace') {
    const input = e.target as HTMLInputElement;
    if (input.value === '' || (input.selectionStart === 0 && input.selectionEnd === 0)) {
      e.preventDefault();
      focusRowInput(index, 'amount');
    }
  }
}

function applyPreset(preset: { name: string; hsnSac: string; grate: number }) {
  const emptyIndex = props.otherCharges.findIndex(c => !c.name && (!c.amount || Number(c.amount) === 0));
  let targetIndex = emptyIndex;

  if (emptyIndex !== -1) {
    props.otherCharges[emptyIndex].name = preset.name;
    props.otherCharges[emptyIndex].hsnSac = preset.hsnSac;
    props.otherCharges[emptyIndex].grate = preset.grate;
  } else {
    props.otherCharges.push({
      name: preset.name,
      hsnSac: preset.hsnSac,
      amount: 0,
      grate: preset.grate
    });
    targetIndex = props.otherCharges.length - 1;
  }

  closeDropdown();
  focusRowInput(targetIndex, 'amount');
}

function addCharge(preset?: { name: string; hsnSac: string; grate: number }) {
  props.otherCharges.push({
    name: preset?.name || '',
    hsnSac: preset?.hsnSac || '',
    amount: 0,
    grate: preset?.grate !== undefined ? preset.grate : 18
  });

  closeDropdown();

  nextTick(() => {
    const newIdx = props.otherCharges.length - 1;
    if (preset) {
      focusRowInput(newIdx, 'amount');
    } else {
      focusRowInput(newIdx, 'name');
    }
  });
}

function removeCharge(index: number) {
  props.otherCharges.splice(index, 1);
  closeDropdown();
  nextTick(() => {
    if (props.otherCharges.length > 0) {
      const nextIndex = Math.min(index, props.otherCharges.length - 1);
      focusRowInput(nextIndex, 'name');
    }
  });
}

function clearAllCharges() {
  props.otherCharges.splice(0, props.otherCharges.length);
  closeDropdown();
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
  }
});

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', updateDropdownPosition);
    window.removeEventListener('scroll', updateDropdownPosition, true);
  }
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.35);
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.65);
}
</style>