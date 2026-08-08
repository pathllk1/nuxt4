<template>
  <div
    class="h-full flex flex-col bg-gray-950 text-gray-300 transition-all duration-300 border-r border-gray-800"
    :class="isCollapsed ? 'w-0 overflow-hidden' : 'w-72'"
  >
    <!-- Header -->
    <div class="p-3 flex items-center justify-between border-b border-gray-800">
      <h2 class="text-sm font-bold text-white tracking-wide">Chats</h2>
      <div class="flex items-center gap-1">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-pencil-square"
          size="xs"
          title="New Chat (Ctrl+N)"
          @click="emit('newChatEvent')"
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-bars-3"
          size="xs"
          @click="emit('toggleEvent')"
        />
      </div>
    </div>

    <!-- Search -->
    <div class="px-3 py-2">
      <UInput
        :model-value="searchQuery"
        placeholder="Search chats..."
        icon="i-heroicons-magnifying-glass"
        size="xs"
        class="w-full"
        @update:model-value="emit('searchEvent', $event)"
      />
    </div>

    <!-- New Chat Button -->
    <div class="px-3 pb-2">
      <UButton
        block
        color="primary"
        icon="i-heroicons-plus"
        size="xs"
        label="New Chat"
        class="font-semibold cursor-pointer"
        @click="emit('newChatEvent')"
      />
    </div>

    <!-- Conversation List -->
    <div class="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
      <!-- Pinned section -->
      <template v-if="pinnedConversations.length > 0">
        <p class="text-[10px] uppercase tracking-wider text-gray-500 font-bold px-2 py-1.5">📌 Pinned</p>
        <div
          v-for="conv in pinnedConversations"
          :key="conv.id"
          class="group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 relative"
          :class="activeId === conv.id ? 'bg-indigo-600/20 text-white' : 'hover:bg-gray-800/60 text-gray-400 hover:text-gray-200'"
          @click="emit('selectEvent', conv.id)"
        >
          <template v-if="editingId === conv.id">
            <UInput
              v-model="editTitle"
              size="xs"
              class="flex-1"
              autofocus
              @keydown.enter="saveRename(conv.id)"
              @keydown.escape="editingId = null"
              @blur="saveRename(conv.id)"
              @click.stop
            />
          </template>
          <template v-else>
            <span class="flex-1 text-xs truncate">{{ conv.title }}</span>
            <span class="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100">{{ formatDate(conv.updated_at) }}</span>
            <UDropdownMenu
              :items="[
                [{ label: 'Rename', icon: 'i-heroicons-pencil', click: () => startRename(conv) }],
                [{ label: 'Unpin', icon: 'i-heroicons-bookmark-slash', click: () => emit('pinEvent', { id: conv.id, pinned: false }) }],
                [{ label: 'Delete', icon: 'i-heroicons-trash', color: 'error', click: () => deleteConfirmId = conv.id }]
              ]"
            >
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-heroicons-ellipsis-vertical"
                size="xs"
                class="opacity-0 group-hover:opacity-100"
                @click.stop
              />
            </UDropdownMenu>
          </template>
        </div>
      </template>

      <!-- Recent section -->
      <template v-if="unpinnedConversations.length > 0">
        <p class="text-[10px] uppercase tracking-wider text-gray-500 font-bold px-2 py-1.5">Recent</p>
        <div
          v-for="conv in unpinnedConversations"
          :key="conv.id"
          class="group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 relative"
          :class="activeId === conv.id ? 'bg-indigo-600/20 text-white' : 'hover:bg-gray-800/60 text-gray-400 hover:text-gray-200'"
          @click="emit('selectEvent', conv.id)"
        >
          <template v-if="editingId === conv.id">
            <UInput
              v-model="editTitle"
              size="xs"
              class="flex-1"
              autofocus
              @keydown.enter="saveRename(conv.id)"
              @keydown.escape="editingId = null"
              @blur="saveRename(conv.id)"
              @click.stop
            />
          </template>
          <template v-else>
            <span class="flex-1 text-xs truncate">{{ conv.title }}</span>
            <span class="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100">{{ formatDate(conv.updated_at) }}</span>
            <UDropdownMenu
              :items="[
                [{ label: 'Rename', icon: 'i-heroicons-pencil', click: () => startRename(conv) }],
                [{ label: 'Pin', icon: 'i-heroicons-bookmark', click: () => emit('pinEvent', { id: conv.id, pinned: true }) }],
                [{ label: 'Delete', icon: 'i-heroicons-trash', color: 'error', click: () => deleteConfirmId = conv.id }]
              ]"
            >
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-heroicons-ellipsis-vertical"
                size="xs"
                class="opacity-0 group-hover:opacity-100"
                @click.stop
              />
            </UDropdownMenu>
          </template>
        </div>
      </template>

      <!-- Empty state -->
      <div v-if="conversations.length === 0" class="text-center py-8">
        <div class="text-2xl mb-2">💬</div>
        <p class="text-xs text-gray-500">No conversations yet</p>
        <p class="text-[10px] text-gray-600 mt-1">Start a new chat to begin</p>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-2 border-t border-gray-800 space-y-1">
      <UButton
        block
        color="neutral"
        variant="ghost"
        icon="i-heroicons-cog-6-tooth"
        size="xs"
        label="Settings & API Keys"
        class="justify-start text-xs text-gray-300 hover:text-white"
        @click="emit('openSettingsEvent')"
      />
      <UButton
        v-if="conversations.length > 0"
        block
        color="error"
        variant="ghost"
        icon="i-heroicons-trash"
        size="xs"
        label="Clear All Chats"
        class="justify-start text-xs text-red-400 hover:text-red-300"
        @click="showClearConfirm = true"
      />
    </div>

    <!-- Clear confirmation modal -->
    <UModal v-model:open="showClearConfirm" title="Clear all chats?">
      <template #body>
        <p class="text-sm text-gray-500">This will permanently delete all conversations and messages. This action cannot be undone.</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" @click="showClearConfirm = false" />
          <UButton color="error" label="Delete All" @click="handleClearAll" />
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation modal -->
    <UModal :open="!!deleteConfirmId" title="Delete conversation?" @update:open="(val) => { if (!val) deleteConfirmId = null; }">
      <template #body>
        <p class="text-sm text-gray-500">This will permanently delete this conversation and all its messages. This action cannot be undone.</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" @click="deleteConfirmId = null" />
          <UButton color="error" label="Delete" @click="confirmDelete" />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Conversation } from '../../../composables/useAiChat';

