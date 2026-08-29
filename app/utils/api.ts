import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

export const isGlobalLoading = ref(false)
let activeRequestsCount = 0

export const startRequest = () => {
  activeRequestsCount++
  isGlobalLoading.value = true
}

export const endRequest = () => {
  activeRequestsCount = Math.max(0, activeRequestsCount - 1)
  if (activeRequestsCount === 0) {
    isGlobalLoading.value = false
  }
}

/**
 * Decodes JWT payload client-side to extract exp claim for countdown timer.
 */
export const decodeTokenPayload = (token: string): any | null => {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    try {
      return JSON.parse(atob(token.split('.')[1] || ''))
    } catch {
      return null
    }
  }
}

const getActiveFirmId = (): string | null => {
  if (typeof window === 'undefined') return null
  const auth = useAuth()
  if (auth.selectedFirmId.value) return auth.selectedFirmId.value
  const firm = localStorage.getItem('active_firm_id')
  if (firm && firm !== 'undefined' && firm !== 'null') return firm
  return null
}

const rawRequest = async (endpoint: string, options: any = {}): Promise<any> => {
  // SSR Guard: Native fetch() in Node.js does not forward browser HttpOnly cookies.
  // Use $fetch or useRequestFetch() instead of this utility during SSR.
  if (import.meta.server) {
    throw new Error(`[api.ts] rawRequest called during SSR for "${endpoint}". Use $fetch or useRequestFetch() for server-side requests to ensure cookies are forwarded.`)
  }

  const url = endpoint.startsWith('http') ? endpoint : (endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`)
  
  let finalUrl = url
  if (options.params) {
    const searchParams = new URLSearchParams()
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) searchParams.append(key, String(val))
    })
    const qs = searchParams.toString()
    if (qs) finalUrl += (finalUrl.includes('?') ? '&' : '?') + qs
  }

  const auth = useAuth()
  // No need to get token - it's in HttpOnly cookies
  const firmId = getActiveFirmId()

  const headers: Record<string, string> = {
    ...(options.body !== undefined && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  }

  // Don't set Authorization header - tokens are in HttpOnly cookies
  if (firmId) headers['X-Firm-ID'] = firmId

  const performRequest = async (retry = true): Promise<any> => {
    const response = await fetch(finalUrl, {
      ...options,
      headers,
      credentials: options.credentials || 'include'  // Send HttpOnly cookies
    })

    // No need to read x-new-access-token - server sets cookies directly

    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh') && retry) {
      const rotated = await auth.rotateToken({ redirectIfFailed: false }).catch(() => null)
      if (rotated) {
        // Token refreshed in cookies, retry request
        const retryRes = await fetch(finalUrl, {
          ...options,
          headers,
          credentials: options.credentials || 'include'
        })
        if (!retryRes.ok) {
          const errData = await retryRes.json().catch(() => ({}))
          throw new Error(errData.message || `Retry failed! status: ${retryRes.status}`)
        }
        if (options.responseType === 'blob') {
          return retryRes.blob()
        }
        return retryRes.json()
      }
      if (!auth.isAuthenticated.value) {
        throw new Error('Session expired. Please login again.')
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An unknown error occurred' }))
      throw new Error(error.message || `HTTP error! status: ${response.status}`)
    }

    if (options.responseType === 'blob') {
      return response.blob()
    }

    return response.json()
  }

  startRequest()
  try {
    return await performRequest()
  } finally {
    endRequest()
  }
}

export const api = {
  get: (url: string, options?: any) => rawRequest(url, { ...options, method: 'GET' }),
  post: (url: string, data?: any, options?: any) => rawRequest(url, { ...options, method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: (url: string, data?: any, options?: any) => rawRequest(url, { ...options, method: 'PUT', body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: (url: string, data?: any, options?: any) => rawRequest(url, { ...options, method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: (url: string, options?: any) => rawRequest(url, { ...options, method: 'DELETE' }),
  upload: (url: string, formData: FormData, options?: any) => rawRequest(url, { ...options, method: 'POST', body: formData }),
  uploadPut: (url: string, formData: FormData, options?: any) => rawRequest(url, { ...options, method: 'PUT', body: formData }),
}

export const useApi = () => {
  return {
    ...api,
    download: async (endpoint: string, filename: string, method: string = 'GET', data?: any) => {
      const res = await rawRequest(endpoint, { method, body: data ? JSON.stringify(data) : undefined, responseType: 'blob' })
      if (typeof window !== 'undefined') {
        const url = window.URL.createObjectURL(res)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    }
  }
}
