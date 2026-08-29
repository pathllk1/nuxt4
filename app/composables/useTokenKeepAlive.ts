import { onMounted, onUnmounted } from 'vue';
import { useAuth } from './useAuth';

/**
 * Proactively refreshes/validates authentication when the user returns
 * to the browser tab after idle or device sleep (via visibilitychange and focus).
 */
export const useTokenKeepAlive = () => {
  if (import.meta.server) return;

  const { isAuthenticated, initAuth } = useAuth();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastCheckTime = 0;
  const MIN_CHECK_INTERVAL_MS = 30 * 1000; // Check up to twice per minute

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
        // Proactively re-validate session and re-sync user/firm context from /api/auth/me on wake.
        // This keeps tokens fresh, warms serverless functions, and ensures selectedFirmId matches
        // the active user before primary actions or page queries fire.
        await initAuth({ force: true });
      } catch (error) {
        console.debug('[KeepAlive] Wakeup session validation notice:', error);
      }
    }, 100);
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
