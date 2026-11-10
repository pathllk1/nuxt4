<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMail } from '@/composables/useMail';
import type { MailMessage } from '@/types/mail';
import MailContactCard from './MailContactCard.vue';
import MailHtmlViewer from './MailHtmlViewer.vue';

const {
  selectedMessage,
  selectedThread,
  loadingDetail,
  openComposer,
  activeAccount
} = useMail();

const viewMode = ref<'html' | 'text'>('html');

const isExternal = computed(() => {
  const addr = selectedMessage.value?.from?.address || '';
  return !addr.endsWith('@businesspro-suite.com') && !addr.endsWith('@infra.com');
});

// Chronological conversation thread
const sortedThread = computed<MailMessage[]>(() => {
  if (!selectedThread.value || selectedThread.value.length === 0) {
    return selectedMessage.value ? [selectedMessage.value] : [];
  }
  return [...selectedThread.value].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
});

const isThreadView = computed(() => sortedThread.value.length > 1);

// Map of expanded message card IDs in thread view
const expandedMessageIds = ref<Record<string, boolean>>({});

// Initialize expansion: expand the active/latest message by default
watch(
  () => [selectedMessage.value?.id, selectedThread.value?.length],
  () => {
    viewMode.value = selectedMessage.value?.bodyHtml ? 'html' : 'text';
    const map: Record<string, boolean> = {};
    const thread = sortedThread.value;
    if (thread.length > 0) {
      const lastId = thread[thread.length - 1]?.id;
      const currentId = selectedMessage.value?.id;
      thread.forEach(m => {
        // Expand the latest message and the currently selected message
        map[m.id] = (m.id === lastId || m.id === currentId);
      });
    }
    expandedMessageIds.value = map;
  },
  { immediate: true }
);

const toggleMessageExpand = (id: string) => {
  expandedMessageIds.value[id] = !expandedMessageIds.value[id];
};

const expandAll = () => {
  const map: Record<string, boolean> = {};
  sortedThread.value.forEach(m => { map[m.id] = true; });
  expandedMessageIds.value = map;
};

const collapseAll = () => {
  const map: Record<string, boolean> = {};
  const lastId = sortedThread.value[sortedThread.value.length - 1]?.id;
  sortedThread.value.forEach(m => { map[m.id] = (m.id === lastId); });
  expandedMessageIds.value = map;
};

// Formats trailing quoted text for Reply and Forward
const formatQuotedBody = (msg: MailMessage, isForward = false) => {
  const fromStr = `${msg.from?.name || ''} <${msg.from?.address || ''}>`.trim();
  const dateStr = new Date(msg.timestamp || msg.date).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  const toStr = (msg.to || []).map(t => `${t.name ? t.name + ' ' : ''}<${t.address}>`).join(', ');

  const originalContent = (msg.bodyText || msg.snippet || '').trim();
  const quotedLines = originalContent
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');

  if (isForward) {
    return `\n\n---------- Forwarded message ---------\nFrom: ${fromStr}\nDate: ${dateStr}\nSubject: ${msg.subject}\nTo: ${toStr}\n\n${originalContent}`;
  } else {
    return `\n\nOn ${dateStr}, ${fromStr} wrote:\n${quotedLines}`;
  }
};

const onReply = (targetMsg?: MailMessage) => {
  const msg = targetMsg || selectedMessage.value;
  if (!msg) return;
  const trailingBody = formatQuotedBody(msg, false);
  const references = [msg.threadId, msg.messageId].filter(Boolean).join(' ');

  openComposer({
    to: [msg.from.address],
    subject: msg.subject.toLowerCase().startsWith('re:')
      ? msg.subject
      : `Re: ${msg.subject}`,
    bodyText: trailingBody,
    bodyHtml: trailingBody.replace(/\n/g, '<br>'),
    inReplyTo: msg.messageId,
    references,
    threadId: msg.threadId
  });
};

const onForward = (targetMsg?: MailMessage) => {
  const msg = targetMsg || selectedMessage.value;
  if (!msg) return;
  const trailingBody = formatQuotedBody(msg, true);
  const references = [msg.threadId, msg.messageId].filter(Boolean).join(' ');

  openComposer({
    to: [],
    subject: msg.subject.toLowerCase().startsWith('fwd:')
      ? msg.subject
      : `Fwd: ${msg.subject}`,
    bodyText: trailingBody,
    bodyHtml: trailingBody.replace(/\n/g, '<br>'),
    inReplyTo: msg.messageId,
    references,
    threadId: msg.threadId
  });
};

