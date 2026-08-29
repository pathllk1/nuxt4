import { computed } from 'vue';
import { useRouter, useState, useCookie, useRequestFetch } from '#app';
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

// Client-side singleton promise lock for token rotation
let clientRefreshPromise: Promise<any> | null = null;
// Client-side singleton promise lock for initAuth
let clientInitAuthPromise: Promise<void> | null = null;
// Client-side guard & cooldown to prevent redundant logout calls (Finding 5)
let logoutInFlight = false;
let lastLogoutTime = 0;
const LOGOUT_COOLDOWN_MS = 2000;

type FetchFunction = <T = any>(request: string, options?: any) => Promise<T>;

export const useAuth = () => {
  const router = useRouter();
  // Capture requestFetch synchronously within the Nuxt composable context
  // (useRequestFetch as any)() prevents TS2589 / TS2321 generic recursion on Nitro route score types
  const requestFetch: FetchFunction = (import.meta.server ? (useRequestFetch as any)() : $fetch) as unknown as FetchFunction;

  // Nuxt useState for SSR state hydration (prevents cross-request pollution and works across F5 reloads)
  const user = useState<User | null>('auth_user', () => null);
  const selectedFirmId = useState<string | null>('auth_firm_id', () => null);
  const isInitialized = useState<boolean>('auth_initialized', () => false);

  const cookieFirm = useCookie<string | null>('active_firm_id', { maxAge: 60 * 60 * 24 * 30, path: '/' });

  const initAuth = async (options?: { force?: boolean }) => {
    // Idempotency guard: skip if already successfully authenticated unless force re-validation requested
    if (isInitialized.value && user.value && !options?.force) return;

    // Mutex guard: reuse in-flight client initialization promise to prevent race conditions
    if (import.meta.client && clientInitAuthPromise && !options?.force) {
      return clientInitAuthPromise;
    }

    const runInit = async () => {
      try {
        // Restore firm selection from cookie
        if (cookieFirm.value && cookieFirm.value !== 'undefined' && cookieFirm.value !== 'null') {
          selectedFirmId.value = cookieFirm.value;
        }

        // Ask server for user info - browser auto-sends HttpOnly cookies
        // /api/auth/me is protected by auth.global.ts which auto-refreshes tokens if expired
        try {
          const userData = await requestFetch<any>('/api/auth/me', { 
            credentials: 'include' 
          });
          
          if (userData && (userData.id || userData._id)) {
            user.value = {
              ...userData,
              id: userData.id || userData._id
            };
            
            // Set default firm if needed
            if (userData.firms && userData.firms.length > 0 && !selectedFirmId.value) {
              const defaultFirmId = extractFirmId(userData.firms[0]?.firm);
              if (defaultFirmId) {
                selectedFirmId.value = defaultFirmId;
                cookieFirm.value = defaultFirmId;
              }
            }
          } else {
            user.value = null;
          }
        } catch (error: any) {
          const status = error?.status || error?.statusCode;
          const isNetworkError = !status && (error?.message?.includes('fetch') || error?.name === 'TypeError');
          
          if (isNetworkError) {
            console.warn('[Auth] Network error during init, preserving session state until connection restores');
            return;
          }

          // If 401 (token expired or invalid), try explicit rotateToken fallback
          if (status === 401) {
            try {
              await rotateToken({ redirectIfFailed: false });
              
              // Retry getting user data with newly rotated token
              const userData = await requestFetch<any>('/api/auth/me', { 
                credentials: 'include' 
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
                user.value = null;
              }
            } catch (refreshError) {
              console.warn('[Auth] Token refresh failed during init:', refreshError);
              user.value = null;
            }
          } else {
            console.warn('[Auth] Failed to fetch user:', error);
          }
        }
      } catch (e) {
        console.error('[Auth] Unexpected error in initAuth:', e);
      } finally {
        isInitialized.value = true;
        if (import.meta.client) {
          clientInitAuthPromise = null;
        }
      }
    };

    if (import.meta.client) {
      clientInitAuthPromise = runInit();
      return clientInitAuthPromise;
    } else {
      return runInit();
    }
  };

  const isAuthenticated = computed(() => !!user.value);

  const selectFirm = (firmId: string) => {
    selectedFirmId.value = firmId;
    cookieFirm.value = firmId;
    if (import.meta.client) {
      localStorage.setItem('active_firm_id', firmId);
    }
  };

  let ssrRefreshPromise: Promise<any> | null = null;

  const rotateToken = async (options: { redirectIfFailed?: boolean } = {}): Promise<any> => {
    const existingPromise = import.meta.client ? clientRefreshPromise : ssrRefreshPromise;
    if (existingPromise) {
      return existingPromise;
    }

    const promise = (async () => {
      startRequest();
      try {
        const response = await requestFetch<{ success: boolean }>('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'  // Browser sends HttpOnly cookies automatically
        });

        // Server sets new tokens in HttpOnly cookies - we don't need to manage them client-side
        return response;
      } catch (e: any) {
        const status = e?.status || e?.statusCode || e?.data?.statusCode;
        const errorMsg = e?.data?.statusMessage || e?.statusMessage || e?.message || String(e);
        console.warn(`[Auth] Token refresh failed: ${errorMsg}`);
        
        // Only logout when redirectIfFailed is not false and it is a 401/403
        if ((status === 401 || status === 403) && options.redirectIfFailed !== false) {
          // Provide reason for logout
          let reason = 'session_expired';
          if (errorMsg.includes('deactivated') || errorMsg.includes('Exceeded maximum')) {
            reason = 'session_limit';
          }
          
          logout({ redirect: true, reason });
        }
        throw e;
      } finally {
        endRequest();
        if (import.meta.client) {
          clientRefreshPromise = null;
        } else {
          ssrRefreshPromise = null;
        }
      }
    })();

    if (import.meta.client) {
      clientRefreshPromise = promise;
    } else {
      ssrRefreshPromise = promise;
    }
    return promise;
  };

  const setAuth = (newUser: User) => {
    user.value = newUser;
    // Tokens are managed in HttpOnly cookies by server - no client-side token management needed

    if (newUser.firms && newUser.firms.length > 0) {
      const storedFirm = cookieFirm.value;
      const validFirmIds = newUser.firms
        .map((f: any) => extractFirmId(f.firm))
        .filter(Boolean) as string[];
      const defaultFirmId = validFirmIds[0] || null;

      // Only retain storedFirm if it actually belongs to this user's authorized firms!
      const currentFirmId = (storedFirm && validFirmIds.includes(storedFirm)) 
        ? storedFirm 
        : defaultFirmId;

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
      const response: any = await ($fetch as any)('/api/auth/login', {
        method: 'POST',
        body: credentials,
        credentials: 'include'
      });

      if (response && response.user) {
        setAuth(response.user);  // Server sets tokens in HttpOnly cookies
      }
      return response;
    } finally {
      endRequest();
    }
  };

  const signup = async (userData: any) => {
    startRequest();
    try {
      return await ($fetch as any)('/api/auth/signup', {
        method: 'POST',
        body: userData,
        credentials: 'include'
      });
    } finally {
      endRequest();
    }
  };

  const logout = (options?: { redirect?: boolean; reason?: string } | Event | any) => {
    const now = Date.now();
    if (import.meta.client && !logoutInFlight && (now - lastLogoutTime > LOGOUT_COOLDOWN_MS)) {
      logoutInFlight = true;
      lastLogoutTime = now;
      ($fetch as any)('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      }).catch(() => {}).finally(() => { 
        logoutInFlight = false; 
      });
    }

    user.value = null;
    selectedFirmId.value = null;
    cookieFirm.value = null;
    // No need to clear access/refresh tokens - server manages HttpOnly cookies

    const currentPath = router.currentRoute.value?.path || '';
    const publicRoutes = ['/', '/login', '/signup', '/about', '/contact', '/weather', '/privacy', '/terms'];
    const isPublic = publicRoutes.includes(currentPath);

    const redirectOpt = (options && typeof options === 'object' && !('preventDefault' in options) && 'redirect' in options) 
      ? options.redirect 
      : undefined;
    const reason = (options && typeof options === 'object' && !('preventDefault' in options) && 'reason' in options)
      ? options.reason
      : undefined;

    const shouldRedirect = redirectOpt ?? !isPublic;

    if (shouldRedirect) {
      const query = reason ? { reason } : {};
      router.push({ path: '/login', query });
    }
  };

  const apiFetch = async <T = any>(request: string, options: any = {}): Promise<T> => {
    options.headers = options.headers || {};
    options.credentials = options.credentials || 'include';  // Auto-send HttpOnly cookies

    // Only send firm ID header
    if (selectedFirmId.value && selectedFirmId.value !== 'undefined' && selectedFirmId.value !== 'null') {
      options.headers['X-Firm-ID'] = selectedFirmId.value;
    }

    startRequest();
    try {
      const response = await ($fetch as any).raw(request, options);
      return response._data as T;
    } catch (error: any) {
      const status = error?.status || error?.statusCode;
      
      // On 401 or 403 on client, attempt single-flight recovery and retry once
      if ((status === 401 || status === 403) && import.meta.client && !request.includes('/api/auth/')) {
        try {
          if (status === 401) {
            await rotateToken({ redirectIfFailed: false });
          } else if (status === 403) {
            // 403 could be due to stale firm selection or desynced session context
            await initAuth({ force: true });
            if (selectedFirmId.value) {
              options.headers['X-Firm-ID'] = selectedFirmId.value;
            }
          }
          const retryRes = await ($fetch as any).raw(request, options);
          return retryRes._data as T;
        } catch (retryErr) {
          throw retryErr;
        }
      }
      throw error;
    } finally {
      endRequest();
    }
  };

  return {
    user,
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
