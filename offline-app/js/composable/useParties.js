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
      if (!partyData.name || !partyData.name.trim()) {
        if (notify) notify('Party Name is required', 'warning');
        return false;
      }

      const now = new Date().toISOString();
      try {
        await global.WebSqlService.executeSql(
          `INSERT INTO parties (name, partyType, gstin, contact, state, stateCode, address, openingBalance, balanceType, currentBalance, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            partyData.name.trim(),
            partyData.partyType || 'CUSTOMER',
            partyData.gstin ? partyData.gstin.trim() : 'UNREGISTERED',
            partyData.contact || '',
            partyData.state || 'Maharashtra',
            partyData.stateCode || '27',
            partyData.address || '',
            Number(partyData.openingBalance) || 0,
            partyData.balanceType || 'CR',
            Number(partyData.openingBalance) || 0,
            now,
            now
          ]
        );

        if (audit) audit('PARTY_CREATED', `Added party: ${partyData.name}`);
        if (notify) notify(`Party "${partyData.name}" added`, 'success');
        await loadParties();
        return true;
      } catch (err) {
        console.error('Error adding party:', err);
        if (notify) notify('Failed to add party: ' + err.message, 'error');
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
