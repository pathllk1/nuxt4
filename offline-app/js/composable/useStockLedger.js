// composable/useStockLedger.js
(function (global) {
  'use strict';

  function useStockLedger(notify) {
    const { ref, computed } = Vue;

    const movements = ref([]);
    const loading = ref(false);
    const typeFilter = ref('ALL');
    const searchQuery = ref('');

    const loadMovements = async () => {
      loading.value = true;
      try {
        const res = await global.WebSqlService.executeSql(
          'SELECT * FROM stock_reg ORDER BY id DESC LIMIT 200'
        );
        movements.value = Array.isArray(res?.rows) ? res.rows : [];
      } catch (err) {
        console.error('Failed to load stock movements:', err);
        if (notify) notify('Failed to load stock register', 'error');
      } finally {
        loading.value = false;
      }
    };

    const filteredMovements = computed(() => {
      let list = Array.isArray(movements.value) ? movements.value.filter(Boolean) : [];

      if (searchQuery.value && searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        list = list.filter((m) =>
          (m.item && m.item.toLowerCase().includes(q)) ||
          (m.bno && m.bno.toLowerCase().includes(q)) ||
          (m.partyName && m.partyName.toLowerCase().includes(q))
        );
      }

      if (typeFilter.value !== 'ALL') {
        list = list.filter((m) => m.type === typeFilter.value);
      }

      return list;
    });

    return {
      movements,
      filteredMovements,
      loading,
      typeFilter,
      searchQuery,
      loadMovements
    };
  }

  global.useStockLedger = useStockLedger;
})(window);