const props = withDefaults(defineProps<{
  conversations?: Conversation[];
  activeId?: string;
  searchQuery?: string;
  isCollapsed?: boolean;
}>(), {
  conversations: () => [],
  activeId: '',
  searchQuery: '',
  isCollapsed: false,
});

const emit = defineEmits<{
  (e: 'selectEvent', id: string): void;
  (e: 'newChatEvent'): void;
  (e: 'searchEvent', query: string): void;
  (e: 'renameEvent', data: { id: string; title: string }): void;
  (e: 'pinEvent', data: { id: string; pinned: boolean }): void;
  (e: 'deleteEvent', id: string): void;
  (e: 'clearAllEvent'): void;
  (e: 'toggleEvent'): void;
  (e: 'openSettingsEvent'): void;
}>();

const editingId = ref<string | null>(null);
const editTitle = ref('');
const showClearConfirm = ref(false);
const deleteConfirmId = ref<string | null>(null);

const pinnedConversations = computed(() => props.conversations.filter(c => c.is_pinned));
const unpinnedConversations = computed(() => props.conversations.filter(c => !c.is_pinned));

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
};

const startRename = (conv: Conversation) => {
  editingId.value = conv.id;
  editTitle.value = conv.title;
};

const saveRename = (id: string) => {
  if (editTitle.value.trim()) {
    emit('renameEvent', { id, title: editTitle.value.trim() });
  }
  editingId.value = null;
};

const handleClearAll = () => {
  emit('clearAllEvent');
  showClearConfirm.value = false;
};

const confirmDelete = () => {
  if (deleteConfirmId.value) {
    emit('deleteEvent', deleteConfirmId.value);
    deleteConfirmId.value = null;
  }
};
</script>
