<script setup lang="ts">
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue';
import { useMail } from '@/composables/useMail';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '#imports';

const {
  accounts,
  activeAccount,
  switchAccount,
  isComposerOpen,
  composerState,
  composerData,
  closeComposer,
  sendEmail
} = useMail();

const { apiFetch } = useAuth();
const toast = useToast();

const selectedSenderAccountId = ref<string>('');

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
    content?: string;
    b2Key?: string;
    uploading?: boolean;
    uploadProgress?: number;
    uploadError?: string;
  }>,
  inReplyTo: undefined as string | undefined,
  references: undefined as string | undefined,
  threadId: undefined as string | undefined
});

const isSending = ref(false);
const suggestions = ref<any[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);

// Drag & Drop State
const isDraggingOver = ref(false);
let dragCounter = 0;

const onDragEnter = (e: DragEvent) => {
  if (composerState.value === 'minimized') return;
  if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
    dragCounter++;
    isDraggingOver.value = true;
  }
};

const onDragOver = (e: DragEvent) => {
  if (composerState.value === 'minimized') return;
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy';
  }
};

const onDragLeave = (e: DragEvent) => {
  if (composerState.value === 'minimized') return;
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    isDraggingOver.value = false;
  }
};

const onDrop = async (e: DragEvent) => {
  if (composerState.value === 'minimized') return;
  dragCounter = 0;
  isDraggingOver.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    await processIncomingFiles(Array.from(files));
  }
};

