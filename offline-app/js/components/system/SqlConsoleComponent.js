// components/SqlConsoleComponent.js
(function (global) {
  'use strict';

  const SqlConsoleComponent = {
    props: {
      engineType: { type: String, default: 'WebSQL' },
      isNative: { type: Boolean, default: false }
    },
    data() {
      return {
        query: 'SELECT * FROM stocks ORDER BY id DESC;',
        result: null,
        error: null,
        loading: false,
        executionTime: 0,
        presets: [
          { label: 'All Stocks', sql: 'SELECT * FROM stocks ORDER BY id DESC;', color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
          { label: 'All Vouchers', sql: 'SELECT * FROM bills ORDER BY id DESC;', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
          { label: 'Parties', sql: 'SELECT * FROM parties ORDER BY id DESC;', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
          { label: 'Stock Movements', sql: 'SELECT * FROM stock_reg ORDER BY id DESC LIMIT 25;', color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' }
        ]
      };
    },
    methods: {
      setPreset(sql) {
        this.query = sql;
        this.runSql();
      },
      downloadDb() {
        if (global.WebSqlService && typeof global.WebSqlService.downloadDatabase === 'function') {
          global.WebSqlService.downloadDatabase('accounting_erp_' + new Date().toISOString().slice(0, 10) + '.sqlite');
        }
      },
      async runSql() {
        if (!this.query || !this.query.trim()) return;
        this.loading = true;
        this.error = null;
        this.result = null;
        const start = performance.now();

        try {
          const res = await global.WebSqlService.executeSql(this.query.trim());
          const end = performance.now();
          this.executionTime = Math.round((end - start) * 100) / 100;
          this.result = res;
        } catch (err) {
          this.error = err.message || String(err);
        } finally {
          this.loading = false;
        }
      }
    },
    mounted() {
      this.runSql();
    },
    template: `
      <div class="space-y-3 w-full">
        <!-- SQL Console Card (Light Theme, Compact) -->
        <div class="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 shadow-xs w-full">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-200 gap-2">
            <div>
              <h2 class="text-xs sm:text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <span>SQLite 3 WebAssembly Console</span>
                <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-100 text-blue-700 font-bold border border-blue-200">
                  sql.js WASM
                </span>
              </h2>
              <p class="text-[11px] text-slate-500 mt-0.5">
                Live SQLite 3 engine running in WebAssembly with direct physical database.sqlite file persistence.
              </p>
            </div>

            <!-- Quick Preset Queries with Vibrant Colors -->
            <div class="flex flex-wrap gap-1">
              <button
                v-for="p in presets"
                :key="p.label"
                type="button"
                @click="setPreset(p.sql)"
                :class="p.color"
                class="px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer"
              >
                {{ p.label }}
              </button>
            </div>
          </div>

          <!-- Query Editor Area -->
          <div class="mt-2.5">
            <textarea
              v-model="query"
              rows="2"
              placeholder="Enter SQL statement (e.g. SELECT * FROM items WHERE status = 'active')"
              class="w-full bg-slate-50 font-mono text-xs text-slate-900 border border-slate-300 rounded-md p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-colors"
            ></textarea>
          </div>

          <!-- Run Controls -->
          <div class="mt-2 flex items-center justify-between">
            <div class="flex items-center space-x-2.5 text-[11px] text-slate-500">
              <span v-if="executionTime > 0" class="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                ⚡ {{ executionTime }} ms
              </span>
              <span v-if="result && result.rows" class="font-medium">
                {{ result.rows.length }} row(s) returned
              </span>
              <span v-if="result && result.rowsAffected > 0" class="text-blue-600 font-medium">
                {{ result.rowsAffected }} row(s) affected
              </span>
            </div>

            <div class="flex items-center space-x-2">
              <button
                type="button"
                @click="downloadDb"
                title="Download entire SQLite database as .sqlite file"
                class="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all cursor-pointer shadow-xs"
              >
                💾 Backup .sqlite
              </button>

              <button
                type="button"
                @click="runSql"
                :disabled="loading"
                class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
              >
                <svg v-if="!loading" class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{{ loading ? 'Executing...' : 'Run Query' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Query Error Alert -->
        <div v-if="error" class="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800 text-xs flex items-start space-x-2">
          <svg class="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 class="font-bold text-rose-800">SQL Execution Error</h4>
            <p class="font-mono text-[11px] mt-0.5 text-rose-700">{{ error }}</p>
          </div>
        </div>

        <!-- Query Results Table (Full Width, Compact Light Theme) -->
        <div v-if="result && result.rows && result.rows.length > 0" class="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden w-full">
          <div class="px-3 py-1.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Result Set ({{ result.rows.length }} rows)</span>
            <span class="text-[10px] font-mono text-slate-500">Database: {{ engineType }}</span>
          </div>

          <div class="overflow-x-auto max-h-80 w-full">
            <table class="w-full text-left border-collapse text-xs font-mono">
              <thead class="bg-slate-100 sticky top-0 border-b border-slate-200">
                <tr>
                  <th
                    v-for="col in Object.keys(result.rows[0])"
                    :key="col"
                    class="py-1.5 px-3 text-slate-600 font-bold uppercase tracking-wider whitespace-nowrap text-[10px]"
                  >
                    {{ col }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="(row, idx) in result.rows"
                  :key="idx"
                  class="hover:bg-blue-50/50 transition-colors"
                >
                  <td
                    v-for="col in Object.keys(result.rows[0])"
                    :key="col"
                    class="py-1.5 px-3 whitespace-nowrap text-slate-800 text-[11px]"
                  >
                    {{ row[col] !== null && row[col] !== undefined ? row[col] : 'NULL' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Empty Result Notification -->
        <div v-else-if="result && (!result.rows || result.rows.length === 0)" class="bg-white border border-slate-200 rounded-lg p-4 text-center text-slate-500 text-xs">
          Query executed successfully with 0 rows returned.
        </div>
      </div>
    `
  };

  global.SqlConsoleComponent = SqlConsoleComponent;
})(window);
