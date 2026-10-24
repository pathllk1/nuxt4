// composable/useInventory.js
(function (global) {
  'use strict';

  function useInventory(notify, audit) {
    const { ref, computed } = Vue;

    const stocks = ref([]);
    const loading = ref(false);
    const searchQuery = ref('');
    const statusFilter = ref('all'); // 'all', 'low', 'out', 'normal'
    const sortBy = ref('name-asc');

    const loadStocks = async () => {
      loading.value = true;
      try {
        let res = await global.WebSqlService.executeSql(
          'SELECT * FROM stocks ORDER BY item ASC'
        );
        let items = Array.isArray(res?.rows) ? res.rows : [];

        // If database has 0 stock items, auto-seed demo items and reload
        if (items.length === 0 && global.WebSqlService && typeof global.WebSqlService.seedDemoData === 'function') {
          console.info('[useInventory] No stocks found. Auto-seeding demo inventory...');
          await global.WebSqlService.seedDemoData(false);
          res = await global.WebSqlService.executeSql('SELECT * FROM stocks ORDER BY item ASC');
          items = Array.isArray(res?.rows) ? res.rows : [];
        }

        stocks.value = items;
      } catch (err) {
        console.error('Error loading stocks:', err);
        if (notify) notify('Failed to load stock inventory', 'error');
      } finally {
        loading.value = false;
      }
    };

    const addStock = async (stockData) => {
      if (!stockData.item || !stockData.item.trim()) {
        if (notify) notify('Item Name is required', 'warning');
        return false;
      }

      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const qty = Number(stockData.qty) || 0;
      const rate = Number(stockData.rate) || 0;
      const cost_rate = Number(stockData.cost_rate) || rate;

      try {
        const res = await global.WebSqlService.executeSql(
          `INSERT INTO stocks (item, pno, oem, hsn, qty, uom, rate, cost_rate, grate, min_qty, mrp, batch, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stockData.item.trim(),
            stockData.pno ? stockData.pno.trim() : '',
            stockData.oem ? stockData.oem.trim() : '',
            stockData.hsn ? stockData.hsn.trim() : '',
            qty,
            stockData.uom || 'PCS',
            rate,
            cost_rate,
            Number(stockData.grate) || 18,
            Number(stockData.min_qty) || 5,
            Number(stockData.mrp) || rate,
            stockData.batch || '',
            now,
            now
          ]
        );

        if (qty > 0) {
          await global.WebSqlService.executeSql(
            `INSERT INTO stock_reg (type, bno, bdate, stockId, item, qty, qtyh, rate, partyName, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['OPENING', 'INITIAL', today, res.insertId, stockData.item, qty, qty, cost_rate, 'Manual Stock Addition', now]
          );
        }

        if (audit) audit('STOCK_CREATED', `Added new item: ${stockData.item}`);
        if (notify) notify(`Item "${stockData.item}" added to inventory`, 'success');
        await loadStocks();
        return true;
      } catch (err) {
        console.error('Error adding stock:', err);
        if (notify) notify('Error adding item: ' + err.message, 'error');
        return false;
      }
    };

    const updateStock = async (id, stockData) => {
      const now = new Date().toISOString();
      try {
        await global.WebSqlService.executeSql(
          `UPDATE stocks SET item = ?, pno = ?, oem = ?, hsn = ?, rate = ?, cost_rate = ?, grate = ?, min_qty = ?, mrp = ?, updated_at = ?
           WHERE id = ?`,
          [
            stockData.item.trim(),
            stockData.pno || '',
            stockData.oem || '',
            stockData.hsn || '',
            Number(stockData.rate) || 0,
            Number(stockData.cost_rate) || 0,
            Number(stockData.grate) || 18,
            Number(stockData.min_qty) || 5,
            Number(stockData.mrp) || 0,
            now,
            id
          ]
        );

        if (audit) audit('STOCK_UPDATED', `Updated item ID: ${id}`);
        if (notify) notify('Stock item updated successfully', 'success');
        await loadStocks();
        return true;
      } catch (err) {
        console.error('Error updating stock:', err);
        if (notify) notify('Failed to update: ' + err.message, 'error');
        return false;
      }
    };

    const adjustStock = async (stockId, newQty, reason = 'Inventory Audit') => {
      const target = stocks.value.find((s) => s.id === stockId);
      if (!target) return;

      const diff = Number(newQty) - Number(target.qty);
      const now = new Date().toISOString();
      const today = now.split('T')[0];

      try {
        await global.WebSqlService.executeSql(
          'UPDATE stocks SET qty = ?, updated_at = ? WHERE id = ?',
          [Number(newQty), now, stockId]
        );

        await global.WebSqlService.executeSql(
          `INSERT INTO stock_reg (type, bno, bdate, stockId, item, qty, qtyh, rate, partyName, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['ADJUSTMENT', 'ADJ-' + Date.now().toString().slice(-4), today, stockId, target.item, diff, Number(newQty), target.cost_rate || target.rate, reason, now]
        );

        if (audit) audit('STOCK_ADJUSTED', `Adjusted ${target.item} qty to ${newQty} (${reason})`);
        if (notify) notify(`Stock updated: ${target.item} is now ${newQty} ${target.uom}`, 'info');
        await loadStocks();
      } catch (err) {
        console.error('Error adjusting stock:', err);
        if (notify) notify('Failed to adjust stock', 'error');
      }
    };

    const deleteStock = async (id, itemTitle) => {
      try {
        await global.WebSqlService.executeSql('DELETE FROM stocks WHERE id = ?', [id]);
        if (audit) audit('STOCK_DELETED', `Deleted stock item: ${itemTitle}`);
        if (notify) notify(`Deleted "${itemTitle}" from inventory`, 'info');
        await loadStocks();
        return true;
      } catch (err) {
        console.error('Error deleting stock:', err);
        if (notify) notify('Failed to delete stock item', 'error');
        return false;
      }
    };

    const filteredStocks = computed(() => {
      let list = Array.isArray(stocks.value) ? stocks.value.filter(Boolean) : [];

      if (searchQuery.value && searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        list = list.filter((s) =>
          (s.item && s.item.toLowerCase().includes(q)) ||
          (s.pno && s.pno.toLowerCase().includes(q)) ||
          (s.oem && s.oem.toLowerCase().includes(q)) ||
          (s.hsn && s.hsn.toLowerCase().includes(q))
        );
      }

      if (statusFilter.value === 'low') {
        list = list.filter((s) => (Number(s.qty) || 0) > 0 && (Number(s.qty) || 0) <= (Number(s.min_qty) || 5));
      } else if (statusFilter.value === 'out') {
        list = list.filter((s) => (Number(s.qty) || 0) <= 0);
      } else if (statusFilter.value === 'normal') {
        list = list.filter((s) => (Number(s.qty) || 0) > (Number(s.min_qty) || 5));
      }

      list.sort((a, b) => {
        if (sortBy.value === 'name-asc') return (a.item || '').localeCompare(b.item || '');
        if (sortBy.value === 'name-desc') return (b.item || '').localeCompare(a.item || '');
        if (sortBy.value === 'qty-desc') return (Number(b.qty) || 0) - (Number(a.qty) || 0);
        if (sortBy.value === 'qty-asc') return (Number(a.qty) || 0) - (Number(b.qty) || 0);
        if (sortBy.value === 'val-desc') return ((Number(b.qty) || 0) * (Number(b.rate) || 0)) - ((Number(a.qty) || 0) * (Number(a.rate) || 0));
        return 0;
      });

      return list;
    });

    const metrics = computed(() => {
      const list = Array.isArray(stocks.value) ? stocks.value : [];
      const totalItems = list.length;
      const totalUnits = list.reduce((acc, s) => acc + (Number(s.qty) || 0), 0);
      const totalValuation = list.reduce((acc, s) => acc + ((Number(s.qty) || 0) * (Number(s.rate) || 0)), 0);
      const lowStockCount = list.filter((s) => (Number(s.qty) || 0) > 0 && (Number(s.qty) || 0) <= (Number(s.min_qty) || 5)).length;
      const outOfStockCount = list.filter((s) => (Number(s.qty) || 0) <= 0).length;

      return {
        totalItems,
        totalUnits,
        totalValuation,
        lowStockCount,
        outOfStockCount
      };
    });

    const exportToExcel = async () => {
      if (!global.ExcelExportService) return;
      try {
        await global.ExcelExportService.exportStocks(stocks.value);
        if (notify) notify('Stock report exported to formatted Excel file!', 'success');
      } catch (err) {
        console.error('Excel export failed:', err);
        if (notify) notify('Excel export failed: ' + err.message, 'error');
      }
    };

    return {
      stocks,
      filteredStocks,
      metrics,
      loading,
      searchQuery,
      statusFilter,
      sortBy,
      loadStocks,
      addStock,
      updateStock,
      adjustStock,
      deleteStock,
      exportToExcel
    };
  }

  global.useInventory = useInventory;
})(window);
