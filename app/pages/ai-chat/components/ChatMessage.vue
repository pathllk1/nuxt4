<template>
  <div
    class="group flex gap-3 px-4 py-5 transition-colors"
    :class="role === 'user' ? 'bg-transparent' : 'bg-gray-50/50 dark:bg-white/[0.02]'"
  >
    <!-- Avatar -->
    <UAvatar
      :text="role === 'user' ? '👤' : '✨'"
      size="sm"
      :class="role === 'user' ? 'bg-violet-600 text-white' : 'bg-emerald-600 text-white'"
    />

    <!-- Content -->
    <div class="flex-1 min-w-0 max-w-[800px]">
      <!-- Role label -->
      <div class="flex items-center gap-2 mb-1.5">
        <span
          class="text-xs font-bold uppercase tracking-wider"
          :class="role === 'user' ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400'"
        >
          {{ role === 'user' ? 'You' : 'Assistant' }}
        </span>
        <span v-if="formattedTime" class="text-xs text-gray-400">{{ formattedTime }}</span>
        <span v-if="isStreaming" class="flex items-center gap-1 text-xs text-indigo-500">
          <span class="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
          Generating...
        </span>
        <UBadge
          v-if="webSearchUsed"
          color="success"
          variant="subtle"
          size="xs"
          label="🌐 Searched Web"
        />
      </div>

      <!-- Message segments -->
      <div class="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 leading-relaxed">
        <template v-for="(seg, i) in segments" :key="i">
          <!-- Text block -->
          <div v-if="seg.type === 'text'" v-html="parseMarkdown(seg.content)"></div>

          <!-- Code block -->
          <div v-if="seg.type === 'code'" class="my-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between px-4 py-2 bg-gray-800 dark:bg-gray-900 text-gray-300">
              <span class="text-xs font-mono">{{ seg.language }}</span>
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="copiedIndex === i ? 'i-heroicons-check' : 'i-heroicons-clipboard'"
                :label="copiedIndex === i ? 'Copied!' : 'Copy'"
                @click="copyCode(seg.content, i)"
              />
            </div>
            <pre class="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto"><code>{{ seg.content }}</code></pre>
          </div>
        </template>

        <!-- Streaming cursor -->
        <span v-if="isStreaming" class="inline-block w-2 h-5 bg-indigo-500 animate-pulse rounded-sm ml-0.5"></span>
      </div>

      <!-- Search Sources -->
      <div v-if="searchSources && searchSources.length > 0" class="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
        <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Sources:</p>
        <div class="flex flex-wrap gap-2">
          <a
            v-for="(source, idx) in searchSources"
            :key="idx"
            :href="source.url"
            target="_blank"
            class="inline-flex items-center gap-1 max-w-[250px] px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all"
          >
            <span class="truncate text-gray-700 dark:text-gray-300">{{ source.title || source.url }}</span>
          </a>
        </div>
      </div>

      <!-- Actions (assistant only) -->
      <div
        v-if="role === 'assistant' && content && !isStreaming"
        class="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          :icon="copiedResponse ? 'i-heroicons-check' : 'i-heroicons-clipboard'"
          :label="copiedResponse ? 'Copied!' : 'Copy'"
          @click="copyResponse"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-heroicons-arrow-path"
          label="Regenerate"
          @click="emit('regenerate')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = withDefaults(defineProps<{
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
  webSearchUsed?: boolean;
  searchSources?: Array<{ title: string; url: string }>;
}>(), {
  timestamp: '',
  isStreaming: false,
  webSearchUsed: false,
  searchSources: () => [],
});

const emit = defineEmits<{
  (e: 'copyEvent'): void;
  (e: 'regenerate'): void;
}>();

const copiedIndex = ref<number | null>(null);
const copiedResponse = ref(false);

