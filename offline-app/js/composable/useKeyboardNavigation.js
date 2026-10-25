// composable/useKeyboardNavigation.js
// 100% Faithful Replica of Nuxt 4 app/composables/useKeyboardNavigation.ts
(function (global) {
  'use strict';

  function useKeyboardNavigation() {
    let lastFocusedElement = null;

    /**
     * Store current active element before opening a modal
     */
    const saveFocus = () => {
      if (!document.activeElement || !(document.activeElement instanceof HTMLElement)) return;
      const isInsideModal = document.activeElement.closest('.fixed, .drawer-backdrop, [role="dialog"]');
      if (!isInsideModal && document.activeElement.tagName !== 'BODY') {
        lastFocusedElement = document.activeElement;
      }
    };

    /**
     * Track focusin events on main page to continuously store last valid page input
     */
    const trackPageFocus = (container) => {
      const root = container || document.body;
      root.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target && target instanceof HTMLElement && target.tagName !== 'BODY') {
          const isInsideModal = target.closest('.fixed, .drawer-backdrop, [role="dialog"]');
          if (!isInsideModal) {
            lastFocusedElement = target;
          }
        }
      }, true);
    };

    /**
     * Restore focus to previously active element or fallback target selector
     */
    const restoreFocus = (fallbackSelector) => {
      setTimeout(() => {
        // If ANY modal/overlay is currently visible or active in the DOM, do not restore focus to the background page!
        const openModal = document.querySelector('.fixed:not([style*="display: none"]):not([style*="display:none"]), [role="dialog"], .quick-party-modal, .quick-stock-modal');
        if (openModal && openModal.offsetHeight > 0) {
          return;
        }

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function' && document.body.contains(lastFocusedElement)) {
          lastFocusedElement.focus();
          if (lastFocusedElement instanceof HTMLInputElement || lastFocusedElement instanceof HTMLTextAreaElement) {
            if (typeof lastFocusedElement.select === 'function') lastFocusedElement.select();
          }
          return;
        }
        const sel = fallbackSelector || '.first-input, .search-input, input:not([type="hidden"]), select';
        const el = document.querySelector(sel);
        if (el && typeof el.focus === 'function') {
          el.focus();
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            if (typeof el.select === 'function') el.select();
          }
        }
      }, 50);
    };

    /**
     * Auto focus an input or container when a modal opens with robust retries
     */
    const autoFocusContainer = (containerRef, inputSelector = 'input:not([type="hidden"]), select, textarea', maxAttempts = 5) => {
      let attempts = 0;
      const tryFocus = () => {
        const root = (containerRef && containerRef.$el) ? containerRef.$el : (containerRef || document);
        const target = root && root.querySelector ? root.querySelector(inputSelector) : null;
        if (target && typeof target.focus === 'function' && target.offsetHeight > 0) {
          target.focus();
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            if (typeof target.select === 'function') target.select();
          }
          return true;
        }
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryFocus, 35 * attempts);
        }
        return false;
      };

      if (!tryFocus()) {
        setTimeout(tryFocus, 25);
        setTimeout(tryFocus, 80);
        setTimeout(tryFocus, 180);
      }
    };

    /**
     * Query all visible DATA ENTRY FIELDS strictly (excluding buttons)
     */
    const getFocusableInputs = (container) => {
      if (!container) return [];
      const selector = 'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])';
      const elements = Array.from(container.querySelectorAll(selector));
      return elements.filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
      });
    };

    /**
     * Handle Enter key to move focus to next input field
     */
    const handleEnterKey = (e, container, onEnd) => {
      if (!container || e.key !== 'Enter') return;
      const target = e.target;
      if (!target) return;

      if (target.tagName === 'BUTTON') return;

      // Textarea: Shift+Enter allows newline; regular Enter PREVENTS newline and advances focus!
      if (target.tagName === 'TEXTAREA' && e.shiftKey) {
        return;
      }

      e.preventDefault();

      const inputs = getFocusableInputs(container);
      const currentIndex = inputs.indexOf(target);

      if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
        const nextInput = inputs[currentIndex + 1];
        if (nextInput) {
          nextInput.focus();
          if (nextInput instanceof HTMLInputElement || nextInput instanceof HTMLTextAreaElement) {
            if (typeof nextInput.select === 'function') nextInput.select();
          }
        }
      } else if (currentIndex === inputs.length - 1 && onEnd) {
        onEnd();
      }
    };

    /**
     * Handle Backspace key to move focus to previous input field when empty
     */
    const handleBackspaceKey = (e, container) => {
      if (!container || e.key !== 'Backspace') return;
      const target = e.target;
      if (!target || target.tagName === 'BUTTON') return;

      let shouldMoveBack = false;

      if (target instanceof HTMLInputElement) {
        const isTextOrNumber = ['text', 'number', 'search', 'tel', 'url', 'date', 'email'].includes(target.type);
        if (isTextOrNumber && (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0))) {
          shouldMoveBack = true;
        } else if (target.type === 'checkbox') {
          shouldMoveBack = true;
        }
      } else if (target instanceof HTMLTextAreaElement) {
        if (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0)) {
          shouldMoveBack = true;
        }
      } else if (target instanceof HTMLSelectElement) {
        shouldMoveBack = true;
      }

      if (shouldMoveBack) {
        const inputs = getFocusableInputs(container);
        const currentIndex = inputs.indexOf(target);
        if (currentIndex > 0) {
          e.preventDefault();
          const prevInput = inputs[currentIndex - 1];
          if (prevInput) {
            prevInput.focus();
            if (prevInput instanceof HTMLInputElement || prevInput instanceof HTMLTextAreaElement) {
              if (typeof prevInput.select === 'function') prevInput.select();
            }
          }
        }
      }
    };

    /**
     * Focus and auto-select the first focusable input in a container
     */
    const focusFirstInput = (container) => {
      if (!container) return;
      setTimeout(() => {
        const inputs = getFocusableInputs(container);
        const firstEl = inputs[0];
        if (firstEl) {
          firstEl.focus();
          if (firstEl instanceof HTMLInputElement || firstEl instanceof HTMLTextAreaElement) {
            if (typeof firstEl.select === 'function') firstEl.select();
          }
        }
      }, 50);
    };

    return {
      saveFocus,
      restoreFocus,
      trackPageFocus,
      autoFocusContainer,
      focusFirstInput,
      getFocusableInputs,
      handleEnterKey,
      handleBackspaceKey
    };
  }

  global.useKeyboardNavigation = useKeyboardNavigation;
})(window);