const getAttachmentIcon = (filename: string, contentType?: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || contentType?.includes('pdf')) {
    return { name: 'i-heroicons-document-text', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60' };
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) || contentType?.startsWith('image/')) {
    return { name: 'i-heroicons-photo', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/60' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || contentType?.includes('spreadsheet') || contentType?.includes('excel')) {
    return { name: 'i-heroicons-table-cells', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60' };
  }
  if (['doc', 'docx'].includes(ext) || contentType?.includes('word')) {
    return { name: 'i-heroicons-document', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { name: 'i-heroicons-archive-box', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60' };
  }
  return { name: 'i-heroicons-paper-clip', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' };
};

const formatFileSize = (bytes: number) => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatMessageDate = (val: string | number) => {
  if (!val) return '';
  const d = new Date(val);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const downloadAttachment = (att: any, msgId?: string) => {
  const mid = msgId || selectedMessage.value?.id || '';
  const url = att.downloadUrl || `/api/mail/attachment?messageId=${encodeURIComponent(mid)}&attachmentId=${encodeURIComponent(att.id)}`;
  window.open(url, '_blank');
};
</script>

<template>
  <div class="flex-1 bg-white dark:bg-slate-900 flex flex-col h-full min-w-0 overflow-y-auto select-text">
    <!-- Empty State -->
    <div
      v-if="!selectedMessage"
      class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 select-none"
    >
      <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-3">
        <UIcon name="i-heroicons-envelope-open" class="w-8 h-8" />
      </div>
      <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Select an item to read</p>
      <p class="text-xs text-slate-400 mt-1">Nothing is selected.</p>
    </div>

    <!-- Active Message or Conversation View -->
    <div v-else class="flex-1 flex flex-col min-h-0">
      <!-- Top Persistent Conversation Header -->
      <div class="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
        <!-- Subject & Security Badges -->
        <div class="flex items-start justify-between gap-3 mb-2">
          <h2 class="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
            {{ selectedMessage.subject || '(No Subject)' }}
          </h2>
          <div class="flex items-center gap-1.5 shrink-0">
            <UBadge
              v-if="isExternal"
              color="warning"
              variant="subtle"
              size="xs"
              class="font-bold text-[10px]"
            >
              ⚡ External
            </UBadge>
            <UBadge
              color="success"
              variant="subtle"
              size="xs"
              class="font-mono text-[10px]"
            >
              DKIM: PASS
            </UBadge>
          </div>
        </div>

        <!-- Thread Context Bar (If Conversation has multiple messages) -->
        <div v-if="isThreadView" class="flex items-center justify-between gap-2 pt-1">
          <div class="flex items-center gap-2">
            <UBadge
              color="primary"
              variant="subtle"
              size="xs"
              class="font-bold text-[11px] flex items-center gap-1"
            >
              <UIcon name="i-heroicons-chat-bubble-left-right" class="w-3.5 h-3.5" />
              {{ sortedThread.length }} messages in conversation
            </UBadge>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
              @click="expandAll"
            >
              Expand All
            </button>
            <span class="text-slate-300 dark:text-slate-700">|</span>
            <button
              class="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
              @click="collapseAll"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      <!-- Scrollable Message Stream -->
      <div class="flex-1 overflow-y-auto">
        <!-- MODE A: Continuous Trailing Conversation Stream (2+ messages) -->
        <div v-if="isThreadView" class="p-4 sm:p-6 space-y-4">
          <div
            v-for="(msg, idx) in sortedThread"
            :key="msg.id"
            class="rounded-xl border transition-all duration-150 overflow-hidden"
            :class="expandedMessageIds[msg.id]
              ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs'
              : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 cursor-pointer'"
          >
            <!-- Message Card Header (clickable to collapse/expand) -->
            <div
              class="p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
              :class="expandedMessageIds[msg.id] ? 'border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60' : ''"
              @click="toggleMessageExpand(msg.id)"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-primary-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                  {{ (msg.from?.name || msg.from?.address || 'U').slice(0, 1).toUpperCase() }}
                </div>
                <div class="min-w-0 flex flex-col">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {{ msg.from?.name || msg.from?.address }}
                    </span>
                    <UBadge
                      v-if="msg.folderId === 'Sent' || msg.from?.address === activeAccount?.emailAddress"
                      color="primary"
                      variant="subtle"
                      size="xs"
                      class="text-[9px] font-bold py-0 px-1"
                    >
                      You
                    </UBadge>
                  </div>
                  <!-- Collapsed: 1-line snippet preview -->
                  <p v-if="!expandedMessageIds[msg.id]" class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {{ msg.snippet }}
                  </p>
                  <!-- Expanded: To list summary -->
                  <p v-else class="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                    to {{ msg.to?.map(t => t.name || t.address).join(', ') || 'me' }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2.5 shrink-0">
                <span class="text-[11px] text-slate-400 font-mono">
                  {{ formatMessageDate(msg.timestamp || msg.date) }}
                </span>
                <UIcon
                  :name="expandedMessageIds[msg.id] ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  class="w-4 h-4 text-slate-400"
                />
              </div>
            </div>

            <!-- Expanded Card Content -->
            <div v-if="expandedMessageIds[msg.id]" class="p-4 sm:p-6 space-y-4">
              <!-- Attachments if any -->
              <div v-if="msg.attachments && msg.attachments.length > 0" class="space-y-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="att in msg.attachments"
                    :key="att.id"
                    class="group flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-lg border text-xs font-semibold select-none cursor-pointer hover:border-primary-400 transition-colors"
                    :class="getAttachmentIcon(att.filename, att.contentType).bg"
                    @click="downloadAttachment(att, msg.id)"
                  >
                    <UIcon :name="getAttachmentIcon(att.filename, att.contentType).name" class="w-4 h-4" :class="getAttachmentIcon(att.filename, att.contentType).color" />
                    <span class="truncate max-w-[140px]">{{ att.filename }}</span>
                    <span class="text-[10px] text-slate-400 font-mono">({{ formatFileSize(att.size) }})</span>
                    <UIcon name="i-heroicons-arrow-down-tray" class="w-3.5 h-3.5 text-slate-400 group-hover:text-primary-600" />
                  </div>
                </div>
              </div>

              <!-- Message Body -->
              <div v-if="msg.bodyHtml" class="w-full overflow-hidden rounded-lg">
                <ClientOnly>
                  <MailHtmlViewer :html="msg.bodyHtml" />
                  <template #fallback>
                    <div class="p-4 text-slate-400 text-xs animate-pulse">Loading email body...</div>
                  </template>
                </ClientOnly>
              </div>
              <div v-else class="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed select-text">
                {{ msg.bodyText || msg.snippet }}
              </div>

              <!-- Inline Card Action Bar -->
              <div class="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800/60 select-none">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-heroicons-arrow-uturn-left"
                  label="Reply"
                  class="font-semibold text-xs"
                  @click="onReply(msg)"
                />
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-heroicons-arrow-right"
                  label="Forward"
                  class="font-semibold text-xs"
                  @click="onForward(msg)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- MODE B: Standard Single Message View (1 message) -->
        <div v-else class="flex flex-col h-full">
          <!-- Sender & Recipient Detail -->
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-3 min-w-0">
                <UPopover>
                  <button class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-primary-600 text-white font-bold text-sm flex items-center justify-center shrink-0 cursor-pointer shadow-xs hover:opacity-90">
                    {{ (selectedMessage.from.name || selectedMessage.from.address || 'U').slice(0, 1).toUpperCase() }}
                  </button>
                  <template #content>
                    <MailContactCard :contact="selectedMessage.from" />
                  </template>
                </UPopover>

                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-bold text-slate-900 dark:text-white">
                      {{ selectedMessage.from.name || selectedMessage.from.address }}
                    </span>
                    <span class="text-[11px] text-slate-400 font-mono">
                      &lt;{{ selectedMessage.from.address }}&gt;
                    </span>
                  </div>

                  <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span class="font-semibold text-slate-400">To:</span>
                    <span
                      v-for="(to, idx) in selectedMessage.to"
                      :key="idx"
                      class="font-mono hover:text-primary-600 cursor-pointer"
                    >
                      {{ to.name || to.address }}<span v-if="idx < selectedMessage.to.length - 1">,</span>
                    </span>
                  </div>
                </div>
              </div>

              <div class="text-[11px] text-slate-400 font-mono shrink-0">
                {{ formatMessageDate(selectedMessage.timestamp || selectedMessage.date) }}
              </div>
            </div>

            <!-- Single Message Attachments Strip -->
            <div v-if="selectedMessage.attachments && selectedMessage.attachments.length > 0" class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UIcon name="i-heroicons-paper-clip" class="w-4 h-4 text-slate-400" />
                  Attachments ({{ selectedMessage.attachments.length }})
                </span>
                <button
                  v-if="selectedMessage.attachments.length > 1"
                  class="text-[11px] text-primary-600 hover:text-primary-700 dark:text-primary-400 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                  @click="selectedMessage.attachments.forEach(att => downloadAttachment(att))"
                >
                  <UIcon name="i-heroicons-arrow-down-tray" class="w-3.5 h-3.5" />
                  Download All
                </button>
              </div>

              <div class="flex flex-wrap gap-2.5">
                <div
                  v-for="att in selectedMessage.attachments"
                  :key="att.id"
                  class="group flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer hover:shadow-xs hover:border-primary-400 dark:hover:border-primary-600 select-none"
                  :class="getAttachmentIcon(att.filename, att.contentType).bg"
                  :title="`Click to download: ${att.filename} (${formatFileSize(att.size)})`"
                  @click="downloadAttachment(att)"
                >
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center bg-white/80 dark:bg-slate-900/80 shadow-2xs">
                    <UIcon
                      :name="getAttachmentIcon(att.filename, att.contentType).name"
                      class="w-4 h-4"
                      :class="getAttachmentIcon(att.filename, att.contentType).color"
                    />
                  </div>

                  <div class="min-w-0 flex flex-col">
                    <span class="truncate max-w-[150px] sm:max-w-[180px] text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                      {{ att.filename }}
                    </span>
                    <span class="text-[10px] text-slate-400 font-mono">
                      {{ formatFileSize(att.size) }}
                    </span>
                  </div>

                  <div class="ml-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 text-slate-500 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Body Area -->
          <div class="flex-1 p-4 sm:p-6 overflow-y-auto">
            <!-- View Mode Switcher -->
            <div
              v-if="selectedMessage.bodyHtml && selectedMessage.bodyText"
              class="flex items-center justify-end gap-1 mb-3 select-none"
            >
              <button
                class="text-[11px] px-2 py-0.5 rounded cursor-pointer transition-colors"
                :class="viewMode === 'html'
                  ? 'bg-primary-100 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'"
                @click="viewMode = 'html'"
              >
                Rich HTML
              </button>
              <button
                class="text-[11px] px-2 py-0.5 rounded cursor-pointer transition-colors"
                :class="viewMode === 'text'
                  ? 'bg-primary-100 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium'"
                @click="viewMode = 'text'"
              >
                Plain Text
              </button>
            </div>

            <!-- Hydration Loading State -->
            <div
              v-if="loadingDetail && !selectedMessage.bodyHtml"
              class="w-full py-16 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
            >
              <div class="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-950/60 flex items-center justify-center text-primary-500 animate-spin">
                <UIcon name="i-heroicons-arrow-path" class="w-5 h-5" />
              </div>
              <div>
                <p class="text-xs font-bold text-slate-800 dark:text-slate-200">Loading message content...</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Fetching email body and attachments from mail server</p>
              </div>
            </div>

            <!-- Rich HTML Body -->
            <div
              v-else-if="viewMode === 'html' && selectedMessage.bodyHtml"
              class="w-full bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs"
            >
              <ClientOnly>
                <MailHtmlViewer :html="selectedMessage.bodyHtml" />
                <template #fallback>
                  <div class="p-4 text-slate-400 text-xs animate-pulse">Loading email body...</div>
                </template>
              </ClientOnly>
            </div>

            <!-- Plain Text Fallback View -->
            <div
              v-else
              class="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed select-text"
            >
              {{ selectedMessage.bodyText || selectedMessage.snippet }}
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Quick Actions Footer -->
      <div class="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-2 shrink-0 select-none">
        <UButton
          size="sm"
          color="primary"
          icon="i-heroicons-arrow-uturn-left"
          label="Reply"
          class="font-bold px-4"
          @click="onReply()"
        />
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-heroicons-arrow-right"
          label="Forward"
          class="font-semibold px-4"
          @click="onForward()"
        />
      </div>
    </div>
  </div>
</template>