const formattedTime = computed(() => {
  if (!props.timestamp) return '';
  return new Date(props.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

const segments = computed(() => {
  const text = props.content || '';
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];

  let currentIndex = 0;
  while (currentIndex < text.length) {
    const nextCodeBlockStart = text.indexOf('```', currentIndex);
    if (nextCodeBlockStart === -1) {
      parts.push({ type: 'text', content: text.substring(currentIndex), language: undefined });
      break;
    }

    if (nextCodeBlockStart > currentIndex) {
      parts.push({ type: 'text', content: text.substring(currentIndex, nextCodeBlockStart), language: undefined });
    }

    const contentStartIndex = nextCodeBlockStart + 3;
    let langEndIndex = contentStartIndex;
    while (langEndIndex < text.length && /[a-zA-Z0-9+#-]/.test(text[langEndIndex] || '')) {
      langEndIndex++;
    }
    const language = text.substring(contentStartIndex, langEndIndex) || 'plaintext';

    let codeStartIndex = langEndIndex;
    if (codeStartIndex < text.length && text[codeStartIndex] === '\n') {
      codeStartIndex++;
    } else if (codeStartIndex < text.length && text[codeStartIndex] === '\r' && text[codeStartIndex + 1] === '\n') {
      codeStartIndex += 2;
    }

    const nextCodeBlockEnd = text.indexOf('```', codeStartIndex);
    if (nextCodeBlockEnd === -1) {
      const codeContent = text.substring(codeStartIndex);
      parts.push({ type: 'code', content: codeContent, language });
      currentIndex = text.length;
    } else {
      const codeContent = text.substring(codeStartIndex, nextCodeBlockEnd);
      parts.push({ type: 'code', content: codeContent, language });
      currentIndex = nextCodeBlockEnd + 3;
    }
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text, language: undefined }];
});

const sanitizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith('javascript:') || trimmed.toLowerCase().startsWith('data:')) {
    return '#';
  }
  return trimmed;
};

const formatInline = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/__(.*?)__/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
      const safeUrl = sanitizeUrl(url);
      return `<a href="${safeUrl}" target="_blank" class="text-indigo-500 hover:underline">${label}</a>`;
    });
};

