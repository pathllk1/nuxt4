import { computed } from 'vue';
import { useRouter, useState, useCookie } from '#app';
import { startRequest, endRequest } from '../utils/api';

export interface User {
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

export const useAuth = () => {
  const router = useRouter();

  // Nuxt useState for SSR state hydration (prevents cross-request pollution and works across F5 reloads)
  const user = useState<User | null>('auth_user', () => null);
  const accessToken = useState<string | null>('auth_access_token', () => null);
  const refreshToken = useState<string | null>('auth_refresh_token', () => null);
  const selectedFirmId = useState<string | null>('auth_firm_id', () => null);
  const isInitialized = useState<boolean>('auth_initialized', () => false);

  // Singleton promise lock for token rotation
  const refreshPromise = useState<Promise<any> | null>('auth_refresh_promise', () => null);

  const cookieFirm = useCookie<string | null>('active_firm_id', { maxAge: 60 * 60 * 24 * 30, path: '/' });
  const cookieAccess = useCookie<string | null>('access_token', { maxAge: 15 * 60, path: '/' });

  const initAuth = async () => {
    try {
      if (cookieFirm.value && cookieFirm.value !== 'undefined' && cookieFirm.value !== 'null') {
        selectedFirmId.value = cookieFirm.value;
      }

      if (cookieAccess.value) {
        accessToken.value = cookieAccess.value;
      }

      if (import.meta.client) {
        const storedFirm = localStorage.getItem('active_firm_id');
        if (!selectedFirmId.value && storedFirm && storedFirm !== 'undefined' && storedFirm !== 'null') {
          selectedFirmId.value = storedFirm;
          cookieFirm.value = storedFirm;
        }

        // If user state is empty on client mount, recover user profile securely via HttpOnly cookie
        if (!user.value) {
          try {
            const userData = await $fetch<any>('/api/auth/me', { credentials: 'include' });
            if (userData && (userData.id || userData._id)) {
              user.value = {
                ...userData,
                id: userData.id || userData._id
              };
              if (userData.firms && userData.firms.length > 0 && !selectedFirmId.value) {
                const defaultFirmId = extractFirmId(userData.firms[0]?.firm);
                if (defaultFirmId) {
                  selectedFirmId.value = defaultFirmId;
                  cookieFirm.value = defaultFirmId;
                }
              }
            } else {
              logout({ redirect: false });
            }
          } catch {
            // Profile fetch failed — attempt quiet silent refresh without redirecting public route visitors
            const refreshed = await rotateToken({ redirectIfFailed: false }).catch(() => null);
            if (refreshed && refreshed.accessToken) {
              try {
                const userData = await $fetch<any>('/api/auth/me', {
                  credentials: 'include',
                  headers: { Authorization: `Bearer ${refreshed.accessToken}` }
                });
                if (userData && (userData.id || userData._id)) {
                  user.value = {
                    ...userData,
                    id: userData.id || userData._id
                  };
                  if (userData.firms && userData.firms.length > 0 && !selectedFirmId.value) {
                    const defaultFirmId = extractFirmId(userData.firms[0]?.firm);
                    if (defaultFirmId) {
                      selectedFirmId.value = defaultFirmId;
                      cookieFirm.value = defaultFirmId;
                    }
                  }
                } else {
                  logout({ redirect: false });
                }
              } catch {
                logout({ redirect: false });
              }
            } else {
              logout({ redirect: false });
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to restore auth state:', e);
      logout({ redirect: false });
    } finally {
      isInitialized.value = true;
    }
  };

  const isAuthenticated = computed(() => {
    if (user.value) return true;
    if (!isInitialized.value && accessToken.value) return true;
    return false;
  });

  const selectFirm = (firmId: string) => {
    selectedFirmId.value = firmId;
    cookieFirm.value = firmId;
    if (import.meta.client) {
      localStorage.setItem('active_firm_id', firmId);
    }
  };

  const rotateToken = async (options: { redirectIfFailed?: boolean } = {}): Promise<any> => {
    if (refreshPromise.value) {
      return refreshPromise.value;
    }

    const promise = (async () => {
      startRequest();
      try {
        const response = await $fetch<{ accessToken: string; refreshToken?: string }>('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });

        if (response && response.accessToken) {
          accessToken.value = response.accessToken;
          if (response.refreshToken) {
            refreshToken.value = response.refreshToken;
          }
          return response;
        }
        throw new Error('Refresh response missing token');
      } catch (e) {
        console.warn('[Auth] Token refresh failed:', e);
        logout({ redirect: options.redirectIfFailed });
        throw e;
      } finally {
        endRequest();
        refreshPromise.value = null;
      }
    })();

    refreshPromise.value = promise;
    return promise;
  };

  const setAuth = (newUser: User, newAccess: string, newRefresh: string) => {
    user.value = newUser;
    accessToken.value = newAccess;
    refreshToken.value = newRefresh;

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
  };

  const login = async (credentials: any) => {
    startRequest();
    try {
      const response = await $fetch<{ user: User; accessToken: string; refreshToken: string }>('/api/auth/login', {
        method: 'POST',
        body: credentials,
        credentials: 'include'
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
        body: userData,
        credentials: 'include'
      });
    } finally {
      endRequest();
    }
  };

  const logout = (options?: { redirect?: boolean } | Event | any) => {
    $fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    }).catch(err => console.warn('Logout endpoint failed:', err));

    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    selectedFirmId.value = null;
    cookieFirm.value = null;
    cookieAccess.value = null;

    if (import.meta.client) {
      localStorage.removeItem('active_firm_id');
      try {
        document.cookie = 'access_token=; Max-Age=0; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'refresh_token=; Max-Age=0; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'active_firm_id=; Max-Age=0; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      } catch {}
    }

    const currentPath = router.currentRoute.value?.path || '';
    const publicRoutes = ['/', '/login', '/signup', '/about', '/contact', '/weather', '/privacy', '/terms'];
    const isPublic = publicRoutes.includes(currentPath);

    const redirectOpt = (options && typeof options === 'object' && !('preventDefault' in options) && 'redirect' in options) 
      ? options.redirect 
      : undefined;

    const shouldRedirect = redirectOpt ?? !isPublic;

    if (shouldRedirect) {
      router.push('/login');
    }
  };

  const apiFetch = async <T = any>(request: string, options: any = {}): Promise<T> => {
    options.headers = options.headers || {};
    options.credentials = options.credentials || 'include';

    if (accessToken.value) {
      options.headers['Authorization'] = `Bearer ${accessToken.value}`;
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
      }

      return response._data as T;
    } catch (error: any) {
      const status = error.status || error.statusCode;
      if (status === 401 && !request.includes('/auth/login') && !request.includes('/auth/refresh')) {
        const rotated = await rotateToken().catch(() => null);
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
