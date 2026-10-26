// components/FooterComponent.js
// 100% Dynamic Offline ERP Footer (Zero Dummy / Fake Data)
(function (global) {
  'use strict';

  const FooterComponent = {
    props: {
      firm: { type: Object, default: () => ({}) }
    },
    data() {
      return {
        currentYear: new Date().getFullYear()
      };
    },
    template: `
      <footer class="fixed inset-x-0 bottom-0 w-full bg-gradient-to-r from-teal-500 via-indigo-600 to-teal-500 shadow-lg py-1 px-4 sm:px-6 z-20 flex items-center justify-between text-white select-none h-7 text-[11px]" style="z-index: 20;">
        <!-- Left-Aligned Firm Identity -->
        <div class="space-x-2 font-medium hidden sm:flex items-center">
          <span class="text-white font-bold">{{ firm.name || firm.legal_name || 'Offline ERP' }}</span>
          <span v-if="firm.gstin" class="text-teal-100 font-mono text-[10px]">GSTIN: {{ firm.gstin }}</span>
          <span v-if="firm.state" class="text-teal-200 text-[10px]">({{ firm.state }})</span>
        </div>

        <!-- Center System Copyright & Storage Engine -->
        <p class="text-white font-bold my-0 mx-auto sm:mx-0">
          &copy; {{ currentYear }} {{ firm.name || 'Offline ERP' }} • Local Database Mode
        </p>

        <!-- Right-Aligned Offline Status -->
        <div class="flex items-center gap-2 font-medium">
          <span class="inline-flex items-center gap-1.5 text-emerald-200">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            100% Offline Active
          </span>
        </div>
      </footer>
    `
  };

  global.FooterComponent = FooterComponent;
})(window);
