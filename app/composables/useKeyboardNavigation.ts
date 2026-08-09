import { ref, nextTick } from 'vue'

export function useKeyboardNavigation() {
  const lastFocusedElement = ref<HTMLElement | null>(null)

  /**
   * Store current active element before opening a modal
   */
  const saveFocus = () => {
    if (!import.meta.client || !document.activeElement || !(document.activeElement instanceof HTMLElement)) return
    const isInsideModal = document.activeElement.closest('.fixed, .drawer-backdrop, [role="dialog"]')
    if (!isInsideModal && document.activeElement.tagName !== 'BODY') {
      lastFocusedElement.value = document.activeElement
    }
  }

  /**
   * Track focusin events on main page to continuously store last valid page input
   */
  const trackPageFocus = (container?: HTMLElement | null) => {
    if (!import.meta.client) return
    const root = container || document.body
    root.addEventListener('focusin', (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target && target instanceof HTMLElement && target.tagName !== 'BODY') {
        const isInsideModal = target.closest('.fixed, .drawer-backdrop, [role="dialog"]')
        if (!isInsideModal) {
          lastFocusedElement.value = target
        }
      }
    }, true)
  }

  /**
   * Restore focus to previously active element or fallback target selector
   */
  const restoreFocus = (fallbackSelector?: string) => {
    if (!import.meta.client) return
    setTimeout(() => {
      if (lastFocusedElement.value && typeof lastFocusedElement.value.focus === 'function' && document.body.contains(lastFocusedElement.value)) {
        lastFocusedElement.value.focus()
        if (lastFocusedElement.value instanceof HTMLInputElement || lastFocusedElement.value instanceof HTMLTextAreaElement) {
          lastFocusedElement.value.select?.()
        }
        return
      }
      if (fallbackSelector) {
        const el = document.querySelector(fallbackSelector) as HTMLElement
        if (el && typeof el.focus === 'function') {
          el.focus()
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.select?.()
          }
        }
      }
    }, 50)
  }

  /**
   * Auto focus an input or container when a modal opens
   */
  const autoFocusContainer = (containerRef: HTMLElement | null, inputSelector = 'input:not([type="hidden"]), select, textarea') => {
    if (!import.meta.client) return
    nextTick(() => {
      if (!containerRef) return
      const target = containerRef.querySelector(inputSelector) as HTMLElement
      if (target && typeof target.focus === 'function') {
        target.focus()
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          target.select?.()
        }
      }
    })
  }

  /**
   * Query all visible DATA ENTRY FIELDS strictly (excluding buttons)
   */
  const getFocusableInputs = (container: HTMLElement): HTMLElement[] => {
    // STRICT RULE: Query only input, select, textarea data fields. NEVER include buttons!
    const selector = 'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])'
    const elements = Array.from(container.querySelectorAll<HTMLElement>(selector))
    return elements.filter(el => {
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0
    })
  }

  /**
   * Handle Enter key to move focus to next input field
   */
  const handleEnterKey = (e: KeyboardEvent, container: HTMLElement | null, onEnd?: () => void) => {
    if (!container || e.key !== 'Enter') return
    const target = e.target as HTMLElement
    if (!target) return

    // Never handle buttons here
    if (target.tagName === 'BUTTON') return

    // Textarea: Shift+Enter allows newline; regular Enter PREVENTS newline and advances focus!
    if (target.tagName === 'TEXTAREA' && e.shiftKey) {
      return // Allow browser to insert a new line on Shift+Enter
    }

    // Always prevent default on Enter to stop newline in textarea & form submit
    e.preventDefault()

    // Checkbox: Enter toggles state and advances
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      target.click()
    }

    const inputs = getFocusableInputs(container)
    const currentIndex = inputs.indexOf(target)

    if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
      e.preventDefault()
      const nextInput = inputs[currentIndex + 1]
      if (nextInput) {
        nextInput.focus()
        if (nextInput instanceof HTMLInputElement || nextInput instanceof HTMLTextAreaElement) {
          nextInput.select?.()
        }
      }
    } else if (currentIndex === inputs.length - 1 && onEnd) {
      e.preventDefault()
      onEnd()
    }
  }

  /**
   * Handle Backspace key to move focus to previous input field when empty
   */
  const handleBackspaceKey = (e: KeyboardEvent, container: HTMLElement | null) => {
    if (!container || e.key !== 'Backspace') return
    const target = e.target as HTMLElement
    if (!target) return

    if (target.tagName === 'BUTTON') return

    let shouldMoveBack = false

    if (target instanceof HTMLInputElement) {
      const isTextOrNumber = ['text', 'number', 'search', 'tel', 'url'].includes(target.type)
      if (isTextOrNumber && (target.value === '' || target.selectionStart === 0)) {
        shouldMoveBack = true
      } else if (target.type === 'checkbox') {
        shouldMoveBack = true
      }
    } else if (target instanceof HTMLSelectElement) {
      shouldMoveBack = true
    }

    if (shouldMoveBack) {
      const inputs = getFocusableInputs(container)
      const currentIndex = inputs.indexOf(target)
      if (currentIndex > 0) {
        e.preventDefault()
        const prevInput = inputs[currentIndex - 1]
        if (prevInput) {
          prevInput.focus()
          if (prevInput instanceof HTMLInputElement || prevInput instanceof HTMLTextAreaElement) {
            prevInput.select?.()
          }
        }
      }
    }
  }

  return {
    saveFocus,
    restoreFocus,
    trackPageFocus,
    autoFocusContainer,
    getFocusableInputs,
    handleEnterKey,
    handleBackspaceKey
  }
}
