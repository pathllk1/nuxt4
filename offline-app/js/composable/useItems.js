// composable/useItems.js
(function (global) {
  'use strict';

  function useItems(notify, audit) {
    const { ref, computed } = Vue;

    const items = ref([]);
    const loading = ref(false);
    const searchQuery = ref('');
    const selectedCategory = ref('all');
    const selectedStatus = ref('all');
    const sortBy = ref('newest');

    const categories = ['Engineering', 'UI/UX', 'Operations', 'Finance', 'Personal'];

    const loadItems = async () => {
      loading.value = true;
      try {
        const result = await global.WebSqlService.executeSql(
          'SELECT * FROM items ORDER BY id DESC'
        );
        const fetched = Array.isArray(result?.rows) ? result.rows : [];
        items.value = fetched.filter((item) => item && typeof item === 'object');
      } catch (err) {
        console.error('Failed to load items:', err);
        if (notify) notify('Failed to load items from WebSQL', 'error');
      } finally {
        loading.value = false;
      }
    };

    const addItem = async (itemData) => {
      const validation = global.Validators.validateItem(itemData);
      if (!validation.isValid) {
        const msg = Object.values(validation.errors).join(', ');
        if (notify) notify(msg, 'warning');
        return false;
      }

      const now = new Date().toISOString();
      try {
        const res = await global.WebSqlService.executeSql(
          `INSERT INTO items (title, category, status, priority, value, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemData.title.trim(),
            itemData.category,
            itemData.status || 'active',
            itemData.priority || 'medium',
            Number(itemData.value) || 0,
            itemData.notes ? itemData.notes.trim() : '',
            now,
            now
          ]
        );

        if (audit) audit('ITEM_CREATED', `Created "${itemData.title}" (ID: ${res.insertId || 'auto'})`);
        if (notify) notify('Record saved successfully to WebSQL!', 'success');
        await loadItems();
        return true;
      } catch (err) {
        console.error('Error inserting item:', err);
        if (notify) notify('Failed to insert item: ' + err.message, 'error');
        return false;
      }
    };

    const updateItem = async (id, itemData) => {
      const validation = global.Validators.validateItem(itemData);
      if (!validation.isValid) {
        const msg = Object.values(validation.errors).join(', ');
        if (notify) notify(msg, 'warning');
        return false;
      }

      const now = new Date().toISOString();
      try {
        await global.WebSqlService.executeSql(
          `UPDATE items SET title = ?, category = ?, status = ?, priority = ?, value = ?, notes = ?, updated_at = ?
           WHERE id = ?`,
          [
            itemData.title.trim(),
            itemData.category,
            itemData.status,
            itemData.priority,
            Number(itemData.value) || 0,
            itemData.notes ? itemData.notes.trim() : '',
            now,
            id
          ]
        );

        if (audit) audit('ITEM_UPDATED', `Updated record ID: ${id}`);
        if (notify) notify('Record updated in WebSQL', 'success');
        await loadItems();
        return true;
      } catch (err) {
        console.error('Error updating item:', err);
        if (notify) notify('Failed to update: ' + err.message, 'error');
        return false;
      }
    };

    const toggleStatus = async (item) => {
      if (!item) return;
      const newStatus = item.status === 'completed' ? 'active' : 'completed';
      const now = new Date().toISOString();
      try {
        await global.WebSqlService.executeSql(
          'UPDATE items SET status = ?, updated_at = ? WHERE id = ?',
          [newStatus, now, item.id]
        );
        if (audit) audit('STATUS_TOGGLED', `Changed ID ${item.id} to ${newStatus}`);
        if (notify) notify(`Marked as ${newStatus}`, 'info');
        await loadItems();
      } catch (err) {
        console.error('Error toggling status:', err);
        if (notify) notify('Failed to update status', 'error');
      }
    };

    const deleteItem = async (id, title) => {
      try {
        await global.WebSqlService.executeSql('DELETE FROM items WHERE id = ?', [id]);
        if (audit) audit('ITEM_DELETED', `Deleted "${title || 'Record'}" (ID: ${id})`);
        if (notify) notify('Record removed from WebSQL database', 'info');
        await loadItems();
        return true;
      } catch (err) {
        console.error('Error deleting item:', err);
        if (notify) notify('Failed to delete item', 'error');
        return false;
      }
    };

    // Filtered & Sorted items with defensive checks
    const filteredItems = computed(() => {
      const rawList = Array.isArray(items.value) ? items.value : [];
      let list = rawList.filter((item) => item && typeof item === 'object');

      if (searchQuery.value && searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        list = list.filter((item) =>
          (item.title && item.title.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q)) ||
          (item.category && item.category.toLowerCase().includes(q))
        );
      }

      if (selectedCategory.value !== 'all') {
        list = list.filter((item) => item.category === selectedCategory.value);
      }

      if (selectedStatus.value !== 'all') {
        list = list.filter((item) => item.status === selectedStatus.value);
      }

      list.sort((a, b) => {
        const idA = Number(a?.id) || 0;
        const idB = Number(b?.id) || 0;
        const valA = Number(a?.value) || 0;
        const valB = Number(b?.value) || 0;

        if (sortBy.value === 'newest') return idB - idA;
        if (sortBy.value === 'oldest') return idA - idB;
        if (sortBy.value === 'value-high') return valB - valA;
        if (sortBy.value === 'value-low') return valA - valB;
        return idB - idA;
      });

      return list;
    });

    // Metrics & Statistics with safe calculations
    const metrics = computed(() => {
      const raw = Array.isArray(items.value) ? items.value : [];
      const list = raw.filter((item) => item && typeof item === 'object');
      const total = list.length;
      const active = list.filter((i) => i.status === 'active').length;
      const completed = list.filter((i) => i.status === 'completed').length;
      const totalValue = list.reduce((acc, curr) => acc + (Number(curr?.value) || 0), 0);
      return { total, active, completed, totalValue };
    });

    const exportData = () => {
      const raw = Array.isArray(items.value) ? items.value : [];
      global.Formatters.exportToJson(raw.filter(Boolean), `websql_backup_${Date.now()}.json`);
      if (notify) notify('Database export downloaded', 'success');
    };

    return {
      items,
      filteredItems,
      metrics,
      loading,
      searchQuery,
      selectedCategory,
      selectedStatus,
      sortBy,
      categories,
      loadItems,
      addItem,
      updateItem,
      toggleStatus,
      deleteItem,
      exportData
    };
  }

  global.useItems = useItems;
})(window);
