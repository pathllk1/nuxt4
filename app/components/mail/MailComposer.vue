<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue';
import { useMail } from '@/composables/useMail';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '#imports';

const {
  isComposerOpen,
  composerState,
  composerData,
  closeComposer,
  sendEmail
} = useMail();

const { apiFetch } = useAuth();
const toast = useToast();

const form = reactive({
  toInput: '',
  toList: [] as string[],
  ccInput: '',
  ccList: [] as string[],
  subject: '',
  bodyText: '',
  showCc: false,
  importance: 'normal' as 'normal' | 'high' | 'low',
  attachments: [] as Array<{
    filename: string;
    contentType: string;
    size: number;
    content: string; // Base64
  }>
});

const isSending = ref(false);
const suggestions = ref<any[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);

watch(isComposerOpen, (open) => {
  if (open) {
    form.toList = composerData.value.to ? [...composerData.value.to] : [];
    form.ccList = composerData.value.cc ? [...composerData.value.cc] : [];
    form.subject = composerData.value.subject || '';
    form.bodyText = composerData.value.bodyHtml?.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '') || '';
    form.attachments = [];
  }
});

const triggerFileSelect = () => {
  fileInputRef.value?.click();
};

const onFileSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  for (const file of Array.from(input.files)) {
    if (file.size > 25 * 1024 * 1024) {
      toast.add({ title: 'File Too Large', description: `${file.name} exceeds 25 MB limit`, color: 'warning' });
      continue;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      form.attachments.push({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        content: base64
      });
    };
    reader.readAsDataURL(file);
  }

  input.value = '';
};

const removeAttachment = (index: number) => {
  form.attachments.splice(index, 1);
};

const formatSize = (bytes: number) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const onToInput = async () => {
  const q = form.toInput.trim();
  if (!q) {
    suggestions.value = [];
    return;
  }
  try {
    const res: any = await apiFetch(`/api/mail/contacts/suggest?q=${encodeURIComponent(q)}`);
    if (res?.success && Array.isArray(res.data)) {
      suggestions.value = res.data;
    }
  } catch {
    suggestions.value = [];
  }
};

const addRecipient = (email: string) => {
  const clean = email.trim();
  if (clean && !form.toList.includes(clean)) {
    form.toList.push(clean);
  }
  form.toInput = '';
  suggestions.value = [];
};

const removeRecipient = (index: number) => {
  form.toList.splice(index, 1);
};

const onKeyDownTo = (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    if (form.toInput.trim()) {
      addRecipient(form.toInput);
    }
  }
};

const onSubmit = async () => {
  if (form.toInput.trim()) {
    addRecipient(form.toInput);
  }
  if (form.toList.length === 0) {
    toast.add({ title: 'Validation Error', description: 'Please specify at least one recipient', color: 'error' });
    return;
  }

  isSending.value = true;
  try {
    await sendEmail({
      to: form.toList,
      cc: form.ccList,
      subject: form.subject || '(No Subject)',
      bodyHtml: form.bodyText.replace(/\n/g, '<br>'),
      bodyText: form.bodyText,
      importance: form.importance,
      attachments: form.attachments
    });
  } catch (err: any) {
    toast.add({
      title: 'Send Error',
      description: err.message || 'Could not dispatch email',
      color: 'error'
    });
  } finally {
    isSending.value = false;
  }
};

const toggleMaximize = () => {
  composerState.value = composerState.value === 'maximized' ? 'docked' : 'maximized';
};

const toggleMinimize = () => {
  composerState.value = composerState.value === 'minimized' ? 'docked' : 'minimized';
};
</script>

