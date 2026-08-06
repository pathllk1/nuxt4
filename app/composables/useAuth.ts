import { ref, computed } from 'vue';
import { useRouter, useCookie } from '#app';
import { startRequest, endRequest } from '../utils/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  firms?: Array<{
    firm: any;
    grade: string;
  }>;
}

export function extractFirmId(firm: any): string | null {
  if (!firm) return null;
  if (typeof firm === 'string') return firm;
  return firm.id || firm._id || null;
}

// Global refs so state is shared across all useAuth usage instances
const user = ref<User | null>(null);
const accessToken = ref<string | null>(null);
const refreshToken = ref<string | null>(null);
const selectedFirmId = ref<string | null>(null);
const isInitialized = ref(false);
const refreshTimer = ref<any>(null);
const refreshPromise = ref<Promise<any> | null>(null);

export const useAuth = () => {
  const router = useRouter();

  const cookieAccess = useCookie<string | null>('access_token', { maxAge: 60 * 60 * 24 * 7, path: '/' });
  const cookieRefresh = useCookie<string | null>('refresh_token', { maxAge: 60 * 60 * 24 * 30, path: '/' });
  const cookieUser = useCookie<any>('user', { maxAge: 60 * 60 * 24 * 7, path: '/' });
  const cookieFirm = useCookie<string | null>('active_firm_id', { maxAge: 60 * 60 * 24 * 30, path: '/' });

  // Synchronously initialize from Cookies (SSR & Client) and LocalStorage (Client fallback)
  const initAuth = () => {
    try {
      // 1. Sync from Cookies (works during SSR and Client)
      if (cookieAccess.value) accessToken.value = cookieAccess.value;
      if (cookieRefresh.value) refreshToken.value = cookieRefresh.value;
      if (cookieUser.value) {
        user.value = typeof cookieUser.value === 'string' ? JSON.parse(cookieUser.value) : cookieUser.value;
      }
      if (cookieFirm.value && cookieFirm.value !== 'undefined' && cookieFirm.value !== 'null') {
        selectedFirmId.value = cookieFirm.value;
      }

      // 2. Client-side fallback to LocalStorage (also sync back to cookies if cookies missing)
      if (import.meta.client) {
        const storedUser = localStorage.getItem('user');
        const storedAccess = localStorage.getItem('access_token');
        const storedRefresh = localStorage.getItem('refresh_token');
        const storedFirm = localStorage.getItem('active_firm_id');

        if (!user.value && storedUser) user.value = JSON.parse(storedUser);
        if (!accessToken.value && storedAccess) {
          accessToken.value = storedAccess;
          cookieAccess.value = storedAccess;
        }
        if (!refreshToken.value && storedRefresh) {
          refreshToken.value = storedRefresh;
          cookieRefresh.value = storedRefresh;
        }
        if (!selectedFirmId.value && storedFirm && storedFirm !== 'undefined' && storedFirm !== 'null') {
          selectedFirmId.value = storedFirm;
          cookieFirm.value = storedFirm;
        }

        if (accessToken.value) {
          scheduleTokenRefresh(accessToken.value);
        }
      }
    } catch (e) {
      console.error('Failed to restore auth state:', e);
    } finally {
      isInitialized.value = true;
    }
  };

  const isAuthenticated = computed(() => !!accessToken.value);

  const selectFirm = (firmId: string) => {
    selectedFirmId.value = firmId;
    cookieFirm.value = firmId;
    if (import.meta.client) {
      localStorage.setItem('active_firm_id', firmId);
    }
  };

  const scheduleTokenRefresh = (token: string) => {
    if (!import.meta.client) return;

    if (refreshTimer.value) {
      clearTimeout(refreshTimer.value);
      refreshTimer.value = null;
    }

    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return;
      const decodedPayload = JSON.parse(atob(payloadBase64));
      
      if (!decodedPayload || !decodedPayload.exp) return;
      
      const expiresAtMs = decodedPayload.exp * 1000;
      const now = Date.now();
      const bufferMs = 2 * 60 * 1000;
      const delayMs = Math.max(0, expiresAtMs - now - bufferMs);

      refreshTimer.value = setTimeout(async () => {
        try {
          await rotateToken();
        } catch (e) {
          console.warn('[Auth] Scheduled token refresh failed:', e);
        }
      }, delayMs);
    } catch (e) {
      console.error('Error scheduling token refresh:', e);
    }
  };

  const rotateToken = async (): Promise<any> => {
    if (refreshPromise.value) {
      return refreshPromise.value;
    }

    if (!refreshToken.value) {
      logout();
      return null;
    }

    refreshPromise.value = (async () => {
      startRequest();
      try {
        const response = await $fetch<{ accessToken: string; refreshToken?: string }>('/api/auth/refresh', {
          method: 'POST',
          body: { refreshToken: refreshToken.value }
        });

        if (response.accessToken) {
          accessToken.value = response.accessToken;
          cookieAccess.value = response.accessToken;
          if (import.meta.client) {
            localStorage.setItem('access_token', response.accessToken);
          }
          
          if (response.refreshToken) {
            refreshToken.value = response.refreshToken;
            cookieRefresh.value = response.refreshToken;
            if (import.meta.client) {
              localStorage.setItem('refresh_token', response.refreshToken);
            }
          }
          
          scheduleTokenRefresh(response.accessToken);
          return response;
        }
        throw new Error('Refresh response missing token');
      } catch (e) {
        logout();
        throw e;
      } finally {
        endRequest();
        refreshPromise.value = null;
      }
    })();

    return refreshPromise.value;
  };

  const setAuth = (newUser: User, newAccess: string, newRefresh: string) => {
    user.value = newUser;
    accessToken.value = newAccess;
    refreshToken.value = newRefresh;

    cookieAccess.value = newAccess;
    cookieRefresh.value = newRefresh;
    cookieUser.value = newUser;

    if (newUser.firms && newUser.firms.length > 0) {
      const storedFirm = cookieFirm.value || (import.meta.client ? localStorage.getItem('active_firm_id') : null);
      const defaultFirmId = extractFirmId(newUser.firms[0]?.firm);
      const currentFirmId = (storedFirm && storedFirm !== 'undefined' && storedFirm !== 'null') ? storedFirm : defaultFirmId;
      if (currentFirmId) {
        cookieFirm.value = currentFirmId;
        selectedFirmId.value = currentFirmId;
        if (import.meta.client) {
          localStorage.setItem('active_firm_id', currentFirmId);
        }
      }
    }

    if (import.meta.client) {
      localStorage.setItem('user', JSON.stringify(newUser));
      localStorage.setItem('access_token', newAccess);
      localStorage.setItem('refresh_token', newRefresh);
    }

    scheduleTokenRefresh(newAccess);
  };

  const login = async (credentials: any) => {
    startRequest();
    try {
      const response = await $fetch<{ user: User; accessToken: string; refreshToken: string }>('/api/auth/login', {
        method: 'POST',
        body: credentials
      });

      if (response && response.accessToken) {
        setAuth(response.user, response.accessToken, response.refreshToken);
      }
      return response;
    } finally {
      endRequest();
    }
  };

  const signup = async (userData: any) => {
    startRequest();
    try {
      return await $fetch('/api/auth/signup', {
        method: 'POST',
        body: userData
      });
    } finally {
      endRequest();
    }
  };

  const logout = () => {
    if (refreshTimer.value) {
      clearTimeout(refreshTimer.value);
      refreshTimer.value = null;
    }

    if (refreshToken.value) {
      $fetch('/api/auth/logout', {
        method: 'POST',
        body: { refreshToken: refreshToken.value },
        headers: accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {}
      }).catch(err => console.warn('Logout endpoint failed:', err));
    }

    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    selectedFirmId.value = null;

    cookieAccess.value = null;
    cookieRefresh.value = null;
    cookieUser.value = null;
    cookieFirm.value = null;

    if (import.meta.client) {
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('active_firm_id');
    }

    router.push('/login');
  };

  const apiFetch = async <T = any>(request: string, options: any = {}): Promise<T> => {
    initAuth();

    options.headers = options.headers || {};
    
    if (accessToken.value) {
      options.headers['Authorization'] = `Bearer ${accessToken.value}`;
    }

    if (refreshToken.value) {
      options.headers['x-refresh-token'] = refreshToken.value;
    }

    if (selectedFirmId.value && selectedFirmId.value !== 'undefined' && selectedFirmId.value !== 'null') {
      options.headers['X-Firm-ID'] = selectedFirmId.value;
    }

    startRequest();
    try {
      const response = await $fetch.raw<T>(request, options);

      const newAccessHeader = response.headers.get('x-new-access-token');
      if (newAccessHeader) {
        accessToken.value = newAccessHeader;
        cookieAccess.value = newAccessHeader;
        if (import.meta.client) {
          localStorage.setItem('access_token', newAccessHeader);
        }
        scheduleTokenRefresh(newAccessHeader);
      }

      const newRefreshHeader = response.headers.get('x-new-refresh-token');
      if (newRefreshHeader) {
        refreshToken.value = newRefreshHeader;
        cookieRefresh.value = newRefreshHeader;
        if (import.meta.client) {
          localStorage.setItem('refresh_token', newRefreshHeader);
        }
      }

      return response._data as T;
    } catch (error: any) {
      const status = error.status || error.statusCode;
      if (status === 401 && !request.includes('/auth/login') && !request.includes('/auth/refresh')) {
        const rotated = await rotateToken();
        if (rotated && rotated.accessToken) {
          options.headers['Authorization'] = `Bearer ${rotated.accessToken}`;
          return await apiFetch<T>(request, options);
        }
      }
      throw error;
    } finally {
      endRequest();
    }
  };

  // Run initAuth immediately when useAuth() is created
  initAuth();

  return {
    user,
    accessToken,
    refreshToken,
    selectedFirmId,
    isAuthenticated,
    initAuth,
    login,
    signup,
    logout,
    selectFirm,
    apiFetch,
    rotateToken
  };
};
