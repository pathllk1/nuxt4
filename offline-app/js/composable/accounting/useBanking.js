// composable/accounting/useBanking.js - Bank Accounts, Balances & History Composable
(function (global) {
  'use strict';

  function useBanking(notify, audit) {
    const { ref, computed } = Vue;

    const bankAccounts = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const selectedHistoryAcc = ref(null);
    const history = ref([]);
    const historyLoading = ref(false);

    const totalLiquidity = computed(() => {
      return bankAccounts.value.reduce((sum, acc) => {
        if (acc.status === 'ACTIVE') {
          return sum + (acc.balanceType === 'DR' ? acc.current_balance : -acc.current_balance);
        }
        return sum;
      }, 0);
    });

    const defaultAccount = computed(() => {
      return bankAccounts.value.find((acc) => acc.is_default) || bankAccounts.value[0] || null;
    });

    const fetchBankAccounts = async () => {
      loading.value = true;
      error.value = null;
      try {
        if (global.ledgerService) {
          bankAccounts.value = await global.ledgerService.getBankAccountsWithBalances();
        } else {
          const res = await global.WebSqlService.executeSql('SELECT * FROM bank_accounts ORDER BY is_default DESC, id ASC');
          bankAccounts.value = res.rows || [];
        }
      } catch (err) {
        console.error('Failed to fetch bank accounts:', err);
        error.value = err.message;
        if (notify) notify('Failed to load bank accounts', 'error');
      } finally {
        loading.value = false;
      }
    };

    const createBankAccount = async (data) => {
      try {
        const now = new Date().toISOString();
        const opBal = Number(data.opening_balance) || 0;
        const balType = data.balance_type || 'DR';

        // 1. If marked as default, clear existing default flags
        if (data.is_default) {
          await global.WebSqlService.executeSql('UPDATE bank_accounts SET is_default = 0');
        }

        // 2. Insert into bank_accounts
        const res = await global.WebSqlService.executeSql(
          `INSERT INTO bank_accounts (
            account_name, account_holder_name, bank_name, branch_name, account_number,
            ifsc_code, account_type, upi_id, notes, opening_balance, balance_type,
            current_balance, is_default, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.account_name,
            data.account_holder_name || '',
            data.bank_name,
            data.branch_name || '',
            data.account_number,
            (data.ifsc_code || '').toUpperCase(),
            data.account_type || 'CURRENT',
            data.upi_id || '',
            data.notes || '',
            opBal,
            balType,
            opBal,
            data.is_default ? 1 : 0,
            data.status || 'ACTIVE',
            now,
            now
          ]
        );

        const newId = res.insertId;

        // 3. Auto-register in Chart of Accounts
        if (global.unifiedPostingService) {
          await global.unifiedPostingService.resolveAccountInCOA(data.account_name, 'BANK');
        }

        // 4. If opening balance > 0, post initial ledger entry
        if (opBal > 0 && global.unifiedPostingService) {
          const today = now.split('T')[0];
          const legs = [
            {
              accountHead: data.account_name,
              accountType: 'BANK',
              bankAccountId: newId,
              debitAmount: balType === 'DR' ? opBal : 0,
              creditAmount: balType === 'CR' ? opBal : 0,
              narration: `Opening balance for ${data.account_name}`
            },
            {
              accountHead: 'Capital Account',
              accountType: 'CAPITAL',
              debitAmount: balType === 'CR' ? opBal : 0,
              creditAmount: balType === 'DR' ? opBal : 0,
              narration: `Offset opening balance for ${data.account_name}`
            }
          ];

          await global.unifiedPostingService.postVoucher({
            voucherType: 'OPENING_BALANCE',
            transactionDate: today,
            narration: `Opening balance: ${data.account_name}`,
            legs,
            createdBy: 'Admin',
            refType: 'OPENING_BALANCE',
            refId: newId
          });
        }

        if (notify) notify(`Bank account "${data.account_name}" added successfully!`, 'success');
        if (audit) audit('BANK_ACCOUNT_CREATED', `Added bank account: ${data.account_name} (${data.bank_name})`);
        await fetchBankAccounts();
        return true;
      } catch (err) {
        console.error('Error creating bank account:', err);
        if (notify) notify('Failed to create bank account: ' + err.message, 'error');
        return false;
      }
    };

    const updateBankAccount = async (id, data) => {
      try {
        const now = new Date().toISOString();

        if (data.is_default) {
          await global.WebSqlService.executeSql('UPDATE bank_accounts SET is_default = 0 WHERE id != ?', [id]);
        }

        await global.WebSqlService.executeSql(
          `UPDATE bank_accounts SET 
            account_name = ?, account_holder_name = ?, bank_name = ?, branch_name = ?,
            account_number = ?, ifsc_code = ?, account_type = ?, upi_id = ?,
            notes = ?, is_default = ?, status = ?, updated_at = ?
          WHERE id = ?`,
          [
            data.account_name,
            data.account_holder_name || '',
            data.bank_name,
            data.branch_name || '',
            data.account_number,
            (data.ifsc_code || '').toUpperCase(),
            data.account_type || 'CURRENT',
            data.upi_id || '',
            data.notes || '',
            data.is_default ? 1 : 0,
            data.status || 'ACTIVE',
            now,
            id
          ]
        );

        if (notify) notify(`Bank account "${data.account_name}" updated successfully!`, 'success');
        await fetchBankAccounts();
        return true;
      } catch (err) {
        console.error('Error updating bank account:', err);
        if (notify) notify('Failed to update bank account: ' + err.message, 'error');
        return false;
      }
    };

    const deleteBankAccount = async (acc) => {
      try {
        // Check if there are any ledger entries
        const checkRes = await global.WebSqlService.executeSql(
          'SELECT COUNT(*) as count FROM ledger WHERE bankAccountId = ?',
          [acc.id]
        );
        const txCount = checkRes.rows[0]?.count || 0;
        if (txCount > 0) {
          if (notify) notify(`Cannot delete "${acc.account_name}": It has ${txCount} recorded ledger transactions. Deactivate it instead.`, 'warning');
          return false;
        }

        await global.WebSqlService.executeSql('DELETE FROM bank_accounts WHERE id = ?', [acc.id]);
        if (notify) notify(`Bank account "${acc.account_name}" deleted`, 'info');
        if (audit) audit('BANK_ACCOUNT_DELETED', `Deleted bank account: ${acc.account_name}`);
        await fetchBankAccounts();
        return true;
      } catch (err) {
        console.error('Error deleting bank account:', err);
        if (notify) notify('Failed to delete bank account', 'error');
        return false;
      }
    };

    const viewHistory = async (acc) => {
      selectedHistoryAcc.value = acc;
      historyLoading.value = true;
      try {
        if (global.ledgerService) {
          history.value = await global.ledgerService.getBankAccountHistory(acc.id, 50);
        }
      } catch (err) {
        console.error('Error fetching bank history:', err);
      } finally {
        historyLoading.value = false;
      }
    };

    return {
      bankAccounts,
      loading,
      error,
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
    };
  }

  global.useBanking = useBanking;
})(typeof window !== 'undefined' ? window : this);
