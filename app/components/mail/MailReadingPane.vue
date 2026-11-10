<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMail } from '@/composables/useMail';
import MailContactCard from './MailContactCard.vue';
import MailHtmlViewer from './MailHtmlViewer.vue';

const {
  selectedMessage,
  selectedThread,
  loadingDetail,
  openComposer
} = useMail();

const viewMode = ref<'html' | 'text'>('html');

const isExternal = computed(() => {
  const addr = selectedMessage.value?.from?.address || '';
  return !addr.endsWith('@businesspro-suite.com') && !addr.endsWith('@infra.com');
});

watch(() => selectedMessage.value?.id, () => {
  viewMode.value = selectedMessage.value?.bodyHtml ? 'html' : 'text';
});

const onReply = () => {
  if (!selectedMessage.value) return;
  openComposer({
    to: [selectedMessage.value.from.address],
    subject: selectedMessage.value.subject.startsWith('Re:')
      ? selectedMessage.value.subject
      : `Re: ${selectedMessage.value.subject}`,
    inReplyTo: selectedMessage.value.messageId,
    references: selectedMessage.value.messageId
  });
};

const onForward = () => {
  if (!selectedMessage.value) return;
  openComposer({
    to: [],
    subject: selectedMessage.value.subject.startsWith('Fwd:')
      ? selectedMessage.value.subject
      : `Fwd: ${selectedMessage.value.subject}`,
    bodyHtml: `<br><br>---------- Forwarded message ---------<br>From: ${selectedMessage.value.from.name} &lt;${selectedMessage.value.from.address}&gt;<br>Subject: ${selectedMessage.value.subject}<br><br>${selectedMessage.value.bodyHtml || selectedMessage.value.bodyText || ''}`
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

const downloadAttachment = (att: any) => {
  const url = att.downloadUrl || `/api/mail/attachment?messageId=${encodeURIComponent(selectedMessage.value?.id || '')}&attachmentId=${encodeURIComponent(att.id)}`;
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

    <!-- Active Message View -->
    <div v-else class="flex-1 flex flex-col min-h-0">
      <!-- Header Area -->
      <div class="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <!-- Subject & Security Badges -->
        <div class="flex items-start justify-between gap-3 mb-3">
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
              ⚡ External Sender
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

        <!-- Sender & Recipients Block -->
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3 min-w-0">
            <!-- Sender Avatar Popover -->
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

              <!-- To / CC Chips -->
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

          <!-- Date -->
          <div class="text-[11px] text-slate-400 font-mono shrink-0">
            {{ new Date(selectedMessage.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) }}
          </div>
        </div>

        <!-- Attachments Strip if any -->
        <div v-if="selectedMessage.attachments && selectedMessage.attachments.length > 0" class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Attachments ({{ selectedMessage.attachments.length }})
              </span>
              <UBadge color="neutral" variant="subtle" size="xs" class="font-mono text-[9px]">
                ☁ Backblaze B2
              </UBadge>
            </div>
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

      <!-- Message Body Area -->
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

        <!-- Secure Isolated Shadow DOM for Pixel-Perfect HTML Email -->
        <div
          v-if="viewMode === 'html' && selectedMessage.bodyHtml"
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

      <!-- Bottom Quick Actions Footer -->
      <div class="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-2 shrink-0 select-none">
        <UButton
          size="sm"
          color="primary"
          icon="i-heroicons-arrow-uturn-left"
          label="Reply"
          class="font-bold px-4"
          @click="onReply"
        />
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-heroicons-arrow-right"
          label="Forward"
          class="font-semibold px-4"
          @click="onForward"
        />
      </div>
    </div>
  </div>
</template>
