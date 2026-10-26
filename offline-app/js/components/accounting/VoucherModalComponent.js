// components/accounting/VoucherModalComponent.js - 100% Replication of Nuxt 4 VoucherModal.vue
(function (global) {
  'use strict';

  global.VoucherModalComponent = {
    name: 'VoucherModalComponent',
    props: {
      modelValue: {
        type: Boolean,
        default: false
      },
      initialData: {
        type: Object,
        default: () => ({})
      }
    },
    emits: ['update:modelValue', 'voucher-saved'],
    setup(props, { emit }) {
      const { ref, computed, watch, onMounted, onUnmounted } = Vue;

      const loading = ref(false);
      const isEdit = ref(false);
      const editingVoucherGroupId = ref(null);

      // Liquid Bank & Cash Accounts List
      const liquidAccounts = ref([]);
      const allAccounts = ref([]);
      const parties = ref([]);

      const form = ref({
        vtype: 'PAYMENT',
        vdate: new Date().toISOString().split('T')[0],
        mainAccount: null, // Bank account ID or 'CASH'
        narration: '',
        entries: []
      });

      const loadAccountsAndParties = async () => {
        try {
          // Fetch Bank Accounts
          const bankRes = await global.WebSqlService.executeSql('SELECT * FROM bank_accounts WHERE status = "ACTIVE" ORDER BY is_default DESC');
          const banks = bankRes.rows || [];

          // Cash in Hand
          const cashRes = await global.WebSqlService.executeSql('SELECT SUM(debitAmount) as dr, SUM(creditAmount) as cr FROM ledger WHERE LOWER(accountHead) = "cash in hand"');
          const cashDr = Number(cashRes.rows[0]?.dr) || 0;
          const cashCr = Number(cashRes.rows[0]?.cr) || 0;
          const cashBal = cashDr - cashCr;

          liquidAccounts.value = [
            {
              id: 'CASH',
              accountHead: 'Cash in Hand',
              bankName: 'Petty Cash Register',
              accountType: 'CASH',
              balance: Math.abs(cashBal),
              balanceType: cashBal >= 0 ? 'DR' : 'CR'
            },
            ...banks.map((b) => ({
              id: b.id,
              accountHead: b.account_name,
              bankName: b.bank_name,
              accountType: 'BANK',
              balance: b.current_balance || 0,
              balanceType: b.balance_type || 'DR'
            }))
          ];

          // Fetch All COA Heads
          const coaRes = await global.WebSqlService.executeSql('SELECT account_name, account_type FROM chart_of_accounts WHERE is_active = 1 ORDER BY account_name ASC');
          allAccounts.value = coaRes.rows || [];

          // Fetch Parties
          const partyRes = await global.WebSqlService.executeSql('SELECT id, name, partyType, currentBalance, balanceType FROM parties ORDER BY name ASC');
          parties.value = partyRes.rows || [];
        } catch (err) {
          console.error('Error loading voucher lookup data:', err);
        }
      };

      const initForm = (preset = {}) => {
        const today = new Date().toISOString().split('T')[0];
        const defaultMain = liquidAccounts.value.find((a) => a.id !== 'CASH') || liquidAccounts.value[0];

        form.value = {
          vtype: preset.vtype || 'PAYMENT',
          vdate: preset.vdate || today,
          mainAccount: preset.mainAccount || (defaultMain ? defaultMain.id : 'CASH'),
          narration: preset.narration || '',
          entries: preset.entries && preset.entries.length > 0 ? preset.entries : [
            {
              accountHead: preset.accountHead || '',
              amount: preset.amount || 0,
              debitAmount: preset.amount || 0,
              creditAmount: 0,
              effect: 'ADD',
              partyId: preset.partyId || null,
              tdsEnabled: false,
              tdsRate: 1.0,
              tdsAmount: 0,
              narration: ''
            }
          ]
        };
      };

      watch(
        () => props.modelValue,
        (newVal) => {
          if (newVal) {
            loadAccountsAndParties().then(() => {
              initForm(props.initialData);
            });
          }
        }
      );

      const selectedMainAccountObj = computed(() => {
        return liquidAccounts.value.find((a) => String(a.id) === String(form.value.mainAccount)) || null;
      });

      const mainAccountCurrentBal = computed(() => {
        if (!selectedMainAccountObj.value) return 0;
        const b = selectedMainAccountObj.value.balance;
        return selectedMainAccountObj.value.balanceType === 'DR' ? b : -b;
      });

      // Net voucher total
      const totalVoucherAmount = computed(() => {
        if (form.value.vtype === 'JOURNAL') {
          return form.value.entries.reduce((sum, e) => sum + (Number(e.debitAmount) || 0), 0);
        }
        return form.value.entries.reduce((sum, e) => {
          const amt = Number(e.amount) || 0;
          const tds = e.tdsEnabled ? (Number(e.tdsAmount) || 0) : 0;
          const net = amt - tds;
          return e.effect === 'DEDUCT' ? sum - net : sum + net;
        }, 0);
      });

      const projectedMainAccountBal = computed(() => {
        const cur = mainAccountCurrentBal.value;
        const amt = totalVoucherAmount.value;
        if (form.value.vtype === 'PAYMENT') return cur - amt;
        if (form.value.vtype === 'RECEIPT') return cur + amt;
        if (form.value.vtype === 'CONTRA') return cur - amt;
        return cur;
      });

      // Journal Parity Check
      const journalDebits = computed(() => {
        return form.value.entries.reduce((s, e) => s + (Number(e.debitAmount) || 0), 0);
      });
      const journalCredits = computed(() => {
        return form.value.entries.reduce((s, e) => s + (Number(e.creditAmount) || 0), 0);
      });
      const journalDifference = computed(() => {
        return Math.round(Math.abs(journalDebits.value - journalCredits.value) * 100) / 100;
      });
      const isJournalBalanced = computed(() => {
        return journalDifference.value <= 0.01 && journalDebits.value > 0;
      });

      const addLine = () => {
        form.value.entries.push({
          accountHead: '',
          amount: 0,
          debitAmount: 0,
          creditAmount: 0,
          effect: 'ADD',
          partyId: null,
          tdsEnabled: false,
          tdsRate: 1.0,
          tdsAmount: 0,
          narration: ''
        });
      };

      const removeLine = (index) => {
        if (form.value.entries.length > 1) {
          form.value.entries.splice(index, 1);
        }
      };

      const updateTds = (entry) => {
        if (entry.tdsEnabled && entry.amount > 0) {
          entry.tdsAmount = Math.round((entry.amount * (entry.tdsRate / 100)) * 100) / 100;
        } else {
          entry.tdsAmount = 0;
        }
      };

      const handleHeadSelect = (entry, event) => {
        const val = event.target.value;
        entry.accountHead = val;
        // Check if val matches a party
        const matchedParty = parties.value.find((p) => p.name.toLowerCase() === val.toLowerCase());
        if (matchedParty) {
          entry.partyId = matchedParty.id;
        } else {
          entry.partyId = null;
        }
      };

      const onDebitChange = (entry) => {
        if (Number(entry.debitAmount) > 0) {
          entry.creditAmount = 0;
        }
      };

      const onCreditChange = (entry) => {
        if (Number(entry.creditAmount) > 0) {
          entry.debitAmount = 0;
        }
      };

      const submitVoucher = async () => {
        loading.value = true;
        try {
          if (!global.unifiedPostingService) {
            throw new Error('unifiedPostingService engine not initialized');
          }

          const legs = [];
          const mainAccObj = selectedMainAccountObj.value;
          const isBank = mainAccObj && mainAccObj.id !== 'CASH';
          const bankAccountId = isBank ? mainAccObj.id : null;
          const mainAccountHead = mainAccObj ? mainAccObj.accountHead : 'Cash in Hand';

          if (form.value.vtype === 'PAYMENT') {
            let totalPaid = 0;
            let totalTds = 0;

            for (const e of form.value.entries) {
              const baseAmt = Number(e.amount) || 0;
              if (baseAmt <= 0) continue;
              const tds = e.tdsEnabled ? (Number(e.tdsAmount) || 0) : 0;
              const netAmt = baseAmt - tds;

              // Debit the recipient expense or creditor
              legs.push({
                accountHead: e.accountHead,
                partyId: e.partyId,
                debitAmount: baseAmt,
                creditAmount: 0,
                narration: e.narration || form.value.narration || 'Payment Out'
              });

              if (tds > 0) {
                // Credit TDS Payable liability
                legs.push({
                  accountHead: 'TDS Payable u/s 194C',
                  accountType: 'DUTIES_AND_TAXES',
                  debitAmount: 0,
                  creditAmount: tds,
                  narration: `TDS @ ${e.tdsRate}% withheld on ${e.accountHead}`
                });
                totalTds += tds;
              }

              totalPaid += netAmt;
            }

            // Credit the paying bank / cash account
            legs.push({
              accountHead: mainAccountHead,
              accountType: isBank ? 'BANK' : 'CASH',
              bankAccountId,
              paymentMode: isBank ? 'BANK_TRANSFER' : 'CASH',
              debitAmount: 0,
              creditAmount: totalPaid,
              narration: form.value.narration || 'Payment Out'
            });
          } else if (form.value.vtype === 'RECEIPT') {
            let totalReceived = 0;

            for (const e of form.value.entries) {
              const baseAmt = Number(e.amount) || 0;
              if (baseAmt <= 0) continue;

              // Credit the debtor or income account
              legs.push({
                accountHead: e.accountHead,
                partyId: e.partyId,
                debitAmount: 0,
                creditAmount: baseAmt,
                narration: e.narration || form.value.narration || 'Receipt In'
              });
              totalReceived += baseAmt;
            }

            // Debit the receiving bank / cash account
            legs.push({
              accountHead: mainAccountHead,
              accountType: isBank ? 'BANK' : 'CASH',
              bankAccountId,
              paymentMode: isBank ? 'BANK_TRANSFER' : 'CASH',
              debitAmount: totalReceived,
              creditAmount: 0,
              narration: form.value.narration || 'Receipt In'
            });
          } else if (form.value.vtype === 'CONTRA') {
            // Contra transfer: Paid From mainAccount -> Received by line entry account
            let totalContra = 0;
            for (const e of form.value.entries) {
              const amt = Number(e.amount) || 0;
              if (amt <= 0) continue;

              legs.push({
                accountHead: e.accountHead,
                debitAmount: amt,
                creditAmount: 0,
                narration: `Contra Transfer: To ${e.accountHead}`
              });
              totalContra += amt;
            }

            legs.push({
              accountHead: mainAccountHead,
              accountType: isBank ? 'BANK' : 'CASH',
              bankAccountId,
              debitAmount: 0,
              creditAmount: totalContra,
              narration: `Contra Transfer: From ${mainAccountHead}`
            });
          } else if (form.value.vtype === 'JOURNAL') {
            if (!isJournalBalanced.value) {
              throw new Error(`Journal voucher is unbalanced. Debit ₹${journalDebits.value} != Credit ₹${journalCredits.value}`);
            }

            for (const e of form.value.entries) {
              const dr = Number(e.debitAmount) || 0;
              const cr = Number(e.creditAmount) || 0;
              if (dr === 0 && cr === 0) continue;

              legs.push({
                accountHead: e.accountHead,
                partyId: e.partyId,
                debitAmount: dr,
                creditAmount: cr,
                narration: e.narration || form.value.narration || 'Journal Entry'
              });
            }
          }

          const res = await global.unifiedPostingService.postVoucher({
            voucherType: form.value.vtype,
            transactionDate: form.value.vdate,
            narration: form.value.narration,
            legs,
            createdBy: 'Admin'
          });

          alert(`Voucher ${res.voucherNo} posted successfully!`);
          emit('voucher-saved', res);
          emit('update:modelValue', false);
        } catch (err) {
          console.error('Error posting voucher:', err);
          alert('Failed to post voucher: ' + err.message);
        } finally {
          loading.value = false;
        }
      };

      // Keyboard Shortcut listener (Ctrl+Enter to save, Alt+N for new line, Esc to cancel)
      const onKeyDown = (e) => {
        if (!props.modelValue) return;
        if (e.key === 'Escape') {
          emit('update:modelValue', false);
        } else if (e.ctrlKey && e.key === 'Enter') {
          submitVoucher();
        } else if (e.altKey && e.key.toLowerCase() === 'n') {
          addLine();
          e.preventDefault();
        }
      };

      const previewVoucherNo = ref('');

      const updatePreviewVoucherNo = async () => {
        try {
          if (global.unifiedPostingService && typeof global.unifiedPostingService.previewNextBillNumber === 'function') {
            previewVoucherNo.value = await global.unifiedPostingService.previewNextBillNumber(form.value.vtype, form.value.vdate);
          }
        } catch (e) {
          console.warn('[VoucherModal] Error previewing voucher number:', e);
        }
      };

      watch(() => props.modelValue, (val) => {
        if (val) updatePreviewVoucherNo();
      });
      watch(() => form.value.vtype, () => updatePreviewVoucherNo());
      watch(() => form.value.vdate, () => updatePreviewVoucherNo());

      onMounted(() => {
        window.addEventListener('keydown', onKeyDown);
        updatePreviewVoucherNo();
      });

      onUnmounted(() => {
        window.removeEventListener('keydown', onKeyDown);
      });

      return {
        form,
        loading,
        isEdit,
        previewVoucherNo,
        liquidAccounts,
        allAccounts,
        parties,
        selectedMainAccountObj,
        mainAccountCurrentBal,
        projectedMainAccountBal,
        totalVoucherAmount,
        journalDebits,
        journalCredits,
        journalDifference,
        isJournalBalanced,
        addLine,
        removeLine,
        updateTds,
        handleHeadSelect,
        onDebitChange,
        onCreditChange,
        submitVoucher
      };
    },
    template: `
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
        <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-zinc-800 animate-scale-in">
          <!-- Header -->
          <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex justify-between items-center shadow-md">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg shadow-md font-bold">
                <span>{{ form.vtype === 'PAYMENT' ? '💳' : form.vtype === 'RECEIPT' ? '💰' : form.vtype === 'CONTRA' ? '🔄' : '📝' }}</span>
              </div>
              <div>
                <div class="flex items-center gap-2.5">
                  <h2 class="text-base font-black tracking-tight text-white uppercase">
                    {{ form.vtype === 'PAYMENT' ? 'Payment Voucher' : form.vtype === 'RECEIPT' ? 'Receipt Voucher' : form.vtype === 'CONTRA' ? 'Contra Transfer' : 'Journal Entry' }}
                  </h2>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    {{ form.vtype === 'JOURNAL' ? 'Double-Entry' : 'Tally Single-Entry' }}
                  </span>
                  <span v-if="previewVoucherNo" class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider bg-white/10 text-emerald-300 border border-emerald-400/30" title="Next Sequential Voucher Number (Strictly Read-only Preview)">
                    Next: {{ previewVoucherNo }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-300/80 mt-0.5 font-medium">
                  Automated double-entry General Ledger posting, real-time liquidity tracking & statutory TDS calculation
                </p>
              </div>
            </div>
            <button @click="$emit('update:modelValue', false)" class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer">
              ✕
            </button>
          </div>

          <!-- Main Scrollable Body -->
          <div class="overflow-y-auto flex-1 p-5 space-y-4">
            <!-- Top Controls Row -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <!-- Date -->
              <div class="p-3 bg-slate-50 dark:bg-zinc-850 rounded-xl border border-slate-200 dark:border-zinc-800">
                <label class="block text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
                  📅 Transaction Date
                </label>
                <input v-model="form.vdate" type="date" class="w-full px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-lg cursor-pointer" />
              </div>

              <!-- Voucher Type -->
              <div class="p-3 bg-slate-50 dark:bg-zinc-850 rounded-xl border border-slate-200 dark:border-zinc-800">
                <label class="block text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5">
                  📄 Voucher Type
                </label>
                <select v-model="form.vtype" class="w-full px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-lg cursor-pointer">
                  <option value="PAYMENT">💳 Payment Out (Vendors / Labor / Expenses)</option>
                  <option value="RECEIPT">💰 Receipt In (Clients / Debtors / Income)</option>
                  <option value="CONTRA">🔄 Contra Entry (Bank ↔ Cash Transfer)</option>
                  <option value="JOURNAL">📝 Journal Entry (Adjustments / Double-Entry)</option>
                </select>
              </div>
            </div>

            <!-- Single-Entry Liquid Account Card (Paid From / Receipt To) -->
            <div v-if="form.vtype !== 'JOURNAL'" class="p-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 dark:from-zinc-900 dark:via-zinc-850 dark:to-zinc-900 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl shadow-xs space-y-2.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label class="block text-xs font-black text-blue-950 dark:text-blue-200 uppercase tracking-wide">
                    {{ form.vtype === 'PAYMENT' ? 'Paid From (Bank / Cash Account)' : form.vtype === 'RECEIPT' ? 'Deposit Into (Bank / Cash Account)' : 'Source Account (Transfer Out)' }}
                  </label>
                  <p class="text-[10px] text-slate-500 dark:text-zinc-400">Primary operative treasury account to be credited or debited</p>
                </div>

                <!-- Real-time Balance & Projected Balance Summary -->
                <div v-if="selectedMainAccountObj" class="flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-2xs text-xs">
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-400 text-[10px] uppercase font-bold">Current:</span>
                    <span class="font-mono font-bold" :class="mainAccountCurrentBal >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                      ₹{{ Math.abs(mainAccountCurrentBal).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                      <span class="text-[9px]">{{ mainAccountCurrentBal >= 0 ? 'DR' : 'CR' }}</span>
                    </span>
                  </div>
                  <span class="text-slate-300 font-bold">➔</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-400 text-[10px] uppercase font-bold">Projected:</span>
                    <span class="font-mono font-black" :class="projectedMainAccountBal >= 0 ? 'text-blue-600' : 'text-rose-600'">
                      ₹{{ Math.abs(projectedMainAccountBal).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                      <span class="text-[9px]">{{ projectedMainAccountBal >= 0 ? 'DR' : 'CR' }}</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Main Account Dropdown -->
              <select v-model="form.mainAccount" class="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                <option v-for="acc in liquidAccounts" :key="acc.id" :value="acc.id">
                  {{ acc.accountHead }} ({{ acc.bankName }}) — Current: ₹{{ acc.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }} {{ acc.balanceType }}
                </option>
              </select>
            </div>

            <!-- Particulars / Line Items Table -->
            <div class="space-y-2">
              <div class="flex justify-between items-center px-1">
                <h3 class="text-xs font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📋</span>
                  <span>{{ form.vtype === 'JOURNAL' ? 'Journal Line Entries (Double-Entry)' : 'Particulars (Account Heads & Deductions)' }}</span>
                </h3>
                <button
                  type="button"
                  @click="addLine"
                  class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl transition font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>+ Add Line (Alt+N)</span>
                </button>
              </div>

              <!-- Single Entry Lines (Payment / Receipt / Contra) -->
              <template v-if="form.vtype !== 'JOURNAL'">
                <div
                  v-for="(entry, idx) in form.entries"
                  :key="idx"
                  class="p-3 bg-white dark:bg-zinc-850 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-2"
                >
                  <div class="grid grid-cols-12 gap-2.5 items-center">
                    <div class="col-span-1 text-center font-bold text-xs text-slate-400">#{{ idx + 1 }}</div>

                    <!-- Account Head Autocomplete Input -->
                    <div class="col-span-6">
                      <input
                        list="accounts-data-list"
                        :value="entry.accountHead"
                        @change="handleHeadSelect(entry, $event)"
                        @input="entry.accountHead = $event.target.value"
                        placeholder="Search Account Head or Party name..."
                        class="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>

                    <!-- Effect -->
                    <div class="col-span-2">
                      <select v-model="entry.effect" class="w-full px-2 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white">
                        <option value="ADD">ADD (+)</option>
                        <option value="DEDUCT">DEDUCT (-)</option>
                      </select>
                    </div>

                    <!-- Amount -->
                    <div class="col-span-2">
                      <input
                        v-model.number="entry.amount"
                        @input="updateTds(entry)"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        class="w-full px-3 py-1.5 text-xs font-mono font-bold text-right rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>

                    <!-- Delete line button -->
                    <div class="col-span-1 text-center">
                      <button @click="removeLine(idx)" class="text-rose-500 hover:text-rose-700 font-bold text-xs cursor-pointer">
                        🗑️
                      </button>
                    </div>
                  </div>

                  <!-- TDS & Line Narration Subrow -->
                  <div class="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-zinc-400 pl-8">
                    <label v-if="form.vtype === 'PAYMENT'" class="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" v-model="entry.tdsEnabled" @change="updateTds(entry)" class="w-3.5 h-3.5 text-blue-600 rounded" />
                      <span class="text-[11px] font-bold">Deduct TDS</span>
                    </label>

                    <div v-if="entry.tdsEnabled" class="flex items-center gap-2">
                      <select v-model.number="entry.tdsRate" @change="updateTds(entry)" class="px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800">
                        <option :value="1.0">1% (Individual/HUF)</option>
                        <option :value="2.0">2% (Company/Firm)</option>
                        <option :value="5.0">5% (Rent)</option>
                        <option :value="10.0">10% (Professional)</option>
                      </select>
                      <span class="font-mono text-rose-600 font-bold">-₹{{ entry.tdsAmount.toFixed(2) }}</span>
                    </div>

                    <div class="flex-1">
                      <input
                        v-model="entry.narration"
                        type="text"
                        placeholder="Line narration / remarks..."
                        class="w-full px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </template>

              <!-- Double Entry Lines (Journal Entry) -->
              <template v-else>
                <div
                  v-for="(entry, idx) in form.entries"
                  :key="idx"
                  class="p-3 bg-white dark:bg-zinc-850 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs grid grid-cols-12 gap-2.5 items-center"
                >
                  <div class="col-span-1 text-center font-bold text-xs text-slate-400">#{{ idx + 1 }}</div>

                  <!-- Account Head -->
                  <div class="col-span-5">
                    <input
                      list="accounts-data-list"
                      :value="entry.accountHead"
                      @change="handleHeadSelect(entry, $event)"
                      @input="entry.accountHead = $event.target.value"
                      placeholder="Search Account Head..."
                      class="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>

                  <!-- Debit -->
                  <div class="col-span-2">
                    <input
                      v-model.number="entry.debitAmount"
                      @input="onDebitChange(entry)"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Dr (₹)"
                      class="w-full px-3 py-1.5 text-xs font-mono font-bold text-right rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white text-emerald-600"
                    />
                  </div>

                  <!-- Credit -->
                  <div class="col-span-2">
                    <input
                      v-model.number="entry.creditAmount"
                      @input="onCreditChange(entry)"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Cr (₹)"
                      class="w-full px-3 py-1.5 text-xs font-mono font-bold text-right rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white text-rose-600"
                    />
                  </div>

                  <!-- Narration -->
                  <div class="col-span-1">
                    <button @click="removeLine(idx)" class="text-rose-500 hover:text-rose-700 font-bold text-xs cursor-pointer">
                      🗑️
                    </button>
                  </div>
                </div>

                <!-- Journal Parity Bar -->
                <div class="p-3 rounded-xl border flex items-center justify-between text-xs font-bold" :class="isJournalBalanced ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'">
                  <div>
                    <span v-if="isJournalBalanced">✅ Balanced Double-Entry</span>
                    <span v-else>⚠️ Imbalance: ₹{{ journalDifference.toFixed(2) }} (Debits must equal Credits)</span>
                  </div>
                  <div class="flex items-center gap-4 font-mono">
                    <span>Total DR: ₹{{ journalDebits.toFixed(2) }}</span>
                    <span>Total CR: ₹{{ journalCredits.toFixed(2) }}</span>
                  </div>
                </div>
              </template>
            </div>

            <!-- Voucher Narration -->
            <div class="p-3 bg-slate-50 dark:bg-zinc-850 rounded-xl border border-slate-200 dark:border-zinc-800">
              <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                📝 Primary Voucher Narration
              </label>
              <input
                v-model="form.narration"
                type="text"
                placeholder="e.g. Being payment made towards settlement of monthly supplies invoice..."
                class="w-full px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          <!-- Datalist for autocomplete -->
          <datalist id="accounts-data-list">
            <option v-for="acc in allAccounts" :key="acc.account_name" :value="acc.account_name">
              {{ acc.account_type }}
            </option>
            <option v-for="p in parties" :key="p.id" :value="p.name">
              Party ({{ p.partyType }})
            </option>
          </datalist>

          <!-- Footer -->
          <div class="px-5 py-3.5 bg-slate-50 dark:bg-zinc-800/80 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center">
            <div>
              <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Voucher Net Amount</p>
              <div class="text-lg font-black font-mono text-slate-900 dark:text-white">
                ₹{{ totalVoucherAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button @click="$emit('update:modelValue', false)" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-zinc-300 cursor-pointer">
                Cancel (Esc)
              </button>
              <button
                @click="submitVoucher"
                :disabled="loading || (form.vtype === 'JOURNAL' && !isJournalBalanced)"
                class="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span v-if="loading">⏳ Posting...</span>
                <span v-else>🚀 Post Voucher (Ctrl+Enter)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `
  };
})(typeof window !== 'undefined' ? window : this);
