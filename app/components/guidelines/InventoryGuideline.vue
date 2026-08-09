<template>
  <div class="space-y-8 text-slate-700 dark:text-zinc-300">
    <div class="bg-gradient-to-r from-emerald-700 to-teal-800 rounded-3xl p-6 text-white shadow-xl">
      <div class="flex items-center gap-3 mb-2">
        <span class="px-2.5 py-1 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest">Inventory & Batches</span>
      </div>
      <h2 class="text-2xl font-black uppercase tracking-tight">Stock & Batch Management Guide</h2>
      <p class="text-xs font-medium text-emerald-100 mt-1 max-w-xl">
        Rules for browsing items, expanding multi-batch stock items, selecting specific batch numbers, and registering new inventory on the fly.
      </p>
    </div>

    <div class="space-y-4">
      <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Multi-Batch Stock Selection Rules</h3>
      <div class="bg-white dark:bg-zinc-800/80 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3">
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">1</div>
          <div>
            <h4 class="text-xs font-extrabold text-slate-900 dark:text-white">Expanding Multi-Batch Items</h4>
            <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Highlighting a stock item with multiple batches and pressing <kbd class="kbd-badge">Enter</kbd> expands its batch rows and automatically places active focus on <strong>Batch #1</strong>.
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">2</div>
          <div>
            <h4 class="text-xs font-extrabold text-slate-900 dark:text-white">Selecting a Specific Batch</h4>
            <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Press <kbd class="kbd-badge">↓</kbd> or <kbd class="kbd-badge">↑</kbd> to move focus across the batch sub-rows. Press <kbd class="kbd-badge">Enter</kbd> on your desired batch to select it into the invoice cart.
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">3</div>
          <div>
            <h4 class="text-xs font-extrabold text-slate-900 dark:text-white">Registering New Stock Items</h4>
            <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Press <kbd class="kbd-badge">F5</kbd> or <kbd class="kbd-badge">Ctrl + N</kbd> or <kbd class="kbd-badge">Insert</kbd> inside the Stock Browser to open the Stock Creation Modal.
            </p>
          </div>
        </div>
      </div>
    </div>
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
}
:deep(.dark) .kbd-badge {
  color: #e2e8f0;
  background-color: #27272a;
  border-color: #3f3f46;
}
</style>
