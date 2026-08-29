import { onMounted, onUnmounted } from 'vue';
import { useAuth } from './useAuth';

/**
 * Proactively refreshes/validates authentication when the user returns
 * to the browser tab after idle or device sleep (via visibilitychange and focus).
 */
export const useTokenKeepAlive = () => {
  if (import.meta.server) return;

  const { isAuthenticated, rotateToken } = useAuth();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastCheckTime = 0;
  const MIN_CHECK_INTERVAL_MS = 60 * 1000; // Do not check more than once per minute

  const handleWakeup = () => {
    if (document.visibilityState !== 'visible' || !isAuthenticated.value) {
      return;
    }

    const now = Date.now();
    if (now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      lastCheckTime = Date.now();
      try {
        // Proactively refresh tokens silently on wake to warm serverless instance
        // and ensure cookies are refreshed before user triggers primary actions
        await rotateToken({ redirectIfFailed: false });
      } catch (error) {
        // Silently handled; regular request retry will take over if needed
        console.debug('[KeepAlive] Silent wake refresh completed or skipped:', error);
      }
    }, 400);
  };

  onMounted(() => {
    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('focus', handleWakeup);
  });

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleWakeup);
    window.removeEventListener('focus', handleWakeup);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });
};
