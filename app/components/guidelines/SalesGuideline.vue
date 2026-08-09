<template>
  <div class="space-y-8 text-slate-700 dark:text-zinc-300 pb-12">
    <!-- Hero Header Banner -->
    <div class="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
      <div class="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none"></div>
      <div class="flex items-center gap-3 mb-3">
        <span class="px-3 py-1 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-100">Enterprise Accounting</span>
        <span class="px-3 py-1 bg-emerald-400/20 backdrop-blur-md text-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest">100% Keyboard Driven</span>
      </div>
      <h1 class="text-3xl font-black uppercase tracking-tight">Sales Invoice Complete Operating Manual</h1>
      <p class="text-xs font-medium text-blue-100 mt-2 max-w-2xl leading-relaxed">
        Comprehensive end-to-end process manual, input field traversal sequence, modal navigation rules, multi-batch item selection, and keyboard shortcuts reference.
      </p>
    </div>

    <!-- Document Types Quick Reference -->
    <section class="space-y-4">
      <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Supported Document Types
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm">
          <div class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm mb-3">📄</div>
          <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase">Sales Invoice</h3>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">Standard GST tax invoice for goods and services. Updates stock ledger & accounts receivables.</p>
        </div>

        <div class="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm">
          <div class="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm mb-3">📋</div>
          <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase">Proforma Invoice</h3>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">Quotation / estimated bill provided prior to goods dispatch. Does not alter actual stock counts.</p>
        </div>

        <div class="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm">
          <div class="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black text-sm mb-3">🚚</div>
          <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase">Delivery Note</h3>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">Goods transport delivery challan accompanying shipments for logistics verification.</p>
        </div>

        <div class="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm">
          <div class="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm mb-3">↩️</div>
          <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase">Credit Note (Return)</h3>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">Sales return document linked to an original invoice. Re-adjusts stock and customer balance.</p>
        </div>
      </div>
    </section>

    <!-- 15-Step Field Traversal Guide -->
    <section class="space-y-4">
      <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4.5 h-4.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Complete Field-by-Field Traversal Sequence
      </h2>

      <div class="bg-white dark:bg-zinc-800 rounded-3xl border border-slate-200 dark:border-zinc-700 p-6 shadow-sm space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Left Column: Header & Party -->
          <div class="space-y-4">
            <h3 class="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-700 pb-2">Part 1: Document & Customer Header</h3>
            
            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Document Type (Select)</div>
                  <div class="text-[11px] text-slate-500">Choose Sales Invoice, Proforma, or Delivery Note. Press <kbd class="kbd-badge">Enter</kbd> to advance.</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Invoice Date (Input Date)</div>
                  <div class="text-[11px] text-slate-500">Defaults to today's date. Press <kbd class="kbd-badge">Enter</kbd> to advance.</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Billing From GSTIN (Select)</div>
                  <div class="text-[11px] text-slate-500">Select your active firm location / branch GSTIN. Press <kbd class="kbd-badge">Enter</kbd>.</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Transaction Type (Select)</div>
                  <div class="text-[11px] text-slate-500">Intra-State (CGST + SGST) or Inter-State (IGST). Auto-calculated when customer is selected.</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">5</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Reverse Charge (Checkbox)</div>
                  <div class="text-[11px] text-slate-500">Pressing <kbd class="kbd-badge">Enter</kbd> toggles Reverse Charge AND immediately opens Customer Selection Drawer (<kbd class="kbd-badge">F3</kbd>).</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">6</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Customer Party Selection Drawer (<kbd class="kbd-badge">F3</kbd>)</div>
                  <div class="text-[11px] text-slate-500">Auto-focuses search bar. Use <kbd class="kbd-badge">↑</kbd> <kbd class="kbd-badge">↓</kbd> to highlight, <kbd class="kbd-badge">Enter</kbd> to select. Auto-focuses Reference / PO No input upon closing!</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Dispatch & Cart Entry -->
          <div class="space-y-4">
            <h3 class="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-700 pb-2">Part 2: Dispatch Details & Line Items</h3>

            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">7</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Reference / PO No (Input)</div>
                  <div class="text-[11px] text-slate-500">Customer Purchase Order number. Press <kbd class="kbd-badge">Enter</kbd> to advance.</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">8</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Vehicle No & Dispatch (Inputs)</div>
                  <div class="text-[11px] text-slate-500">Transport vehicle registration no. & courier details. Press <kbd class="kbd-badge">Enter</kbd> to advance.</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">9</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Narration Notes (Textarea)</div>
                  <div class="text-[11px] text-slate-500">Pressing <kbd class="kbd-badge">Enter</kbd> advances focus to Cart Items or Stock Browser (<kbd class="kbd-badge">F2</kbd>). Use <kbd class="kbd-badge">Shift + Enter</kbd> for multiline notes.</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">10</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Stock Item Browser Modal (<kbd class="kbd-badge">F2</kbd>)</div>
                  <div class="text-[11px] text-slate-500">Searches inventory. Press <kbd class="kbd-badge">Enter</kbd> on multi-batch item to expand & focus Batch 1. Press <kbd class="kbd-badge">Enter</kbd> on batch to select into cart!</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">11</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Cart Row Cell Traversal</div>
                  <div class="text-[11px] text-slate-500"><kbd class="kbd-badge">Qty</kbd> → <kbd class="kbd-badge">Unit</kbd> → <kbd class="kbd-badge">Rate</kbd> → <kbd class="kbd-badge">Disc %</kbd> → <kbd class="kbd-badge">GST %</kbd> → Next row <kbd class="kbd-badge">Qty</kbd> or <kbd class="kbd-badge">F2</kbd>.</div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">12</span>
                <div>
                  <div class="text-xs font-extrabold text-slate-900 dark:text-white">Save & Print (<kbd class="kbd-badge">F8</kbd> or <kbd class="kbd-badge">Ctrl + S</kbd>)</div>
                  <div class="text-[11px] text-slate-500">Saves bill and opens Print Success Modal with instant PDF and Excel export options.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Comprehensive Master Shortcut Matrix Table -->
    <section class="space-y-4">
      <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Master Keyboard Shortcuts Reference Matrix
      </h2>

      <div class="bg-white dark:bg-zinc-800 rounded-3xl border border-slate-200 dark:border-zinc-700 overflow-x-auto shadow-sm">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-700">
              <th class="px-4 py-3">Shortcut Key</th>
              <th class="px-4 py-3">Module / Scope</th>
              <th class="px-4 py-3">Description & Execution</th>
              <th class="px-4 py-3">Post-Action Target Focus</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-700 font-medium">
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold"><kbd class="kbd-badge">Enter</kbd></td>
              <td class="px-4 py-3 text-slate-500">General Form Inputs</td>
              <td class="px-4 py-3">Advances focus to the next input field. Toggles checkboxes cleanly.</td>
              <td class="px-4 py-3 text-slate-400">Next data field</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold"><kbd class="kbd-badge">Backspace</kbd></td>
              <td class="px-4 py-3 text-slate-500">Empty Form Inputs</td>
              <td class="px-4 py-3">Reverses focus to previous field when input value is empty or caret is at position 0.</td>
              <td class="px-4 py-3 text-slate-400">Previous data field</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold"><kbd class="kbd-badge">Shift + Enter</kbd></td>
              <td class="px-4 py-3 text-slate-500">Narration Notes</td>
              <td class="px-4 py-3">Inserts a multiline newline inside Narration notes without advancing focus.</td>
              <td class="px-4 py-3 text-slate-400">Stays in Narration</td>
            </tr>
            <tr class="bg-blue-50/30 dark:bg-blue-950/30 hover:bg-blue-50/50">
              <td class="px-4 py-3 font-bold text-blue-600 dark:text-blue-400"><kbd class="kbd-badge">F2</kbd></td>
              <td class="px-4 py-3 font-semibold text-slate-700 dark:text-zinc-200">Goods Stock Browser</td>
              <td class="px-4 py-3">Opens Stock Browser Modal. Auto-focuses item search bar.</td>
              <td class="px-4 py-3 font-bold text-blue-600">Qty input of newly added cart row</td>
            </tr>
            <tr class="bg-blue-50/30 dark:bg-blue-950/30 hover:bg-blue-50/50">
              <td class="px-4 py-3 font-bold text-blue-600 dark:text-blue-400"><kbd class="kbd-badge">F3</kbd></td>
              <td class="px-4 py-3 font-semibold text-slate-700 dark:text-zinc-200">Customer Selection</td>
              <td class="px-4 py-3">Opens Customer Party Selection Drawer. Auto-focuses party search input.</td>
              <td class="px-4 py-3 font-bold text-blue-600">Reference / PO No input</td>
            </tr>
            <tr class="bg-blue-50/30 dark:bg-blue-950/30 hover:bg-blue-50/50">
              <td class="px-4 py-3 font-bold text-blue-600 dark:text-blue-400"><kbd class="kbd-badge">F4</kbd></td>
              <td class="px-4 py-3 font-semibold text-slate-700 dark:text-zinc-200">Other Charges Modal</td>
              <td class="px-4 py-3">Opens Other Charges Modal for freight, packing, insurance, and extra fees.</td>
              <td class="px-4 py-3 font-bold text-blue-600">Restores to exact originating field</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold"><kbd class="kbd-badge">F5</kbd></td>
              <td class="px-4 py-3 text-slate-500">Cart Table / Sales</td>
              <td class="px-4 py-3">Adds a customizable Service Line item row to the billing cart.</td>
              <td class="px-4 py-3 text-slate-400">Service Name input</td>
            </tr>
            <tr class="bg-emerald-50/30 dark:bg-emerald-950/30 hover:bg-emerald-50/50">
              <td class="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400"><kbd class="kbd-badge">F8</kbd> or <kbd class="kbd-badge">Ctrl + S</kbd></td>
              <td class="px-4 py-3 font-semibold text-slate-700 dark:text-zinc-200">Save Invoice</td>
              <td class="px-4 py-3">Saves invoice & opens Print Success Modal with instant PDF/Excel export.</td>
              <td class="px-4 py-3 font-bold text-emerald-600">Download PDF button</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold text-rose-600"><kbd class="kbd-badge">F9</kbd></td>
              <td class="px-4 py-3 text-slate-500">Form Reset</td>
              <td class="px-4 py-3">Discards unsaved form changes and resets bill back to clean state.</td>
              <td class="px-4 py-3 text-slate-400">Input #1 (Doc Type / Date)</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold text-purple-600"><kbd class="kbd-badge">F5</kbd> or <kbd class="kbd-badge">Insert</kbd> or <kbd class="kbd-badge">Ctrl + N</kbd></td>
              <td class="px-4 py-3 text-slate-500">Stock Browser Modal</td>
              <td class="px-4 py-3">Opens Create New Stock Item sub-modal (`CreateStockModal`).</td>
              <td class="px-4 py-3 text-slate-400">Item Name input</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold text-amber-600"><kbd class="kbd-badge">F3</kbd> or <kbd class="kbd-badge">Ctrl + E</kbd></td>
              <td class="px-4 py-3 text-slate-500">Stock Browser Modal</td>
              <td class="px-4 py-3">Opens Edit Stock Item sub-modal for highlighted stock item.</td>
              <td class="px-4 py-3 text-slate-400">Item Name input</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold"><kbd class="kbd-badge">Insert</kbd> or <kbd class="kbd-badge">Ctrl + N</kbd></td>
              <td class="px-4 py-3 text-slate-500">Other Charges Modal</td>
              <td class="px-4 py-3">Adds a new charge line row and auto-focuses its Charge Name input.</td>
              <td class="px-4 py-3 text-slate-400">New Charge Name input</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold"><kbd class="kbd-badge">Delete</kbd> or <kbd class="kbd-badge">Ctrl + D</kbd></td>
              <td class="px-4 py-3 text-slate-500">Other Charges Modal</td>
              <td class="px-4 py-3">Removes the currently focused charge line row from the modal.</td>
              <td class="px-4 py-3 text-slate-400">Adjacent Charge input</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold"><kbd class="kbd-badge">↑</kbd> <kbd class="kbd-badge">↓</kbd></td>
              <td class="px-4 py-3 text-slate-500">Stock / Party / Autocomplete</td>
              <td class="px-4 py-3">Navigates highlighted selection across lists, multi-batch rows, or suggestions.</td>
              <td class="px-4 py-3 text-slate-400">Active highlighted item</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold"><kbd class="kbd-badge">Ctrl + ,</kbd></td>
              <td class="px-4 py-3 text-slate-500">Global Application</td>
              <td class="px-4 py-3">Toggles this System Guidelines Drawer from anywhere in the app.</td>
              <td class="px-4 py-3 text-slate-400">Restores to originating field</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold"><kbd class="kbd-badge">ESC</kbd></td>
              <td class="px-4 py-3 text-slate-500">Any Modal / Drawer</td>
              <td class="px-4 py-3">Closes modal and restores focus to originating page input field.</td>
              <td class="px-4 py-3 text-slate-400">Originating input field</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Key Principles Card -->
    <section class="bg-slate-900 text-white rounded-3xl p-8 shadow-xl space-y-4">
      <h2 class="text-sm font-black uppercase tracking-wider text-teal-400 flex items-center gap-2">
        <span>💡</span> Pro Tips & ERP Power User Best Practices
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300">
        <div>
          <div class="font-extrabold text-white mb-1">⚡ Rapid 10-Second Invoicing</div>
          <p class="leading-relaxed">Use <kbd class="kbd-badge dark">Enter</kbd> to breeze through header fields. Press <kbd class="kbd-badge dark">F3</kbd> to pick customer, type PO ref, press <kbd class="kbd-badge dark">Enter</kbd> on Narration to jump directly to <kbd class="kbd-badge dark">F2</kbd> Stock Picker!</p>
        </div>

        <div>
          <div class="font-extrabold text-white mb-1">📦 Multi-Batch Navigation</div>
          <p class="leading-relaxed">When searching items, hit <kbd class="kbd-badge dark">Enter</kbd> on a multi-batch item to expand its batches. Focus immediately jumps to Batch #1. Use <kbd class="kbd-badge dark">↓</kbd> to select the exact batch!</p>
        </div>

        <div>
          <div class="font-extrabold text-white mb-1">🎯 Focus Memory Restoration</div>
          <p class="leading-relaxed">No matter which modal you open (<kbd class="kbd-badge dark">F2</kbd>, <kbd class="kbd-badge dark">F3</kbd>, <kbd class="kbd-badge dark">F4</kbd>), closing the modal automatically returns focus to the exact field you were working on!</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.kbd-badge {
  display: inline-block;
  padding: 2px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 800;
  color: #334155;
  background-color: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
}
.kbd-badge.dark {
  color: #e2e8f0;
  background-color: #1e293b;
  border-color: #334155;
}
:deep(.dark) .kbd-badge {
  color: #e2e8f0;
  background-color: #27272a;
  border-color: #3f3f46;
}
</style>
