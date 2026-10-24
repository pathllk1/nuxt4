// composable/useWebSql.js
(function (global) {
  'use strict';

  function useWebSql() {
    const { ref, reactive, onMounted } = Vue;

    const isReady = ref(false);
    const engineType = ref('Initializing...');
    const isNative = ref(false);
    const lastError = ref(null);
    const queryResults = ref(null);
    const queryLoading = ref(false);
    const queryExecutionTime = ref(0);

    const initDatabase = async () => {
      try {
        const info = await global.WebSqlService.init();
        engineType.value = info.engine;
        isNative.value = info.isNative;
        isReady.value = true;
      } catch (err) {
        lastError.value = err.message || String(err);
        console.error('Database initialization error:', err);
      }
    };

    const runRawQuery = async (sqlQuery) => {
      if (!sqlQuery || !sqlQuery.trim()) {
        throw new Error('Query cannot be empty');
      }

      queryLoading.value = true;
      lastError.value = null;
      const startTime = performance.now();

      try {
        const result = await global.WebSqlService.executeSql(sqlQuery.trim());
        const endTime = performance.now();
        queryExecutionTime.value = Math.round((endTime - startTime) * 100) / 100;
        queryResults.value = result;
        return result;
      } catch (err) {
        lastError.value = err.message || String(err);
        throw err;
      } finally {
        queryLoading.value = false;
      }
    };

    const downloadBackup = (filename) => {
      if (global.WebSqlService && typeof global.WebSqlService.downloadDatabase === 'function') {
        global.WebSqlService.downloadDatabase(filename);
      }
    };

    const exportDatabase = () => {
      if (global.WebSqlService && typeof global.WebSqlService.exportDatabase === 'function') {
        return global.WebSqlService.exportDatabase();
      }
      return null;
    };

    const importDatabase = async (uint8Array) => {
      if (global.WebSqlService && typeof global.WebSqlService.importDatabase === 'function') {
        return await global.WebSqlService.importDatabase(uint8Array);
      }
      return false;
    };

    return {
      isReady,
      engineType,
      isNative,
      lastError,
      queryResults,
      queryLoading,
      queryExecutionTime,
      initDatabase,
      runRawQuery,
      downloadBackup,
      exportDatabase,
      importDatabase
    };
  }

  global.useWebSql = useWebSql;
})(window);
