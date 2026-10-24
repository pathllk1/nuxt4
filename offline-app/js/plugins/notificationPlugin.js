// plugins/notificationPlugin.js
(function (global) {
  'use strict';

  const NotificationPlugin = {
    install(app) {
      const notifications = Vue.reactive([]);

      const notify = (message, type = 'info', duration = 3500) => {
        const id = Date.now() + Math.random().toString(36).substring(2, 7);
        const item = { id, message, type };
        notifications.push(item);

        if (duration > 0) {
          setTimeout(() => {
            const idx = notifications.findIndex((n) => n.id === id);
            if (idx !== -1) notifications.splice(idx, 1);
          }, duration);
        }
      };

      const remove = (id) => {
        const idx = notifications.findIndex((n) => n.id === id);
        if (idx !== -1) notifications.splice(idx, 1);
      };

      app.config.globalProperties.$notify = notify;
      app.provide('notifications', {
        items: notifications,
        notify,
        remove
      });
    }
  };

  global.NotificationPlugin = NotificationPlugin;
})(window);
