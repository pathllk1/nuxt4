// composable/useParties.js
(function (global) {
  'use strict';

  function useParties(notify, audit) {
    const { ref, computed } = Vue;

    const parties = ref([]);
    const loading = ref(false);
    const searchQuery = ref('');
    const typeFilter = ref('ALL'); // 'ALL', 'CUSTOMER', 'SUPPLIER'

    const loadParties = async () => {
      loading.value = true;
      try {
        const res = await global.WebSqlService.executeSql(
          'SELECT * FROM parties ORDER BY name ASC'
        );
        parties.value = Array.isArray(res?.rows) ? res.rows : [];
      } catch (err) {
        console.error('Failed to load parties:', err);
        if (notify) notify('Failed to load parties', 'error');
      } finally {
        loading.value = false;
      }
    };

    const addParty = async (partyData) => {
      const partyName = (partyData.name || partyData.account_name || '').trim();
      if (!partyName) {
        if (notify) notify('Party Name is required', 'warning');
        return false;
      }

      const partyId = partyData.id || partyData._id;
      const now = new Date().toISOString();
      const primaryLoc = (Array.isArray(partyData.gstLocations) && partyData.gstLocations.find(l => l.isPrimary)) || (Array.isArray(partyData.gstLocations) && partyData.gstLocations[0]) || null;
      const gstinVal = partyData.gstin || (primaryLoc && primaryLoc.gstin) || 'UNREGISTERED';
      const stateVal = partyData.state || (primaryLoc && primaryLoc.state) || 'Maharashtra';
      const stateCodeVal = partyData.stateCode || (primaryLoc && primaryLoc.stateCode) || (gstinVal && gstinVal.length >= 2 && gstinVal !== 'UNREGISTERED' ? gstinVal.substring(0, 2) : '27');
      const addressVal = partyData.address || (primaryLoc && primaryLoc.address) || '';
      const pinVal = partyData.pin || partyData.pincode || (primaryLoc && primaryLoc.pincode) || '';
      const panVal = (partyData.pan || '').toUpperCase().trim();
      const gstLocationsJson = JSON.stringify(partyData.gstLocations || []);
      const opBal = Number(partyData.openingBalance !== undefined ? partyData.openingBalance : partyData.opening_balance) || 0;
      const balType = partyData.balanceType || partyData.balance_type || 'CR';

      try {
        if (partyId) {
          await global.WebSqlService.executeSql(
            `UPDATE parties SET 
               name = ?, partyType = ?, gstin = ?, contact = ?, state = ?, stateCode = ?, 
               address = ?, pin = ?, pan = ?, gstLocations = ?, openingBalance = ?, 
               balanceType = ?, bankName = ?, accountNumber = ?, ifscCode = ?, branchName = ?, updated_at = ?
             WHERE id = ?`,
            [
              partyName,
              partyData.partyType || partyData.account_type || 'CUSTOMER',
              gstinVal,
              partyData.contact || partyData.phone || '',
              stateVal,
              stateCodeVal,
              addressVal,
              pinVal,
              panVal,
              gstLocationsJson,
              opBal,
              balType,
              partyData.bankName || partyData.bank_name || '',
              partyData.accountNumber || partyData.account_number || '',
              partyData.ifscCode || partyData.ifsc_code || '',
              partyData.branchName || partyData.branch_name || '',
              now,
              partyId
            ]
          );
          if (audit) audit('PARTY_UPDATED', `Updated master: ${partyName}`);
          if (notify) notify(`Party "${partyName}" updated`, 'success');
        } else {
          await global.WebSqlService.executeSql(
            `INSERT INTO parties (name, partyType, gstin, contact, state, stateCode, address, pin, pan, gstLocations, openingBalance, balanceType, currentBalance, bankName, accountNumber, ifscCode, branchName, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              partyName,
              partyData.partyType || partyData.account_type || 'CUSTOMER',
              gstinVal,
              partyData.contact || partyData.phone || '',
              stateVal,
              stateCodeVal,
              addressVal,
              pinVal,
              panVal,
              gstLocationsJson,
              opBal,
              balType,
              opBal,
              partyData.bankName || partyData.bank_name || '',
              partyData.accountNumber || partyData.account_number || '',
              partyData.ifscCode || partyData.ifsc_code || '',
              partyData.branchName || partyData.branch_name || '',
              now,
              now
            ]
          );
          if (audit) audit('PARTY_CREATED', `Added master: ${partyName}`);
          if (notify) notify(`Party "${partyName}" added`, 'success');
        }

        await loadParties();
        return true;
      } catch (err) {
        console.error('Error saving party:', err);
        if (notify) notify('Failed to save party: ' + err.message, 'error');
        return false;
      }
    };

    const deleteParty = async (id, partyName) => {
      try {
        await global.WebSqlService.executeSql('DELETE FROM parties WHERE id = ?', [id]);
        if (audit) audit('PARTY_DELETED', `Deleted party: ${partyName}`);
        if (notify) notify(`Party "${partyName}" deleted`, 'info');
        await loadParties();
        return true;
      } catch (err) {
        console.error('Error deleting party:', err);
        if (notify) notify('Failed to delete party', 'error');
        return false;
      }
    };

    const filteredParties = computed(() => {
      let list = Array.isArray(parties.value) ? parties.value.filter(Boolean) : [];

      if (searchQuery.value && searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        list = list.filter((p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.gstin && p.gstin.toLowerCase().includes(q)) ||
          (p.contact && p.contact.toLowerCase().includes(q))
        );
      }

      if (typeFilter.value !== 'ALL') {
        list = list.filter((p) => p.partyType === typeFilter.value || p.partyType === 'BOTH');
      }

      return list;
    });

    return {
      parties,
      filteredParties,
      loading,
      searchQuery,
      typeFilter,
      loadParties,
      addParty,
      deleteParty
    };
  }

  global.useParties = useParties;
})(window);
