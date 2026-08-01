import { ref } from 'vue'

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
    // Handle standard base64 and base64url encoding safely
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