<template>
  <div
    v-if="isComposerOpen"
    class="fixed z-[70] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col transition-all overflow-hidden"
    :class="[
      composerState === 'maximized' 
        ? 'inset-4 sm:inset-8' 
        : composerState === 'minimized'
          ? 'bottom-10 right-4 sm:right-8 w-72 h-10'
          : 'bottom-10 right-4 sm:right-8 w-[94vw] sm:w-[620px] h-[520px] max-h-[calc(100vh-5rem)]'
    ]"
  >
    <!-- Top Window Titlebar -->
    <div
      class="h-10 px-4 bg-slate-900 text-white flex items-center justify-between shrink-0 select-none cursor-pointer"
      @click="composerState === 'minimized' ? (composerState = 'docked') : null"
    >
      <div class="flex items-center gap-2 text-xs font-bold truncate">
        <UIcon name="i-heroicons-envelope-plus" class="w-4 h-4 text-primary-400 shrink-0" />
        <span class="truncate">{{ form.subject ? form.subject : 'New Message' }}</span>
      </div>

      <div class="flex items-center gap-1 shrink-0" @click.stop>
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-minus"
          title="Minimize"
          @click="toggleMinimize"
        />
        <UButton
          v-if="composerState !== 'minimized'"
          size="xs"
          variant="ghost"
          color="neutral"
          :icon="composerState === 'maximized' ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'"
          title="Maximize"
          @click="toggleMaximize"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-x-mark"
          title="Close"
          @click="closeComposer"
        />
      </div>
    </div>

    <!-- Collapsible Window Body (Hidden when minimized) -->
    <div v-show="composerState !== 'minimized'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <!-- Header Fields (To, CC, Subject) -->
      <div class="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
        <!-- To Line with Auto-Complete -->
        <div class="relative flex items-center gap-2">
          <span class="text-xs font-bold text-slate-400 w-10">To:</span>
          <div class="flex-1 flex flex-wrap items-center gap-1.5 p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 min-h-[34px]">
            <!-- Recipient Chips -->
            <div
              v-for="(rec, idx) in form.toList"
              :key="idx"
              class="flex items-center gap-1 bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-200 text-xs px-2 py-0.5 rounded-md font-mono"
            >
              <span>{{ rec }}</span>
              <button
                class="cursor-pointer hover:text-red-500"
                @click="removeRecipient(idx)"
              >
                ×
              </button>
            </div>

            <!-- Typing Input -->
            <input
              v-model="form.toInput"
              placeholder="Type recipient email or name..."
              class="flex-1 min-w-[140px] text-xs bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100"
              @input="onToInput"
              @keydown="onKeyDownTo"
            />
          </div>

          <button
            class="text-xs font-semibold text-slate-400 hover:text-primary-600 cursor-pointer"
            @click="form.showCc = !form.showCc"
          >
            Cc
          </button>

          <!-- Auto-Complete Dropdown -->
          <div
            v-if="suggestions.length > 0"
            class="absolute left-12 top-full mt-1 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60"
          >
            <div
              v-for="s in suggestions"
              :key="s.email"
              class="p-2 hover:bg-primary-50 dark:hover:bg-primary-950/40 cursor-pointer text-xs flex items-center justify-between"
              @click="addRecipient(s.email)"
            >
              <div>
                <p class="font-bold text-slate-800 dark:text-slate-100">{{ s.name }}</p>
                <p class="text-[10px] text-slate-400 font-mono">{{ s.email }}</p>
              </div>
              <span v-if="s.company" class="text-[9px] text-slate-400 font-medium">{{ s.company }}</span>
            </div>
          </div>
        </div>

        <!-- Optional CC Line -->
        <div v-if="form.showCc" class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-400 w-10">Cc:</span>
          <input
            v-model="form.ccInput"
            placeholder="Comma separated CC recipients..."
            class="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 outline-none text-slate-800 dark:text-slate-100"
          />
        </div>

        <!-- Subject Line -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-400 w-10">Subject:</span>
          <input
            v-model="form.subject"
            placeholder="Add a subject..."
            class="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 outline-none font-bold text-slate-900 dark:text-white"
          />
        </div>

        <!-- Attachment Pills if any -->
        <div v-if="form.attachments.length > 0" class="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div
            v-for="(att, idx) in form.attachments"
            :key="idx"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/60 border border-primary-200 dark:border-primary-800 text-xs"
          >
            <UIcon name="i-heroicons-paper-clip" class="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
            <span class="truncate max-w-[140px] font-medium text-slate-800 dark:text-slate-200">{{ att.filename }}</span>
            <span class="text-[10px] text-slate-400 font-mono">({{ formatSize(att.size) }})</span>
            <button
              class="ml-1 text-slate-400 hover:text-red-500 cursor-pointer"
              @click="removeAttachment(idx)"
            >
              <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Hidden File Input for Attachments -->
      <input
        ref="fileInputRef"
        type="file"
        multiple
        class="hidden"
        @change="onFileSelected"
      />

      <!-- Message Body Area -->
      <div class="flex-1 p-3 flex flex-col min-h-0 overflow-y-auto">
        <textarea
          v-model="form.bodyText"
          placeholder="Compose your message here..."
          class="flex-1 w-full resize-none border-0 outline-none text-xs sm:text-sm text-slate-800 dark:text-slate-200 bg-transparent leading-relaxed font-sans min-h-[140px]"
        />
      </div>

      <!-- Footer Bar with Send Controls -->
      <div class="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <UButton
            size="sm"
            color="primary"
            icon="i-heroicons-paper-airplane"
            label="Send"
            :loading="isSending"
            class="font-bold px-4 shadow-xs"
            @click="onSubmit"
          />

          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-paper-clip"
            title="Attach File"
            @click="triggerFileSelect"
          />

          <UButton
            size="xs"
            variant="ghost"
            :color="form.importance === 'high' ? 'error' : 'neutral'"
            icon="i-heroicons-exclamation-circle"
            title="High Importance"
            @click="form.importance = form.importance === 'high' ? 'normal' : 'high'"
          />
        </div>

        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-trash"
            title="Discard Draft"
            @click="closeComposer"
          />
        </div>
      </div>
    </div>
  </div>
</template>

