import { ref, computed } from 'vue';
import { useRouter } from '#app';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  firms?: Array<{
    firm: { id: string; name: string };
    grade: string;
  }>;
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

  // Initialize from LocalStorage (Client-side only)
  const initAuth = () => {
    if (!import.meta.client || isInitialized.value) return;

    try {
      const storedUser = localStorage.getItem('user');
      const storedAccess = localStorage.getItem('access_token');
      const storedRefresh = localStorage.getItem('refresh_token');
      const storedFirm = localStorage.getItem('active_firm_id');

      if (storedUser) user.value = JSON.parse(storedUser);
      if (storedAccess) {
        accessToken.value = storedAccess;
        scheduleTokenRefresh(storedAccess);
      }
      if (storedRefresh) refreshToken.value = storedRefresh;
      if (storedFirm) selectedFirmId.value = storedFirm;
    } catch (e) {
      console.error('Failed to restore auth state:', e);
    } finally {
      isInitialized.value = true;
    }
  };

  const isAuthenticated = computed(() => !!accessToken.value);

  const selectFirm = (firmId: string) => {
    selectedFirmId.value = firmId;
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
      const bufferMs = 2 * 60 * 1000; // 2 minutes before expiry
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
      try {
        const response = await $fetch<{ accessToken: string; refreshToken?: string }>('/api/auth/refresh', {
          method: 'POST',
          body: { refreshToken: refreshToken.value }
        });

        if (response.accessToken) {
          accessToken.value = response.accessToken;
          localStorage.setItem('access_token', response.accessToken);
          
          if (response.refreshToken) {
            refreshToken.value = response.refreshToken;
            localStorage.setItem('refresh_token', response.refreshToken);
          }
          
          scheduleTokenRefresh(response.accessToken);
          return response;
        }
        throw new Error('Refresh response missing token');
      } catch (e) {
        logout();
        throw e;
      } finally {
        refreshPromise.value = null;
      }
    })();

    return refreshPromise.value;
  };

  const setAuth = (newUser: User, newAccess: string, newRefresh: string) => {
    user.value = newUser;
    accessToken.value = newAccess;
    refreshToken.value = newRefresh;

    if (import.meta.client) {
      localStorage.setItem('user', JSON.stringify(newUser));
      localStorage.setItem('access_token', newAccess);
      localStorage.setItem('refresh_token', newRefresh);

      if (newUser.firms && newUser.firms.length > 0) {
        const currentFirmId = localStorage.getItem('active_firm_id') || newUser.firms[0].firm.id;
        localStorage.setItem('active_firm_id', currentFirmId);
        selectedFirmId.value = currentFirmId;
      }
    }

    scheduleTokenRefresh(newAccess);
  };

  const login = async (credentials: any) => {
    const response = await $fetch<{ user: User; accessToken: string; refreshToken: string }>('/api/auth/login', {
      method: 'POST',
      body: credentials
    });

    if (response && response.accessToken) {
      setAuth(response.user, response.accessToken, response.refreshToken);
    }
    return response;
  };

  const signup = async (userData: any) => {
    return await $fetch('/api/auth/signup', {
      method: 'POST',
      body: userData
    });
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

    if (import.meta.client) {
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('active_firm_id');
    }

    router.push('/login');
  };

  // Custom fetch helper that auto-appends JWT headers, handles 401s and updates rotated tokens
  const apiFetch = async <T = any>(request: string, options: any = {}): Promise<T> => {
    initAuth();

    options.headers = options.headers || {};
    
    // Inject Access Token
    if (accessToken.value) {
      options.headers['Authorization'] = `Bearer ${accessToken.value}`;
    }

    // Inject Refresh Token for silent refresh capabilities
    if (refreshToken.value) {
      options.headers['x-refresh-token'] = refreshToken.value;
    }

    // Inject Firm Context
    if (selectedFirmId.value) {
      options.headers['X-Firm-ID'] = selectedFirmId.value;
    }

    try {
      const response = await $fetch.raw<T>(request, options);

      // Check if server rotated the access token silently via headers
      const newAccessHeader = response.headers.get('x-new-access-token');
      if (newAccessHeader) {
        accessToken.value = newAccessHeader;
        if (import.meta.client) {
          localStorage.setItem('access_token', newAccessHeader);
        }
        scheduleTokenRefresh(newAccessHeader);
      }

      return response._data as T;
    } catch (error: any) {
      // Replicate interceptor 401 retry flow
      const status = error.status || error.statusCode;
      if (status === 401 && !request.includes('/auth/login') && !request.includes('/auth/refresh')) {
        // Attempt token rotation
        const rotated = await rotateToken();
        if (rotated && rotated.accessToken) {
          // Retry the request with new token
          options.headers['Authorization'] = `Bearer ${rotated.accessToken}`;
          return await apiFetch<T>(request, options);
        }
      }
      throw error;
    }
  };

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