const uploadFileToCloud = async (file: File, attEntry: typeof form.attachments[0]) => {
  try {
    attEntry.uploading = true;
    attEntry.uploadProgress = 10;

    // 1. Request direct upload URL & auth token from server (Option B)
    const res: any = await apiFetch('/api/mail/upload-url', {
      method: 'POST',
      body: {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        accountId: selectedSenderAccountId.value || activeAccount.value?.id
      }
    });

    if (!res?.success || !res.data?.uploadUrl) {
      throw new Error(res?.statusMessage || res?.message || 'Could not obtain cloud upload authorization');
    }

    const { uploadUrl, authorizationToken, targetPath, b2FileName } = res.data;
    attEntry.uploadProgress = 25;

    // 2. Direct upload to Backblaze B2 using XMLHttpRequest for live progress
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('Authorization', authorizationToken);
      xhr.setRequestHeader('X-Bz-File-Name', b2FileName);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('Content-Length', String(file.size));
      xhr.setRequestHeader('X-Bz-Content-Sha1', 'do_not_verify');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(99, Math.round(25 + (event.loaded / event.total) * 70));
          attEntry.uploadProgress = percent;
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          attEntry.b2Key = targetPath;
          attEntry.uploadProgress = 100;
          attEntry.uploading = false;
          resolve();
        } else {
          reject(new Error(`Storage rejected upload with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error uploading to storage'));
      };

      xhr.send(file);
    });
  } catch (err: any) {
    console.warn('[MailComposer] Direct B2 upload notice, fallback if small:', err.message);
    // If file is small (<= 2.5 MB), fallback to Base64 in memory
    if (file.size <= 2.5 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        attEntry.content = reader.result as string;
        attEntry.uploading = false;
        attEntry.uploadProgress = 100;
      };
      reader.readAsDataURL(file);
    } else {
      attEntry.uploading = false;
      attEntry.uploadError = err.message || 'Direct upload failed';
      toast.add({
        title: 'Upload Failed',
        description: `Could not upload ${file.name} to cloud: ${err.message}`,
        color: 'error'
      });
    }
  }
};

const processIncomingFiles = async (files: File[]) => {
  let addedCount = 0;
  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) {
      toast.add({ title: 'File Too Large', description: `${file.name} exceeds 25 MB limit`, color: 'warning' });
      continue;
    }

    // Deduplicate identical attachment
    const isDuplicate = form.attachments.some(
      a => a.filename === file.name && a.size === file.size
    );
    if (isDuplicate) continue;

    const attEntry = reactive({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      content: undefined as string | undefined,
      b2Key: undefined as string | undefined,
      uploading: true,
      uploadProgress: 0,
      uploadError: undefined as string | undefined
    });

    form.attachments.push(attEntry);
    addedCount++;

    // Trigger direct cloud upload (Option B)
    uploadFileToCloud(file, attEntry);
  }

  if (addedCount > 0) {
    toast.add({
      title: 'Attachments Added',
      description: `Uploading ${addedCount} file${addedCount > 1 ? 's' : ''} to storage...`,
      color: 'neutral',
      duration: 1500
    });
  }
};

const onFileSelected = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  await processIncomingFiles(Array.from(input.files));
  input.value = '';
};

const onPaste = async (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  const pastedFiles: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        const ext = file.type.split('/')[1] || 'png';
        const customName = file.name === 'image.png' || !file.name
          ? `pasted-image-${Date.now()}.${ext}`
          : file.name;
        const customFile = new File([file], customName, { type: file.type });
        pastedFiles.push(customFile);
      }
    }
  }

  if (pastedFiles.length > 0) {
    await processIncomingFiles(pastedFiles);
  }
};

onMounted(() => {
  // Prevent browser window from hijacking dropped files outside the dropzone
  const preventWindowDrop = (e: DragEvent) => {
    if (isComposerOpen.value) {
      e.preventDefault();
    }
  };
  window.addEventListener('dragover', preventWindowDrop, false);
  window.addEventListener('drop', preventWindowDrop, false);

  onUnmounted(() => {
    window.removeEventListener('dragover', preventWindowDrop);
    window.removeEventListener('drop', preventWindowDrop);
  });
});

watch(isComposerOpen, (open) => {
  if (open) {
    selectedSenderAccountId.value = activeAccount.value?.id || accounts.value[0]?.id || '';
    form.toList = composerData.value.to ? [...composerData.value.to] : [];
    form.ccList = composerData.value.cc ? [...composerData.value.cc] : [];
    form.subject = composerData.value.subject || '';
    form.bodyText = composerData.value.bodyText || composerData.value.bodyHtml?.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '') || '';
    form.attachments = [];
    form.inReplyTo = composerData.value.inReplyTo;
    form.references = composerData.value.references;
    form.threadId = composerData.value.threadId;
  }
});

const triggerFileSelect = () => {
  fileInputRef.value?.click();
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

  const isUploading = form.attachments.some(a => a.uploading);
  if (isUploading) {
    toast.add({
      title: 'Upload in Progress',
      description: 'Please wait for your attachments to finish uploading to cloud storage',
      color: 'warning'
    });
    return;
  }

  const hasFailed = form.attachments.some(a => a.uploadError);
  if (hasFailed) {
    toast.add({
      title: 'Attachment Error',
      description: 'Please remove failed attachments before sending',
      color: 'error'
    });
    return;
  }

  isSending.value = true;
  try {
    if (selectedSenderAccountId.value && selectedSenderAccountId.value !== activeAccount.value?.id) {
      await switchAccount(selectedSenderAccountId.value);
    }
    await sendEmail({
      to: form.toList,
      cc: form.ccList,
      subject: form.subject || '(No Subject)',
      bodyHtml: form.bodyText.replace(/\n/g, '<br>'),
      bodyText: form.bodyText,
      importance: form.importance,
      attachments: form.attachments.map(a => ({
        filename: a.filename,
        contentType: a.contentType,
        size: a.size,
        b2Key: a.b2Key,
        content: a.content
      })),
      inReplyTo: form.inReplyTo,
      references: form.references,
      threadId: form.threadId
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
    class="fixed z-[70] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border flex flex-col transition-all overflow-hidden"
    :class="[
      isDraggingOver ? 'border-primary-500 ring-4 ring-primary-500/20' : 'border-slate-200 dark:border-slate-800',
      composerState === 'maximized' 
        ? 'inset-4 sm:inset-8' 
        : composerState === 'minimized'
          ? 'bottom-10 right-4 sm:right-8 w-72 h-10'
          : 'bottom-10 right-4 sm:right-8 w-[94vw] sm:w-[620px] h-[520px] max-h-[calc(100vh-5rem)]'
    ]"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- Top Window Titlebar -->
    <div
      class="h-10 px-4 bg-slate-900 text-white flex items-center justify-between shrink-0 select-none cursor-pointer"
      @click="composerState === 'minimized' ? (composerState = 'docked') : null"
    >
      <div class="flex items-center gap-2 text-xs font-bold truncate">
        <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 text-primary-400 shrink-0" />
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
    <div v-show="composerState !== 'minimized'" class="relative flex-1 flex flex-col min-h-0 overflow-hidden">
      <!-- High-visibility Drag & Drop Dropzone Overlay -->
      <div
        v-if="isDraggingOver"
        class="absolute inset-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-primary-500 rounded-b-2xl pointer-events-none transition-all duration-150 animate-in fade-in"
      >
        <div class="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-3 shadow-inner">
          <UIcon name="i-heroicons-arrow-up-tray" class="w-8 h-8 animate-bounce" />
        </div>
        <p class="text-sm font-bold text-slate-800 dark:text-slate-100">
          Drop files to attach
        </p>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Attach files to this message (drag & drop up to 25 MB each)
        </p>
      </div>

      <!-- Header Fields (To, CC, Subject) -->
      <div class="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
        <!-- From Line (Visible when multiple accounts exist) -->
        <div v-if="accounts.length > 1" class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-400 w-10">From:</span>
          <div class="flex-1">
            <select
              v-model="selectedSenderAccountId"
              class="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
            >
              <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
                {{ acc.displayName }} &lt;{{ acc.emailAddress }}&gt;
              </option>
            </select>
          </div>
        </div>

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
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all"
            :class="att.uploadError
              ? 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
              : att.uploading
                ? 'bg-primary-50 dark:bg-primary-950/60 border border-primary-300 dark:border-primary-700 text-slate-800 dark:text-slate-200'
                : 'bg-primary-50 dark:bg-primary-950/60 border border-primary-200 dark:border-primary-800 text-slate-800 dark:text-slate-200'"
          >
            <UIcon
              v-if="att.uploading"
              name="i-heroicons-arrow-path"
              class="w-3.5 h-3.5 text-primary-500 animate-spin shrink-0"
            />
            <UIcon
              v-else-if="att.uploadError"
              name="i-heroicons-exclamation-triangle"
              class="w-3.5 h-3.5 text-red-500 shrink-0"
            />
            <UIcon
              v-else
              name="i-heroicons-paper-clip"
              class="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 shrink-0"
            />

            <span class="truncate max-w-[140px] font-medium">{{ att.filename }}</span>
            <span class="text-[10px] text-slate-400 font-mono">({{ formatSize(att.size) }})</span>

            <!-- Cloud upload progress or error pill -->
            <span v-if="att.uploading" class="text-[10px] text-primary-600 font-mono font-bold">
              {{ att.uploadProgress }}%
            </span>
            <span v-else-if="att.uploadError" class="text-[10px] text-red-500 font-bold">
              Failed
            </span>

            <button
              class="ml-1 text-slate-400 hover:text-red-500 cursor-pointer"
              title="Remove attachment"
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
          placeholder="Compose your message here (drag & drop files anywhere to attach, or paste screenshots)..."
          class="flex-1 w-full resize-none border-0 outline-none text-xs sm:text-sm text-slate-800 dark:text-slate-200 bg-transparent leading-relaxed font-sans min-h-[140px]"
          @paste="onPaste"
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

          <div class="flex items-center gap-1.5">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-paper-clip"
              title="Attach File (or drag & drop files)"
              @click="triggerFileSelect"
            />
            <span class="text-[10px] text-slate-400 hidden sm:inline-block select-none">
              Drag & drop files to attach
            </span>
          </div>

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

