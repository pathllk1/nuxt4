<template>
  <div class="space-y-8 text-slate-700 dark:text-zinc-300">
    <!-- Header Hero Banner -->
    <div class="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl">
      <div class="flex items-center gap-3 mb-2">
        <span class="px-2.5 py-1 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest">Core Module</span>
        <span class="px-2.5 py-1 bg-emerald-400/20 text-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-widest">100% Keyboard Driven</span>
      </div>
      <h2 class="text-2xl font-black uppercase tracking-tight">Sales Invoice Billing Guide</h2>
      <p class="text-xs font-medium text-blue-100 mt-1 max-w-xl">
        Complete step-by-step workflow guide and keyboard reference for creating sales invoices, proformas, delivery notes, and credit notes without touching the mouse.
      </p>
    </div>

    <!-- Step-by-Step Process Flow -->
    <section class="space-y-4">
      <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Sequential Invoice Creation Process Flow
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
        <!-- Step 1 -->
        <div class="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
          <div class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Step 1</div>
          <h4 class="text-xs font-extrabold text-slate-900 dark:text-white">Document Setup</h4>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">
            Doc Type → Date → Firm GSTIN → Bill Subtype → Reverse Charge toggle.
          </p>
          <div class="mt-3 text-[10px] font-mono font-bold text-slate-400">Enter advances focus</div>
        </div>

        <!-- Step 2 -->
        <div class="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
          <div class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Step 2</div>
          <h4 class="text-xs font-extrabold text-slate-900 dark:text-white">Customer (F3)</h4>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">
            Press <kbd class="kbd-badge">F3</kbd> or <kbd class="kbd-badge">Enter</kbd> on Reverse Charge to open Party Drawer.
          </p>
          <div class="mt-3 text-[10px] font-mono font-bold text-slate-400">↑↓ select, Enter confirms</div>
        </div>

        <!-- Step 3 -->
        <div class="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
          <div class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Step 3</div>
          <h4 class="text-xs font-extrabold text-slate-900 dark:text-white">Dispatch Info</h4>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">
            PO Reference → Vehicle No → Transport → Narration notes.
          </p>
          <div class="mt-3 text-[10px] font-mono font-bold text-slate-400">Shift+Enter for newline</div>
        </div>

        <!-- Step 4 -->
        <div class="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
          <div class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Step 4</div>
          <h4 class="text-xs font-extrabold text-slate-900 dark:text-white">Items Entry (F2)</h4>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">
            Press <kbd class="kbd-badge">F2</kbd> for Goods Stock or <kbd class="kbd-badge">F5</kbd> for Service line.
          </p>
          <div class="mt-3 text-[10px] font-mono font-bold text-slate-400">Qty → Rate → Disc → GST%</div>
        </div>

        <!-- Step 5 -->
        <div class="bg-white dark:bg-zinc-800/80 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
          <div class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Step 5</div>
          <h4 class="text-xs font-extrabold text-slate-900 dark:text-white">Save & Print (F8)</h4>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">
            Press <kbd class="kbd-badge">F4</kbd> for charges, <kbd class="kbd-badge">F8</kbd> / <kbd class="kbd-badge">Ctrl+S</kbd> to save bill.
          </p>
          <div class="mt-3 text-[10px] font-mono font-bold text-slate-400">PDF & Excel export</div>
        </div>
      </div>
    </section>

    <!-- Keyboard Shortcuts Reference Table -->
    <section class="space-y-4">
      <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        Sales Page Keyboard Shortcuts Matrix
      </h3>

      <div class="bg-white dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden shadow-sm">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-700">
              <th class="px-4 py-3">Shortcut Key</th>
              <th class="px-4 py-3">Context / Scope</th>
              <th class="px-4 py-3">Action Performed</th>
              <th class="px-4 py-3">Target Focus Restoration</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-700 font-medium">
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-2.5 font-bold"><kbd class="kbd-badge">Enter</kbd></td>
              <td class="px-4 py-2.5 text-slate-500">Any Input / Select</td>
              <td class="px-4 py-2.5">Advances focus to the next input field. Toggles checkboxes.</td>
              <td class="px-4 py-2.5 text-slate-400">Next field</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-2.5 font-bold"><kbd class="kbd-badge">Backspace</kbd></td>
              <td class="px-4 py-2.5 text-slate-500">Empty Input Field</td>
              <td class="px-4 py-2.5">Reverses focus to the previous input field when value is empty.</td>
              <td class="px-4 py-2.5 text-slate-400">Previous field</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-2.5 font-bold"><kbd class="kbd-badge">Shift + Enter</kbd></td>
              <td class="px-4 py-2.5 text-slate-500">Narration Textarea</td>
              <td class="px-4 py-2.5">Inserts a multiline newline inside the Narration notes box.</td>
              <td class="px-4 py-2.5 text-slate-400">Stays in Textarea</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750 bg-blue-50/20 dark:bg-blue-950/20">
              <td class="px-4 py-2.5 font-bold text-blue-600 dark:text-blue-400"><kbd class="kbd-badge">F2</kbd></td>
              <td class="px-4 py-2.5">Global / Invoice Form</td>
              <td class="px-4 py-2.5">Opens Goods Stock Browser Modal. Auto-focuses search bar.</td>
              <td class="px-4 py-2.5 font-semibold text-blue-600">Qty input of newly added row</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750 bg-blue-50/20 dark:bg-blue-950/20">
              <td class="px-4 py-2.5 font-bold text-blue-600 dark:text-blue-400"><kbd class="kbd-badge">F3</kbd></td>
              <td class="px-4 py-2.5">Global / Invoice Form</td>
              <td class="px-4 py-2.5">Opens Customer Party Selection Drawer. Auto-focuses search.</td>
              <td class="px-4 py-2.5 font-semibold text-blue-600">PO Reference No input</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750 bg-blue-50/20 dark:bg-blue-950/20">
              <td class="px-4 py-2.5 font-bold text-blue-600 dark:text-blue-400"><kbd class="kbd-badge">F4</kbd></td>
              <td class="px-4 py-2.5">Global / Invoice Form</td>
              <td class="px-4 py-2.5">Opens Other Charges Modal (Freight, Packing, Discounts).</td>
              <td class="px-4 py-2.5 font-semibold text-blue-600">Restores to exact originating field</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-2.5 font-bold"><kbd class="kbd-badge">F5</kbd></td>
              <td class="px-4 py-2.5">Global / Cart Table</td>
              <td class="px-4 py-2.5">Adds a customizable Service Line item to the cart table.</td>
              <td class="px-4 py-2.5 text-slate-400">Service Name input</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750 bg-emerald-50/20 dark:bg-emerald-950/20">
              <td class="px-4 py-2.5 font-bold text-emerald-600 dark:text-emerald-400"><kbd class="kbd-badge">F8</kbd> or <kbd class="kbd-badge">Ctrl + S</kbd></td>
              <td class="px-4 py-2.5">Global / Invoice Form</td>
              <td class="px-4 py-2.5">Saves invoice & opens Print Success Modal with PDF/Excel.</td>
              <td class="px-4 py-2.5 font-semibold text-emerald-600">Download PDF button</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-2.5 font-bold text-rose-600"><kbd class="kbd-badge">F9</kbd></td>
              <td class="px-4 py-2.5">Global / Invoice Form</td>
              <td class="px-4 py-2.5">Discards form changes and resets bill back to fresh state.</td>
              <td class="px-4 py-2.5 text-slate-400">Input #1 (Doc Type / Date)</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-2.5 font-bold text-purple-600"><kbd class="kbd-badge">F5</kbd> or <kbd class="kbd-badge">Insert</kbd> or <kbd class="kbd-badge">Ctrl + N</kbd></td>
              <td class="px-4 py-2.5">Stock Browser Modal</td>
              <td class="px-4 py-2.5">Opens Create New Stock Item sub-modal (`CreateStockModal`).</td>
              <td class="px-4 py-2.5 text-slate-400">Item Name input</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-2.5 font-bold text-amber-600"><kbd class="kbd-badge">F3</kbd> or <kbd class="kbd-badge">Ctrl + E</kbd></td>
              <td class="px-4 py-2.5">Stock Browser Modal</td>
              <td class="px-4 py-2.5">Opens Edit Stock Item sub-modal for highlighted stock item.</td>
              <td class="px-4 py-2.5 text-slate-400">Item Name input</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-2.5 font-bold"><kbd class="kbd-badge">↑</kbd> <kbd class="kbd-badge">↓</kbd></td>
              <td class="px-4 py-2.5">Modals / Stock / Charges</td>
              <td class="px-4 py-2.5">Highlights next/previous stock item, batch sub-row, or suggestion.</td>
              <td class="px-4 py-2.5 text-slate-400">Active highlighted row</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-2.5 font-bold"><kbd class="kbd-badge">ESC</kbd></td>
              <td class="px-4 py-2.5">Any Modal / Drawer</td>
              <td class="px-4 py-2.5">Closes modal and restores focus back to originating page input.</td>
              <td class="px-4 py-2.5 text-slate-400">Originating input field</td>
            </tr>
          </tbody>
        </table>
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
:deep(.dark) .kbd-badge {
  color: #e2e8f0;
  background-color: #27272a;
  border-color: #3f3f46;
}
</style>
