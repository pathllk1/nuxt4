<template>
  <div class="space-y-8 text-slate-700 dark:text-zinc-300 pb-12">
    <!-- Hero Header Banner -->
    <div class="bg-gradient-to-r from-emerald-800 via-teal-800 to-indigo-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
      <div class="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none"></div>
      <div class="flex items-center gap-3 mb-3">
        <span class="px-3 py-1 bg-white/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-100">Payroll & HR Suite</span>
        <span class="px-3 py-1 bg-emerald-400/20 backdrop-blur-md text-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest">Statutory Compliant</span>
      </div>
      <h1 class="text-3xl font-black uppercase tracking-tight">Wages & Master Roll Complete Operating Guide</h1>
      <p class="text-xs font-medium text-emerald-100 mt-2 max-w-2xl leading-relaxed">
        Comprehensive operating manual for monthly wage processing, statutory EPF/ESIC calculation rules, salary advance recoveries, bank payout reports, and master roll data auditing.
      </p>
    </div>

    <!-- 5-Step Payroll Execution Flow -->
    <section class="space-y-4">
      <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4.5 h-4.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Sequential Monthly Payroll Execution Process
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
        <!-- Step 1 -->
        <div class="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
          <div class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Step 1</div>
          <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase">Eligibility Check</h3>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">Select payroll month (YYYY-MM). Auto-fetches all unpaid eligible workers from Master Roll.</p>
        </div>

        <!-- Step 2 -->
        <div class="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
          <div class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Step 2</div>
          <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase">Days & Rates Entry</h3>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">Enter Per Day Wage Rate & Working Days. Gross Salary auto-calculates in real time.</p>
        </div>

        <!-- Step 3 -->
        <div class="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
          <div class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Step 3</div>
          <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase">Statutory Deductions</h3>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">EPF (12% max ₹1,800) & ESIC (0.75% rounded up) auto-compute according to Indian Labor laws.</p>
        </div>

        <!-- Step 4 -->
        <div class="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
          <div class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Step 4</div>
          <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase">Advance Recovery</h3>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">Apply monthly advance deductions & benefits to compute exact Net Payable Salary.</p>
        </div>

        <!-- Step 5 -->
        <div class="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm relative overflow-hidden">
          <div class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Step 5</div>
          <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase">Payout & Reports</h3>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">Process bulk payout, download Bank Advice Excel, EPF/ESIC returns, and PDF Wage Slips.</p>
        </div>
      </div>
    </section>

    <!-- Mathematical Formula Reference Table -->
    <section class="space-y-4">
      <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4.5 h-4.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Statutory Calculation Formulas & Compliance Rules
      </h2>

      <div class="bg-white dark:bg-zinc-800 rounded-3xl border border-slate-200 dark:border-zinc-700 overflow-x-auto shadow-sm">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-700">
              <th class="px-4 py-3">Component / Field</th>
              <th class="px-4 py-3">Formula / Logic Rule</th>
              <th class="px-4 py-3">Statutory Ceiling / Threshold</th>
              <th class="px-4 py-3">Example Output</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-700 font-medium">
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">Gross Salary</td>
              <td class="px-4 py-3 font-mono text-[11px]">Per Day Wage Rate × Working Days</td>
              <td class="px-4 py-3 text-slate-500">No ceiling</td>
              <td class="px-4 py-3 font-bold text-slate-900 dark:text-white">₹500 × 26 = ₹13,000.00</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750 bg-emerald-50/20 dark:bg-emerald-950/20">
              <td class="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">EPF Employee Contribution</td>
              <td class="px-4 py-3 font-mono text-[11px]">min(round(Gross × 12%), 1800)</td>
              <td class="px-4 py-3 font-bold text-emerald-600">Maximum ₹1,800 per month</td>
              <td class="px-4 py-3 font-bold text-emerald-600">12% of ₹13,000 = ₹1,560.00</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750 bg-emerald-50/20 dark:bg-emerald-950/20">
              <td class="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">ESIC Employee Contribution</td>
              <td class="px-4 py-3 font-mono text-[11px]">ceil(Gross × 0.75%)</td>
              <td class="px-4 py-3 text-slate-500">Applicable if Gross ≤ ₹21,000</td>
              <td class="px-4 py-3 font-bold text-emerald-600">0.75% of ₹13,000 = ₹98.00</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750">
              <td class="px-4 py-3 font-bold text-amber-600">Advance Recovery</td>
              <td class="px-4 py-3 font-mono text-[11px]">Deducted from active advances ledger</td>
              <td class="px-4 py-3 text-slate-500">Cannot exceed Net Salary</td>
              <td class="px-4 py-3 font-bold text-amber-600">₹1,000.00 advance recovered</td>
            </tr>
            <tr class="hover:bg-slate-50 dark:hover:bg-zinc-750 bg-indigo-50/20 dark:bg-indigo-950/20">
              <td class="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">Net Payable Salary</td>
              <td class="px-4 py-3 font-mono text-[11px]">Gross + Benefits - (EPF + ESIC + Advances + Deductions)</td>
              <td class="px-4 py-3 font-semibold text-indigo-600">Final Bank Transfer Amount</td>
              <td class="px-4 py-3 font-bold text-indigo-600">₹13,000 - ₹1,560 - ₹98 - ₹1,000 = ₹10,342.00</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Master Roll & Data Quality Audit -->
    <section class="space-y-4">
      <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <svg class="w-4.5 h-4.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Master Roll & Compliance Data Audit Standard
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-2">
          <div class="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Aadhaar & KYC Audit</div>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
            Requires valid 12-digit Aadhaar number for statutory EPFO seeding and identity verification before wage calculation.
          </p>
        </div>

        <div class="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-2">
          <div class="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Bank Account & IFSC Audit</div>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
            Verifies bank account number and 11-character IFSC code format for error-free automated bank transfer advice generation.
          </p>
        </div>

        <div class="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm space-y-2">
          <div class="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">UAN & ESIC IP Audit</div>
          <p class="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">
            Checks 12-digit Universal Account Number (UAN) and 17-digit ESIC Insurance Number for monthly return file exports.
          </p>
        </div>
      </div>
    </section>

    <!-- Key Operations & Reports Summary -->
    <section class="bg-slate-900 text-white rounded-3xl p-8 shadow-xl space-y-4">
      <h2 class="text-sm font-black uppercase tracking-wider text-teal-400 flex items-center gap-2">
        <span>⚡</span> Available Wages Reports & Export Actions
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300">
        <div>
          <div class="font-extrabold text-white mb-1">🏦 Bank Advice Export</div>
          <p class="leading-relaxed">Generates formatted Excel report with employee bank accounts, IFSC codes, net payable wages, and payment mode for direct bank bulk transfer upload.</p>
        </div>

        <div>
          <div class="font-extrabold text-white mb-1">🏛 EPF & ESIC Return File</div>
          <p class="leading-relaxed">Exports monthly statutory compliance data formatted for EPFO ECR upload and ESIC monthly portal filings.</p>
        </div>

        <div>
          <div class="font-extrabold text-white mb-1">📄 PDF Wage Slips & Bulk ZIP</div>
          <p class="leading-relaxed">Generates individual PDF wage slips with detailed earnings & deductions breakdown, or downloads all employee slips in a single compressed ZIP archive.</p>
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
}
:deep(.dark) .kbd-badge {
  color: #e2e8f0;
  background-color: #27272a;
  border-color: #3f3f46;
}
</style>
