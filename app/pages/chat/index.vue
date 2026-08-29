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
  toggleReaction,
  forwardMessage,
  loadOlderMessages
} = useChat();

const isForwardModalOpen = ref(false);
const forwardLoading = ref(false);
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
  <div class="h-[calc(100vh-5rem)] w-full flex overflow-hidden bg-white dark:bg-gray-900">
    <!-- Left Contacts Sidebar (Full height, full width on mobile, w-80/w-96 on desktop) -->
    <div 
      class="h-full w-full md:w-80 lg:w-96 shrink-0 transition-all flex flex-col"
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
      class="h-full flex-1 min-w-0 transition-all flex flex-col"
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
        @send="sendMessage"
        @reply="handleReply"
        @cancel-reply="handleCancelReply"
        @forward="handleOpenForward"
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
  </div>
</template>
