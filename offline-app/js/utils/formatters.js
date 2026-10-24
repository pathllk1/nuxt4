// utils/formatters.js
(function (global) {
  'use strict';

  const Formatters = {
    formatDate(isoString) {
      if (!isoString) return '-';
      try {
        const d = new Date(isoString);
        return d.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        return isoString;
      }
    },

    formatCurrency(val) {
      const num = parseFloat(val);
      if (isNaN(num)) return '$0.00';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(num);
    },

    truncate(text, length = 40) {
      if (!text) return '';
      return text.length > length ? text.substring(0, length) + '...' : text;
    },

    exportToJson(data, filename = 'websql_backup.json') {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  global.Formatters = Formatters;
})(window);