const parseMarkdown = (text: string): string => {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split(/\r?\n/);
  const result: string[] = [];

  let listStack: Array<{ type: 'ul' | 'ol'; indent: number }> = [];
  let blockquoteLines: string[] = [];
  let inBlockquote = false;
  let tableRows: string[][] = [];
  let inTable = false;
  let paragraphLines: string[] = [];

  const closeAllLists = () => {
    while (listStack.length > 0) {
      const closed = listStack.pop();
      result.push(closed?.type === 'ul' ? '</ul>' : '</ol>');
    }
  };

  const closeListStack = (targetIndent: number) => {
    while (listStack.length > 0) {
      const top = listStack[listStack.length - 1];
      if (top && top.indent > targetIndent) {
        const closed = listStack.pop();
        result.push(closed?.type === 'ul' ? '</ul>' : '</ol>');
      } else {
        break;
      }
    }
  };

  const renderTable = () => {
    if (tableRows.length === 0) return;

    let tableHtml = '<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-left">';

    let hasHeader = false;
    if (tableRows.length > 1) {
      const secondRow = tableRows[1];
      if (secondRow) {
        const isSep = secondRow.every(cell => /^[-\s:]+$/.test(cell));
        if (isSep) hasHeader = true;
      }
    }

    if (hasHeader && tableRows[0]) {
      tableHtml += '<thead class="bg-gray-50 dark:bg-gray-800"><tr>';
      tableRows[0].forEach(cell => {
        tableHtml += `<th class="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">${formatInline(cell)}</th>`;
      });
      tableHtml += '</tr></thead>';
      tableHtml += '<tbody class="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-transparent">';
      for (let i = 2; i < tableRows.length; i++) {
        const row = tableRows[i];
        if (row) {
          tableHtml += '<tr>';
          row.forEach(cell => {
            tableHtml += `<td class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">${formatInline(cell)}</td>`;
          });
          tableHtml += '</tr>';
        }
      }
      tableHtml += '</tbody>';
    } else {
      tableHtml += '<tbody class="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-transparent">';
      tableRows.forEach(row => {
        tableHtml += '<tr>';
        row.forEach(cell => {
          tableHtml += `<td class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">${formatInline(cell)}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody>';
    }
    tableHtml += '</table></div>';
    result.push(tableHtml);
    tableRows = [];
    inTable = false;
  };

  const closeBlocks = () => {
    closeAllLists();
    if (inBlockquote || blockquoteLines.length > 0) {
      result.push(`<blockquote class="border-l-4 border-indigo-500 dark:border-indigo-400 pl-4 my-3 italic text-gray-600 dark:text-gray-400">${blockquoteLines.join('<br>')}</blockquote>`);
      blockquoteLines = [];
      inBlockquote = false;
    }
    if (inTable || tableRows.length > 0) {
      renderTable();
    }
    if (paragraphLines.length > 0) {
      result.push(`<p class="my-2 leading-relaxed">${paragraphLines.join('<br>')}</p>`);
      paragraphLines = [];
    }
  };

  const closeBlocksExceptTable = () => {
    closeAllLists();
    if (inBlockquote || blockquoteLines.length > 0) {
      result.push(`<blockquote class="border-l-4 border-indigo-500 dark:border-indigo-400 pl-4 my-3 italic text-gray-600 dark:text-gray-400">${blockquoteLines.join('<br>')}</blockquote>`);
      blockquoteLines = [];
      inBlockquote = false;
    }
    if (paragraphLines.length > 0) {
      result.push(`<p class="my-2 leading-relaxed">${paragraphLines.join('<br>')}</p>`);
      paragraphLines = [];
    }
  };

  const closeBlocksExceptBlockquote = () => {
    closeAllLists();
    if (inTable || tableRows.length > 0) {
      renderTable();
    }
    if (paragraphLines.length > 0) {
      result.push(`<p class="my-2 leading-relaxed">${paragraphLines.join('<br>')}</p>`);
      paragraphLines = [];
    }
  };

  const closeBlocksExceptList = () => {
    if (inBlockquote || blockquoteLines.length > 0) {
      result.push(`<blockquote class="border-l-4 border-indigo-500 dark:border-indigo-400 pl-4 my-3 italic text-gray-600 dark:text-gray-400">${blockquoteLines.join('<br>')}</blockquote>`);
      blockquoteLines = [];
      inBlockquote = false;
    }
    if (inTable || tableRows.length > 0) {
      renderTable();
    }
    if (paragraphLines.length > 0) {
      result.push(`<p class="my-2 leading-relaxed">${paragraphLines.join('<br>')}</p>`);
      paragraphLines = [];
    }
  };

  const closeBlocksExceptParagraph = () => {
    closeAllLists();
    if (inBlockquote || blockquoteLines.length > 0) {
      result.push(`<blockquote class="border-l-4 border-indigo-500 dark:border-indigo-400 pl-4 my-3 italic text-gray-600 dark:text-gray-400">${blockquoteLines.join('<br>')}</blockquote>`);
      blockquoteLines = [];
      inBlockquote = false;
    }
    if (inTable || tableRows.length > 0) {
      renderTable();
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();

    const isTableRow = line.startsWith('|') && line.endsWith('|');
    if (isTableRow) {
      closeBlocksExceptTable();
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      closeBlocks();
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      closeBlocks();
      const level = headingMatch[1].length;
      const content = formatInline(headingMatch[2]);
      const classes = [
        '',
        'text-2xl font-bold my-4 text-gray-900 dark:text-white',
        'text-xl font-bold my-3 text-gray-900 dark:text-white',
        'text-lg font-semibold my-3 text-gray-900 dark:text-white',
        'text-base font-semibold my-2 text-gray-900 dark:text-white',
        'text-sm font-semibold my-2 text-gray-900 dark:text-white',
        'text-xs font-semibold my-1 text-gray-900 dark:text-white'
      ];
      result.push(`<h${level} class="${classes[level] || ''}">${content}</h${level}>`);
      continue;
    }

    if (line.startsWith('&gt;') || line.startsWith('>')) {
      closeBlocksExceptBlockquote();
      const content = line.startsWith('&gt;') ? line.substring(4) : line.substring(1);
      blockquoteLines.push(formatInline(content.trim()));
      inBlockquote = true;
      continue;
    }

    const ulMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    if (ulMatch && ulMatch[1] !== undefined && ulMatch[3]) {
      closeBlocksExceptList();
      const indent = ulMatch[1].length;
      const content = formatInline(ulMatch[3]);
      closeListStack(indent);
      const currentList = listStack[listStack.length - 1];
      if (!currentList || currentList.type !== 'ul' || currentList.indent < indent) {
        result.push('<ul class="list-disc pl-6 my-1 space-y-1">');
        listStack.push({ type: 'ul', indent });
      }
      result.push(`<li>${content}</li>`);
      continue;
    }

    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch && olMatch[1] !== undefined && olMatch[2]) {
      closeBlocksExceptList();
      const indent = olMatch[1].length;
      const content = formatInline(olMatch[2]);
      closeListStack(indent);
      const currentList = listStack[listStack.length - 1];
      if (!currentList || currentList.type !== 'ol' || currentList.indent < indent) {
        result.push('<ol class="list-decimal pl-6 my-1 space-y-1">');
        listStack.push({ type: 'ol', indent });
      }
      result.push(`<li>${content}</li>`);
      continue;
    }

    if (trimmed === '') {
      closeBlocks();
      continue;
    }

    closeBlocksExceptParagraph();
    paragraphLines.push(formatInline(line));
  }

  closeBlocks();

  return result.join('\n');
};

const copyCode = async (code: string, index: number) => {
  await navigator.clipboard.writeText(code);
  copiedIndex.value = index;
  setTimeout(() => copiedIndex.value = null, 2000);
};

const copyResponse = async () => {
  await navigator.clipboard.writeText(props.content);
  copiedResponse.value = true;
  setTimeout(() => copiedResponse.value = false, 2000);
  emit('copyEvent');
};
</script>
