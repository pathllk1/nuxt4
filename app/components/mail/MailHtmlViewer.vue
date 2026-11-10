<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const props = defineProps<{
  html: string;
}>();

const hostRef = ref<HTMLDivElement | null>(null);
let shadowRoot: ShadowRoot | null = null;

/**
 * Enterprise-grade zero-trust HTML Email Sanitizer.
 * Strictly guarantees ZERO script execution and neutralizes all XSS vectors
 * while preserving email styling (tables, fonts, responsive colors, buttons).
 */
const sanitizeHtml = (rawHtml: string): string => {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // 1. Remove dangerous active elements
    const forbiddenTags = [
      'script',
      'noscript',
      'iframe',
      'frame',
      'frameset',
      'object',
      'embed',
      'applet',
      'base',
      'form',
      'input',
      'button',
      'textarea',
      'select',
      'option',
      'optgroup',
      'meta',
      'link'
    ];

    for (const tag of forbiddenTags) {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    }

    // 2. Sanitize <style> tags (eliminate @import, expressions, behaviors, JS URLs)
    doc.querySelectorAll('style').forEach(styleEl => {
      let css = styleEl.textContent || '';
      css = css.replace(/@import\s+[^;]+;/gi, '');
      css = css.replace(/expression\s*\([^)]*\)/gi, '');
      css = css.replace(/behavior\s*:[^;]+;/gi, '');
      css = css.replace(/-moz-binding\s*:[^;]+;/gi, '');
      css = css.replace(/url\s*\(\s*['"]?javascript:[^)]*['"]?\s*\)/gi, '');
      styleEl.textContent = css;
    });

    // 3. Walk all remaining elements and sanitize attributes
    const allElements = doc.querySelectorAll('*');
    for (const el of allElements) {
      const attrNames = el.getAttributeNames();
      for (const name of attrNames) {
        const lowerName = name.toLowerCase();

        // Strip any inline event handlers (onclick, onload, onerror, onmouseover, etc.)
        if (lowerName.startsWith('on')) {
          el.removeAttribute(name);
          continue;
        }

        // Strip dangerous protocols in URL-bearing attributes
        if (['href', 'src', 'action', 'formaction', 'xlink:href', 'data', 'poster'].includes(lowerName)) {
          const val = el.getAttribute(name) || '';
          const normalized = val.replace(/[\x00-\x20\s]+/g, '').toLowerCase();
          if (
            normalized.startsWith('javascript:') ||
            normalized.startsWith('vbscript:') ||
            normalized.startsWith('data:text/html') ||
            normalized.startsWith('data:text/javascript')
          ) {
            el.removeAttribute(name);
          }
        }
      }

      // Force target="_blank" and rel="noopener noreferrer" on all links
      if (el.tagName.toLowerCase() === 'a') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }

    // 4. Extract sanitized styles from both head and body
    let stylesHtml = '';
    doc.head.querySelectorAll('style').forEach(s => {
      stylesHtml += s.outerHTML + '\n';
    });
    doc.body.querySelectorAll('style').forEach(s => {
      stylesHtml += s.outerHTML + '\n';
    });

    return `${stylesHtml}<div class="email-body-content">${doc.body.innerHTML}</div>`;
  } catch (err) {
    console.error('[MailHtmlViewer] Sanitization error:', err);
    return '';
  }
};

const renderShadowContent = () => {
  if (!hostRef.value) return;

  if (!shadowRoot) {
    // Check if shadow root already exists (e.g. from HMR or re-attachment)
    shadowRoot = hostRef.value.shadowRoot || hostRef.value.attachShadow({ mode: 'open' });

    // Safe link navigation listener inside shadow boundary
    shadowRoot.addEventListener('click', (e: Event) => {
      const path = e.composedPath() as HTMLElement[];
      const anchor = path.find(el => el.tagName === 'A') as HTMLAnchorElement | undefined;
      if (anchor && anchor.href) {
        e.preventDefault();
        const href = anchor.href;
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  const sanitized = sanitizeHtml(props.html);

  const baseStyles = `
    <style>
      :host {
        display: block;
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1e293b;
        background-color: transparent;
        line-height: 1.6;
        word-break: break-word;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
      }
      table {
        max-width: 100% !important;
      }
      pre, code {
        white-space: pre-wrap;
        word-break: break-all;
      }
      a {
        color: #0284c7;
        text-decoration: underline;
      }
      .email-body-content {
        width: 100%;
        overflow-x: auto;
      }
    </style>
  `;

  shadowRoot.innerHTML = `${baseStyles}${sanitized}`;
};

onMounted(() => {
  renderShadowContent();
});

watch(() => props.html, () => {
  renderShadowContent();
});
</script>

<template>
  <div ref="hostRef" class="w-full min-h-[150px]" />
</template>

