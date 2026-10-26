// components/ToastNotificationComponent.js
(function (global) {
  'use strict';

  const ToastNotificationComponent = {
    inject: ['notifications'],
    methods: {
      getStyles(type) {
        if (type === 'success') {
          return 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-md shadow-emerald-500/10';
        }
        if (type === 'error') {
          return 'bg-rose-50 border-rose-300 text-rose-900 shadow-md shadow-rose-500/10';
        }
        if (type === 'warning') {
          return 'bg-amber-50 border-amber-300 text-amber-900 shadow-md shadow-amber-500/10';
        }
        return 'bg-blue-50 border-blue-300 text-blue-900 shadow-md shadow-blue-500/10';
      }
    },
    template: `
      <div class="fixed bottom-4 right-4 z-[100] flex flex-col space-y-1.5 pointer-events-none max-w-sm w-full" style="z-index: 100;">
        <div
          v-for="item in notifications.items"
          :key="item.id"
          :class="getStyles(item.type)"
          class="pointer-events-auto border rounded-lg p-2.5 shadow-lg flex items-start justify-between space-x-2 transition-all transform duration-200"
        >
          <div class="flex items-start space-x-2">
            <!-- Icon with vibrant color -->
            <svg v-if="item.type === 'success'" class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else-if="item.type === 'error'" class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <svg v-else-if="item.type === 'warning'" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <svg v-else class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>

            <span class="text-xs font-semibold leading-relaxed">{{ item.message }}</span>
          </div>

          <button
            type="button"
            @click="notifications.remove(item.id)"
            class="text-slate-400 hover:text-slate-700 rounded p-0.5 transition-colors cursor-pointer"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    `
  };

  global.ToastNotificationComponent = ToastNotificationComponent;
})(window);
