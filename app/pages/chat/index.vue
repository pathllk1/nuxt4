<script setup lang="ts">
import { ref } from 'vue';
import { useChat } from '../../composables/useChat';
import ContactList from '../../components/chat/ContactList.vue';
import ChatWindow from '../../components/chat/ChatWindow.vue';
import ForwardModal from '../../components/chat/ForwardModal.vue';
import type { ChatMessage, ChatContact } from '../../types/chat';

useHead({
  title: 'Enterprise 1-on-1 Chat',
  meta: [
    { name: 'description', content: 'Real-time multi-firm 1-on-1 chat and team collaboration' }
  ]
});

const {
  contacts,
  activeContact,
  messages,
  loadingContacts,
  sending,
  loadingHistory,
  hasMoreHistory,
  replyingTo,
  forwardingMessage,
  currentUserId,
  selectContact,
  sendMessage,
  uploadAttachment,
  deleteMessage,
  toggleReaction,
  forwardMessage,
  loadOlderMessages
} = useChat();

const isForwardModalOpen = ref(false);
const forwardLoading = ref(false);
const isDeleteModalOpen = ref(false);
const messageToDelete = ref<ChatMessage | null>(null);
const deleteLoading = ref(false);
const toast = useToast();

const handleSelectContact = (contact: ChatContact) => {
  selectContact(contact);
};

const handleBackToContacts = () => {
  activeContact.value = null;
};

const handleReply = (message: ChatMessage) => {
  replyingTo.value = message;
};

const handleCancelReply = () => {
  replyingTo.value = null;
};

const handleOpenForward = (message: ChatMessage) => {
  forwardingMessage.value = message;
  isForwardModalOpen.value = true;
};

const handleOpenDelete = (message: ChatMessage) => {
  messageToDelete.value = message;
  isDeleteModalOpen.value = true;
};

const handleConfirmDelete = async () => {
  if (!messageToDelete.value) return;
  deleteLoading.value = true;
  try {
    const success = await deleteMessage(messageToDelete.value);
    if (success) {
      toast.add({
        title: 'Message Deleted',
        description: 'The message has been deleted for everyone',
        color: 'success'
      });
      isDeleteModalOpen.value = false;
    }
  } catch (err: any) {
    toast.add({
      title: 'Delete Failed',
      description: err.message || 'Could not delete message',
      color: 'error'
    });
  } finally {
    deleteLoading.value = false;
    messageToDelete.value = null;
  }
};

const handleConfirmForward = async (targetUserIds: string[]) => {
  forwardLoading.value = true;
  try {
    const success = await forwardMessage(targetUserIds);
    if (success) {
      toast.add({
        title: 'Message Forwarded',
        description: `Successfully forwarded to ${targetUserIds.length} contact${targetUserIds.length > 1 ? 's' : ''}`,
        color: 'success'
      });
      isForwardModalOpen.value = false;
    }
  } catch (err: any) {
    toast.add({
      title: 'Forward Failed',
      description: err.message || 'Could not forward message',
      color: 'error'
    });
  } finally {
    forwardLoading.value = false;
  }
};
</script>

<template>
  <div class="h-[calc(100vh-3rem)] h-[calc(100dvh-3rem)] -mb-8 w-full flex overflow-hidden bg-white dark:bg-gray-900">
    <!-- Left Contacts Sidebar (Full height, full width on mobile, w-80/w-96 on desktop) -->
    <div 
      class="h-full w-full md:w-80 lg:w-96 shrink-0 transition-all flex flex-col min-h-0"
      :class="activeContact ? 'hidden md:flex' : 'flex'"
    >
      <ContactList
        :contacts="contacts"
        :active-contact-id="activeContact?.id"
        :loading="loadingContacts"
        @select="handleSelectContact"
      />
    </div>

    <!-- Right Conversation Pane (Full remaining width & height) -->
    <div 
      class="h-full flex-1 min-w-0 min-h-0 transition-all flex flex-col"
      :class="!activeContact ? 'hidden md:flex' : 'flex'"
    >
      <ChatWindow
        :active-contact="activeContact"
        :messages="messages"
        :current-user-id="currentUserId || ''"
        :loading-history="loadingHistory"
        :has-more-history="hasMoreHistory"
        :sending="sending"
        :replying-to="replyingTo"
        :upload-attachment="uploadAttachment"
        @send="(content, attachments) => sendMessage(content, attachments)"
        @reply="handleReply"
        @cancel-reply="handleCancelReply"
        @forward="handleOpenForward"
        @delete="handleOpenDelete"
        @react="(msg, emoji) => toggleReaction(msg, emoji)"
        @load-older="loadOlderMessages"
        @back="handleBackToContacts"
      />
    </div>

    <!-- Forward Dialog Modal -->
    <ForwardModal
      v-model:open="isForwardModalOpen"
      :message="forwardingMessage"
      :contacts="contacts"
      :loading="forwardLoading"
      @confirm="handleConfirmForward"
    />

    <!-- Delete Confirmation Modal -->
    <UModal :open="isDeleteModalOpen" @update:open="isDeleteModalOpen = $event">
      <template #content>
        <div class="p-5 space-y-4 max-w-sm w-full">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <UIcon name="i-lucide-trash-2" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-bold text-base text-gray-900 dark:text-white">Delete Message</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Are you sure you want to delete this message? This action will delete it for everyone.</p>
            </div>
          </div>

          <div v-if="messageToDelete" class="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200/60 dark:border-gray-700/60 text-xs text-gray-600 dark:text-gray-300 italic truncate">
            "{{ messageToDelete.content }}"
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <UButton 
              label="Cancel" 
              color="neutral" 
              variant="ghost" 
              size="sm"
              :disabled="deleteLoading"
              @click="isDeleteModalOpen = false" 
            />
            <UButton 
              label="Delete for Everyone" 
              color="error" 
              size="sm"
              icon="i-lucide-trash-2"
              :loading="deleteLoading"
              @click="handleConfirmDelete" 
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
