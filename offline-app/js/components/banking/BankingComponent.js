// components/banking/BankingComponent.js - 100% Replication of Nuxt 4 Banking Hub
(function (global) {
  'use strict';

  global.BankingComponent = {
    name: 'BankingComponent',
    props: {
      bankingState: {
        type: Object,
        required: true
      }
    },
    emits: ['open-voucher'],
    setup(props, { emit }) {
      const { ref, computed, watch, onMounted } = Vue;
      const {
        bankAccounts,
        loading,
        selectedHistoryAcc,
        history,
        historyLoading,
        totalLiquidity,
        defaultAccount,
        fetchBankAccounts,
        createBankAccount,
        updateBankAccount,
        deleteBankAccount,
        viewHistory
      } = props.bankingState;

      const activeTab = ref('accounts');

      // Modal State
      const showModal = ref(false);
      const isEdit = ref(false);
      const editingId = ref(null);
      const form = ref({
        account_name: '',
        account_holder_name: '',
        bank_name: '',
        branch_name: '',
        account_number: '',
        ifsc_code: '',
        account_type: 'CURRENT',
        upi_id: '',
        notes: '',
        opening_balance: 0,
        balance_type: 'DR',
        is_default: false,
        status: 'ACTIVE'
      });

      // Statement Cleaner State
      const excelLoading = ref(false);
      const excelSheets = ref([]);
      const selectedSheetIndex = ref(0);
      const firstRowIsHeader = ref(true);
      const cleanDescriptionEnabled = ref(true);
      const excelSearchQuery = ref('');
      const excelPage = ref(1);
      const excelPageSize = 25;

      const openCreateModal = () => {
        isEdit.value = false;
        editingId.value = null;
        form.value = {
          account_name: '',
          account_holder_name: '',
          bank_name: '',
          branch_name: '',
          account_number: '',
          ifsc_code: '',
          account_type: 'CURRENT',
          upi_id: '',
          notes: '',
          opening_balance: 0,
          balance_type: 'DR',
          is_default: bankAccounts.value.length === 0,
          status: 'ACTIVE'
        };
        showModal.value = true;
      };

      const openEditModal = (acc) => {
        isEdit.value = true;
        editingId.value = acc.id;
        form.value = {
          account_name: acc.account_name,
          account_holder_name: acc.account_holder_name || '',
          bank_name: acc.bank_name,
          branch_name: acc.branch_name || '',
          account_number: acc.account_number,
          ifsc_code: acc.ifsc_code,
          account_type: acc.account_type || 'CURRENT',
          upi_id: acc.upi_id || '',
          notes: acc.notes || '',
          opening_balance: acc.opening_balance || 0,
          balance_type: acc.balance_type || 'DR',
          is_default: Boolean(acc.is_default),
          status: acc.status || 'ACTIVE'
        };
        showModal.value = true;
      };

      const saveAccount = async () => {
        if (!form.value.account_name || !form.value.bank_name || !form.value.account_number) {
          alert('Please fill in Account Name, Bank Name, and Account Number.');
          return;
        }

        if (isEdit.value) {
          const ok = await updateBankAccount(editingId.value, form.value);
          if (ok) showModal.value = false;
        } else {
          const ok = await createBankAccount(form.value);
          if (ok) showModal.value = false;
        }
      };

      const confirmDelete = async (acc) => {
        if (confirm(`Are you sure you want to delete bank account "${acc.account_name}"?`)) {
          await deleteBankAccount(acc);
        }
      };

      // Statement Upload & Parsing via bundled ExcelJS
      const handleFileUpload = async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        excelLoading.value = true;
        try {
          if (typeof ExcelJS === 'undefined') {
            throw new Error('ExcelJS library is missing');
          }
          const buffer = await file.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);

          const sheets = [];
          workbook.eachSheet((worksheet, sheetId) => {
            const rawRows = [];
            worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
              const vals = [];
              row.eachCell({ includeEmpty: true }, (cell) => {
                let v = cell.value;
                if (v && typeof v === 'object') {
                  v = v.result || v.text || JSON.stringify(v);
                }
                vals.push(v !== null && v !== undefined ? String(v) : '');
              });
              rawRows.push(vals);
            });
            if (rawRows.length > 0) {
              sheets.push({ name: worksheet.name, rawRows });
            }
          });

          excelSheets.value = sheets;
          selectedSheetIndex.value = 0;
          excelPage.value = 1;
        } catch (err) {
          console.error('Error parsing file:', err);
          alert('Failed to parse bank statement: ' + err.message);
        } finally {
          excelLoading.value = false;
          event.target.value = '';
        }
      };

      const cleanBankDescription = (str) => {
        if (!str) return '';
        let s = String(str).trim();
        // Remove common banking prefixes
        s = s.replace(/^(UPI|IMPS|NEFT|RTGS|ACH|POS|ATM|INF|BIL|E-COMM|CMS)[-\/\s:]+/i, '');
        // Remove long reference IDs like 123456789012
        s = s.replace(/\b\d{10,24}\b/g, '');
        // Remove trailing slashes and multiple spaces
        s = s.replace(/[\/\\-]+$/g, '').replace(/\s+/g, ' ').trim();
        return s || str;
      };

      const currentSheet = computed(() => {
        return excelSheets.value[selectedSheetIndex.value] || null;
      });

      const parsedHeaders = computed(() => {
        if (!currentSheet.value || !currentSheet.value.rawRows.length) return [];
        if (firstRowIsHeader.value) {
          return currentSheet.value.rawRows[0];
        }
        return currentSheet.value.rawRows[0].map((_, i) => `Col ${i + 1}`);
      });

      const parsedDataRows = computed(() => {
        if (!currentSheet.value || !currentSheet.value.rawRows.length) return [];
        const rows = firstRowIsHeader.value ? currentSheet.value.rawRows.slice(1) : currentSheet.value.rawRows;
        if (!cleanDescriptionEnabled.value) return rows;

        // Try to identify narration / description column
        return rows.map((r) => {
          return r.map((cell) => {
            if (cell.length > 15 && /[A-Z0-9\/_-]{10,}/.test(cell)) {
              return cleanBankDescription(cell);
            }
            return cell;
          });
        });
      });

      const filteredExcelRows = computed(() => {
        if (!excelSearchQuery.value.trim()) return parsedDataRows.value;
        const q = excelSearchQuery.value.toLowerCase();
        return parsedDataRows.value.filter((row) =>
          row.some((cell) => String(cell).toLowerCase().includes(q))
        );
      });

      const paginatedExcelRows = computed(() => {
        const start = (excelPage.value - 1) * excelPageSize;
        return filteredExcelRows.value.slice(start, start + excelPageSize);
      });

      const maxExcelPages = computed(() => {
        return Math.ceil(filteredExcelRows.value.length / excelPageSize) || 1;
      });

      const openVoucherFromExcelRow = (row) => {
        // Find potential amount, date, description in row
        let amount = 0;
        let narration = '';
        let dateStr = new Date().toISOString().split('T')[0];

        for (const cell of row) {
          const cleanCell = String(cell).replace(/[,\s₹]/g, '');
          if (!isNaN(cleanCell) && Number(cleanCell) > 0 && Number(cleanCell) < 10000000 && !amount) {
            amount = Number(cleanCell);
          } else if (/\d{4}-\d{2}-\d{2}|\d{2}[-\/]\d{2}[-\/]\d{2,4}/.test(cell)) {
            dateStr = cell;
          } else if (cell.length > 5 && !narration) {
            narration = cell;
          }
        }

        emit('open-voucher', {
          vtype: 'PAYMENT',
          vdate: dateStr,
          mainAccount: defaultAccount.value ? defaultAccount.value.id : null,
          narration: narration ? `Statement: ${narration}` : 'Bank statement transaction',
          amount
        });
      };

      const downloadCleanedExcel = async () => {
        if (!currentSheet.value) return;
        try {
          const workbook = new ExcelJS.Workbook();
          const sheet = workbook.addWorksheet(currentSheet.value.name || 'Cleaned Statement');
          sheet.addRow(parsedHeaders.value);
          for (const r of parsedDataRows.value) {
            sheet.addRow(r);
          }
          const buf = await workbook.xlsx.writeBuffer();
          const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Cleaned_Bank_Statement_${new Date().toISOString().split('T')[0]}.xlsx`;
          a.click();
          URL.revokeObjectURL(a);
        } catch (err) {
          alert('Export failed: ' + err.message);
        }
      };

      // 3. Bulk Payments & Salary Hub State
      const bulkBankAccountId = ref('');
      const bulkPaymentDate = ref(new Date().toISOString().split('T')[0]);
      const bulkPaymentMode = ref('NEFT');
      const bulkChequeNo = ref('');
      const bulkNarration = ref('Bulk Payout Batch');
      const bulkBeneficiaries = ref([
        { partyName: '', accountType: 'VENDOR', amount: 0, narration: '' }
      ]);
      const bulkSubmitting = ref(false);

      watch(
        () => defaultAccount.value,
        (acc) => {
          if (acc && !bulkBankAccountId.value) {
            bulkBankAccountId.value = acc.id;
          }
        },
        { immediate: true }
      );

      const selectedBulkBank = computed(() => {
        return bankAccounts.value.find((b) => b.id === Number(bulkBankAccountId.value)) || defaultAccount.value;
      });

      const stagedTotalAmount = computed(() => {
        return bulkBeneficiaries.value.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
      });

      const addBulkRow = () => {
        bulkBeneficiaries.value.push({ partyName: '', accountType: 'VENDOR', amount: 0, narration: '' });
      };

      const removeBulkRow = (idx) => {
        if (bulkBeneficiaries.value.length > 1) {
          bulkBeneficiaries.value.splice(idx, 1);
        }
      };

      const executeBulkPayout = async () => {
        if (!bulkBankAccountId.value) {
          alert('Please select a source bank account');
          return;
        }
        const validRows = bulkBeneficiaries.value.filter((b) => b.partyName.trim() && Number(b.amount) > 0);
        if (!validRows.length) {
          alert('Please add at least one beneficiary with name and amount');
          return;
        }

        bulkSubmitting.value = true;
        try {
          const res = await global.ledgerService.postBulkPaymentBatch({
            bankAccountId: bulkBankAccountId.value,
            paymentDate: bulkPaymentDate.value,
            paymentMode: bulkPaymentMode.value,
            chequeNo: bulkChequeNo.value,
            narration: bulkNarration.value,
            beneficiaries: validRows
          });
          alert(`Bulk Payout #${res.voucherNo} posted successfully! Total: ₹${res.totalDisbursed}`);
          await fetchBankAccounts();
          bulkBeneficiaries.value = [{ partyName: '', accountType: 'VENDOR', amount: 0, narration: '' }];
          activeTab.value = 'accounts';
        } catch (err) {
          alert('Bulk payout failed: ' + err.message);
        } finally {
          bulkSubmitting.value = false;
        }
      };

      onMounted(() => {
        fetchBankAccounts();
      });

      return {
        activeTab,
        bankAccounts,
        loading,
        selectedHistoryAcc,
        history,
        historyLoading,
        totalLiquidity,
        defaultAccount,
        showModal,
        isEdit,
        form,
        openCreateModal,
        openEditModal,
        saveAccount,
        confirmDelete,
        viewHistory,
        handleFileUpload,
        excelLoading,
        excelSheets,
        selectedSheetIndex,
        currentSheet,
        firstRowIsHeader,
        cleanDescriptionEnabled,
        excelSearchQuery,
        excelPage,
        excelPageSize,
        parsedHeaders,
        filteredExcelRows,
        paginatedExcelRows,
        maxExcelPages,
        openVoucherFromExcelRow,
        downloadCleanedExcel,

        // Bulk Payout Bindings
        bulkBankAccountId,
        bulkPaymentDate,
        bulkPaymentMode,
        bulkChequeNo,
        bulkNarration,
        bulkBeneficiaries,
        bulkSubmitting,
        selectedBulkBank,
        stagedTotalAmount,
        addBulkRow,
        removeBulkRow,
        executeBulkPayout
      };
    },
    template: `
      <div class="p-4 py-3 w-full space-y-4">
        <!-- Header -->
        <div class="flex flex-wrap justify-between items-end gap-3">
          <div>
            <div class="flex items-center gap-2 mb-0.5">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">Financial Treasury</span>
            </div>
            <h1 class="text-xl font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">Banking Hub</h1>
            <p class="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">Manage bank accounts, parse/clean bank statements, and monitor real-time treasury liquidity</p>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="activeTab === 'accounts'"
              @click="openCreateModal"
              class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>➕ Add Bank Account</span>
            </button>
          </div>
        </div>

        <!-- Sub Tabs -->
        <div class="bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl flex gap-1 w-fit border border-slate-200 dark:border-zinc-700">
          <button
            type="button"
            @click="activeTab = 'accounts'"
            :class="activeTab === 'accounts' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'"
            class="px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            🏦 Bank Accounts
          </button>
          <button
            type="button"
            @click="activeTab = 'cleaner'"
            :class="activeTab === 'cleaner' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'"
            class="px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            📊 Statement Parser & Cleaner
          </button>
          <button
            type="button"
            @click="activeTab = 'bulk'"
            :class="activeTab === 'bulk' ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'"
            class="px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            ⚡ Bulk Payments & Salary Hub
          </button>
        </div>

        <!-- TAB 1: BANK ACCOUNTS -->
        <template v-if="activeTab === 'accounts'">
          <!-- KPI Strip -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border-l-4 border-l-blue-500 border border-slate-200 dark:border-zinc-800 shadow-xs">
              <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Total Accounts</p>
              <div class="text-xl font-black text-slate-900 dark:text-white mt-0.5">{{ bankAccounts.length }}</div>
            </div>
            <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border-l-4 border-l-emerald-500 border border-slate-200 dark:border-zinc-800 shadow-xs">
              <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Active Liquidity</p>
              <div class="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">₹{{ totalLiquidity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
            </div>
            <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border-l-4 border-l-violet-500 border border-slate-200 dark:border-zinc-800 shadow-xs">
              <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Primary Channel</p>
              <div class="text-sm font-black text-slate-900 dark:text-white truncate mt-1">{{ defaultAccount ? defaultAccount.bank_name : 'None Set' }}</div>
            </div>
            <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border-l-4 border-l-amber-500 border border-slate-200 dark:border-zinc-800 shadow-xs">
              <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Linked COA Heads</p>
              <div class="text-xl font-black text-slate-900 dark:text-white mt-0.5">{{ bankAccounts.length }}</div>
            </div>
          </div>

          <!-- Accounts List & History Drawer Grid -->
          <div class="grid grid-cols-1 gap-4" :class="selectedHistoryAcc ? 'lg:grid-cols-3' : ''">
            <!-- Account Cards -->
            <div :class="selectedHistoryAcc ? 'lg:col-span-2' : ''" class="space-y-3">
              <div v-if="loading" class="p-10 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <span class="inline-block animate-spin text-2xl">⏳</span>
                <p class="text-xs font-bold text-slate-500 mt-2 uppercase tracking-wider">Loading bank accounts...</p>
              </div>

              <div
                v-for="acc in bankAccounts"
                :key="acc.id"
                class="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-blue-400 shadow-xs transition-all flex flex-col md:flex-row justify-between gap-4"
              >
                <div class="flex gap-4">
                  <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl shrink-0 font-black">
                    🏛️
                  </div>
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <h3 class="text-base font-black text-slate-900 dark:text-white leading-tight">{{ acc.account_name }}</h3>
                      <span v-if="acc.is_default" class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Primary
                      </span>
                      <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider" :class="acc.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' : 'bg-slate-200 text-slate-700'">
                        {{ acc.status }}
                      </span>
                    </div>
                    <p class="text-xs font-bold text-slate-500 dark:text-zinc-400">{{ acc.bank_name }} <span class="mx-1 text-slate-300">|</span> {{ acc.branch_name || 'N/A' }} <span class="mx-1 text-slate-300">|</span> <span class="uppercase text-[10px] text-indigo-600 dark:text-indigo-400 font-black">{{ acc.account_type }}</span></p>

                    <div class="grid grid-cols-2 gap-4 mt-2.5">
                      <div>
                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">Account Number</p>
                        <p class="text-xs font-bold text-slate-800 dark:text-zinc-200 font-mono">{{ acc.account_number }}</p>
                      </div>
                      <div>
                        <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">IFSC Code</p>
                        <p class="text-xs font-bold text-slate-800 dark:text-zinc-200 font-mono">{{ acc.ifsc_code }}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex flex-col items-start md:items-end justify-between gap-3">
                  <div class="md:text-right">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-wider">GL Balance</p>
                    <div class="text-lg font-black font-mono leading-none" :class="acc.balanceType === 'DR' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                      ₹{{ (acc.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                      <span class="text-[9px] ml-0.5 font-bold uppercase">{{ acc.balanceType || 'DR' }}</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <button
                      @click="viewHistory(acc)"
                      title="View Transaction History"
                      class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold transition cursor-pointer"
                    >
                      🕒 History
                    </button>
                    <button
                      @click="openEditModal(acc)"
                      title="Edit Account"
                      class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold transition cursor-pointer"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      @click="confirmDelete(acc)"
                      title="Delete Account"
                      class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 text-xs font-bold transition cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="!loading && bankAccounts.length === 0" class="p-12 text-center bg-white dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-800">
                <span class="text-4xl block mb-2">🏦</span>
                <h3 class="text-base font-black text-slate-800 dark:text-white">No Bank Accounts Configured</h3>
                <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Add your company bank account to enable bank payments, receipts, contra transfers, and automated ledger postings.</p>
                <button @click="openCreateModal" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer">
                  Add First Bank Account
                </button>
              </div>
            </div>

            <!-- Transaction History Drawer -->
            <div v-if="selectedHistoryAcc" class="space-y-3">
              <div class="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 mb-3">
                  <div>
                    <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">{{ selectedHistoryAcc.account_name }}</h3>
                    <p class="text-[10px] text-slate-400 font-mono">Recent Activity</p>
                  </div>
                  <button @click="selectedHistoryAcc = null" class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center font-bold text-xs cursor-pointer">
                    ✕
                  </button>
                </div>

                <div v-if="historyLoading" class="py-8 text-center text-xs text-slate-400 font-bold">
                  Loading transactions...
                </div>

                <div v-else-if="history.length > 0" class="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  <div
                    v-for="h in history"
                    :key="h.id"
                    class="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-850/60 border border-slate-100 dark:border-zinc-800 flex justify-between items-start gap-2"
                  >
                    <div>
                      <p class="text-[9px] font-black text-slate-400 font-mono">{{ h.transactionDate }} · {{ h.voucherNo }}</p>
                      <p class="text-xs font-bold text-slate-800 dark:text-zinc-200 line-clamp-1 mt-0.5">{{ h.narration || h.accountHead }}</p>
                    </div>
                    <p class="text-xs font-black font-mono whitespace-nowrap mt-0.5" :class="h.debitAmount > 0 ? 'text-emerald-600' : 'text-rose-600'">
                      {{ h.debitAmount > 0 ? '+' : '-' }} ₹{{ (h.debitAmount || h.creditAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                    </p>
                  </div>
                </div>

                <div v-else class="py-8 text-center text-xs text-slate-400 font-medium italic">
                  No transactions recorded for this account.
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- TAB 2: STATEMENT PARSER & CLEANER -->
        <template v-else-if="activeTab === 'cleaner'">
          <div class="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
            <!-- Upload Area (if no sheet loaded) -->
            <div v-if="excelSheets.length === 0" class="p-10 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl text-center space-y-3">
              <span class="text-4xl block">📊</span>
              <h3 class="text-base font-black text-slate-900 dark:text-white">Upload Bank Statement (Excel .xlsx / CSV)</h3>
              <p class="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                Clean messy bank statement descriptions (strips UPI/NEFT garbage IDs) and convert transactions directly into accounting vouchers with 1 click.
              </p>
              <label class="inline-block mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition">
                <span>Browse Statement File</span>
                <input type="file" accept=".xlsx,.csv" @change="handleFileUpload" class="hidden" />
              </label>
            </div>

            <!-- Statement Loaded View -->
            <div v-else class="space-y-3">
              <!-- Controls Bar -->
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Sheet:</span>
                  <button
                    v-for="(sheet, sIdx) in excelSheets"
                    :key="sIdx"
                    @click="selectedSheetIndex = sIdx; excelPage = 1"
                    :class="selectedSheetIndex === sIdx ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'"
                    class="px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer"
                  >
                    📄 {{ sheet.name }}
                  </button>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    @click="downloadCleanedExcel"
                    class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>📥 Export Cleaned Excel</span>
                  </button>
                  <button
                    @click="excelSheets = []"
                    class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              <!-- Options & Search Bar -->
              <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-850 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                <div class="flex items-center gap-4 flex-wrap text-xs font-bold text-slate-700 dark:text-zinc-300">
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" v-model="firstRowIsHeader" class="w-4 h-4 text-blue-600 rounded" />
                    <span>First row contains headers</span>
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer border-l border-slate-200 dark:border-zinc-700 pl-4">
                    <input type="checkbox" v-model="cleanDescriptionEnabled" class="w-4 h-4 text-emerald-600 rounded" />
                    <span class="text-emerald-700 dark:text-emerald-400">✨ Auto-clean bank descriptions</span>
                  </label>
                </div>

                <div class="w-64">
                  <input
                    v-model="excelSearchQuery"
                    type="text"
                    placeholder="Search statement rows..."
                    class="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              </div>

              <!-- Data Table -->
              <div class="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-xl">
                <table class="w-full text-left text-xs font-semibold border-collapse">
                  <thead>
                    <tr class="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      <th class="p-2.5 text-center w-12 border-b border-slate-200 dark:border-zinc-700">#</th>
                      <th v-for="(h, hIdx) in parsedHeaders" :key="hIdx" class="p-2.5 border-b border-slate-200 dark:border-zinc-700 truncate max-w-[200px]">
                        {{ h }}
                      </th>
                      <th class="p-2.5 text-center w-20 border-b border-slate-200 dark:border-zinc-700">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-mono text-[11px]">
                    <tr v-for="(row, rIdx) in paginatedExcelRows" :key="rIdx" class="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                      <td class="p-2.5 text-center text-slate-400 font-bold text-[10px]">
                        {{ (excelPage - 1) * excelPageSize + rIdx + 1 }}
                      </td>
                      <td v-for="(cell, cIdx) in row" :key="cIdx" class="p-2.5 truncate max-w-[220px]">
                        {{ cell }}
                      </td>
                      <td class="p-2.5 text-center">
                        <button
                          @click="openVoucherFromExcelRow(row)"
                          title="1-Click Create Voucher from Row"
                          class="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] font-bold cursor-pointer"
                        >
                          + Voucher
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Pagination -->
              <div class="flex items-center justify-between text-xs font-bold text-slate-500 pt-2">
                <span>Showing {{ paginatedExcelRows.length }} of {{ filteredExcelRows.length }} rows</span>
                <div class="flex items-center gap-2">
                  <button
                    :disabled="excelPage <= 1"
                    @click="excelPage--"
                    class="px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                  >
                    Prev
                  </button>
                  <span>Page {{ excelPage }} of {{ maxExcelPages }}</span>
                  <button
                    :disabled="excelPage >= maxExcelPages"
                    @click="excelPage++"
                    class="px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- TAB 3: BULK PAYOUTS & SALARY HUB -->
        <template v-else-if="activeTab === 'bulk'">
          <div class="space-y-4">
            <!-- Top Ribbon -->
            <div class="bg-white dark:bg-zinc-900 p-3 px-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
              <div class="flex items-center gap-3 min-w-[220px]">
                <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                  🏛️
                </div>
                <div>
                  <p class="text-[9px] font-black uppercase text-slate-400">Disbursement Source Bank</p>
                  <p class="font-bold text-slate-800 dark:text-white">{{ selectedBulkBank?.bank_name || 'Select Bank Account' }}</p>
                  <p class="text-[10px] text-blue-600 font-mono font-bold" v-if="selectedBulkBank">
                    Bal: ₹{{ (selectedBulkBank.current_balance || 0).toLocaleString() }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                  💰
                </div>
                <div>
                  <p class="text-[9px] font-black uppercase text-slate-400">Staged Total Payout</p>
                  <p class="text-sm font-mono font-black text-emerald-600">
                    ₹{{ stagedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-lg">
                  👥
                </div>
                <div>
                  <p class="text-[9px] font-black uppercase text-slate-400">Beneficiaries</p>
                  <p class="text-sm font-bold text-slate-800 dark:text-white">
                    {{ bulkBeneficiaries.length }} recipients
                  </p>
                </div>
              </div>

              <button 
                @click="executeBulkPayout" 
                :disabled="bulkSubmitting || stagedTotalAmount <= 0"
                class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {{ bulkSubmitting ? 'Posting Batch...' : 'Disburse & Post Vouchers ⚡' }}
              </button>
            </div>

            <!-- Batch Configuration -->
            <div class="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-3">
              <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Batch Header Configuration</h3>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Source Bank *</label>
                  <select v-model="bulkBankAccountId" class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold">
                    <option v-for="b in bankAccounts" :key="b.id" :value="b.id">
                      {{ b.account_name }} (₹{{ b.current_balance }})
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Disbursement Date</label>
                  <input type="date" v-model="bulkPaymentDate" class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold" />
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Payment Mode</label>
                  <select v-model="bulkPaymentMode" class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold">
                    <option value="NEFT">NEFT / RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI Transfer</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Cheque / Reference No</label>
                  <input type="text" v-model="bulkChequeNo" placeholder="e.g. CHQ-984321" class="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold" />
                </div>
              </div>
            </div>

            <!-- Beneficiaries Staging Table -->
            <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
              <div class="p-3 px-4 bg-slate-50 dark:bg-zinc-800 flex justify-between items-center border-b border-slate-200 dark:border-zinc-700">
                <h3 class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Staged Payout Beneficiaries</h3>
                <button 
                  @click="addBulkRow" 
                  class="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  ➕ Add Recipient
                </button>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50/50 text-[10px] font-black uppercase text-slate-500">
                    <tr>
                      <th class="p-2.5 w-12 text-center">#</th>
                      <th class="p-2.5">Beneficiary / Vendor Name *</th>
                      <th class="p-2.5 w-40">Account Category</th>
                      <th class="p-2.5 w-40 text-right">Amount (₹) *</th>
                      <th class="p-2.5">Specific Narration</th>
                      <th class="p-2.5 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
                    <tr v-for="(row, idx) in bulkBeneficiaries" :key="idx">
                      <td class="p-2.5 text-center text-slate-400 font-bold">{{ idx + 1 }}</td>
                      <td class="p-2.5">
                        <input 
                          type="text" 
                          v-model="row.partyName" 
                          placeholder="Vendor / Party Name"
                          class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold" 
                        />
                      </td>
                      <td class="p-2.5">
                        <select v-model="row.accountType" class="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold">
                          <option value="VENDOR">Vendor (Creditor)</option>
                          <option value="EXPENSE">Expense Account</option>
                          <option value="CASUAL_LABOR">Labor Payout</option>
                          <option value="CUSTOMER">Customer (Refund)</option>
                        </select>
                      </td>
                      <td class="p-2.5 text-right">
                        <input 
                          type="number" 
                          min="0" 
                          step="0.01" 
                          v-model.number="row.amount" 
                          class="w-full px-2.5 py-1.5 text-right font-mono font-bold rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-emerald-600" 
                        />
                      </td>
                      <td class="p-2.5">
                        <input 
                          type="text" 
                          v-model="row.narration" 
                          placeholder="e.g. Invoice #842 payment"
                          class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" 
                        />
                      </td>
                      <td class="p-2.5 text-center">
                        <button 
                          @click="removeBulkRow(idx)" 
                          class="text-rose-500 hover:text-rose-700 font-bold cursor-pointer text-sm"
                          title="Remove Line"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </template>

        <!-- ADD / EDIT BANK ACCOUNT MODAL -->
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div class="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center">
              <h3 class="text-sm font-black uppercase tracking-wider">{{ isEdit ? 'Edit Bank Account' : 'Add New Bank Account' }}</h3>
              <button @click="showModal = false" class="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <div class="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
              <div>
                <label class="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Account Display Name *</label>
                <input v-model="form.account_name" type="text" placeholder="e.g. HDFC Bank - 5678" class="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Bank Name *</label>
                  <input v-model="form.bank_name" type="text" placeholder="e.g. HDFC Bank" class="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
                <div>
                  <label class="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Branch Name</label>
                  <input v-model="form.branch_name" type="text" placeholder="e.g. Pimpri MIDC" class="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Account Number *</label>
                  <input v-model="form.account_number" type="text" placeholder="e.g. 50200012345678" class="w-full px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
                <div>
                  <label class="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">IFSC Code *</label>
                  <input v-model="form.ifsc_code" type="text" placeholder="e.g. HDFC0001234" class="w-full px-3 py-1.5 text-xs font-mono font-semibold uppercase rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Account Type</label>
                  <select v-model="form.account_type" class="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                    <option value="CURRENT">CURRENT</option>
                    <option value="SAVINGS">SAVINGS</option>
                    <option value="OD">OVERDRAFT (OD)</option>
                    <option value="CC">CASH CREDIT (CC)</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">UPI ID</label>
                  <input v-model="form.upi_id" type="text" placeholder="e.g. company@hdfcbank" class="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" />
                </div>
              </div>

              <div v-if="!isEdit" class="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                <div>
                  <label class="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Opening Balance (₹)</label>
                  <input v-model.number="form.opening_balance" type="number" min="0" step="0.01" class="w-full px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
                </div>
                <div>
                  <label class="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Balance Type</label>
                  <select v-model="form.balance_type" class="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                    <option value="DR">DR (Positive Asset)</option>
                    <option value="CR">CR (Overdraft / Liability)</option>
                  </select>
                </div>
              </div>

              <div class="flex items-center gap-3 pt-1">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-zinc-300">
                  <input type="checkbox" v-model="form.is_default" class="w-4 h-4 text-blue-600 rounded" />
                  <span>Set as Primary / Default Account</span>
                </label>
              </div>
            </div>

            <div class="px-5 py-3 bg-slate-50 dark:bg-zinc-800/80 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
              <button @click="showModal = false" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-zinc-300 cursor-pointer">
                Cancel
              </button>
              <button @click="saveAccount" class="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer">
                {{ isEdit ? 'Update Account' : 'Save Account' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    `
  };
})(typeof window !== 'undefined' ? window : this);
