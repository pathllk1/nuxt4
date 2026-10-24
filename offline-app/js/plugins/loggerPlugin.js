// plugins/loggerPlugin.js
(function (global) {
  'use strict';

  const LoggerPlugin = {
    install(app) {
      const logAudit = async (action, details = '') => {
        const timestamp = new Date().toISOString();
        try {
          if (global.WebSqlService) {
            await global.WebSqlService.executeSql(
              'INSERT INTO audit_log (action, details, timestamp) VALUES (?, ?, ?)',
              [action, details, timestamp]
            );
          }
          console.log(`[AUDIT] ${action}:`, details);
        } catch (err) {
          console.error('[AUDIT_ERROR]', err);
        }
      };

      app.config.globalProperties.$audit = logAudit;
      app.provide('auditLogger', { logAudit });
    }
  };

  global.LoggerPlugin = LoggerPlugin;
})(window);
