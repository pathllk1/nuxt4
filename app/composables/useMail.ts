import { ref, computed } from 'vue';
import { useAuth } from './useAuth';
import { useMailVault } from './useMailVault';
import { useToast } from '#imports';
import type { MailAccount, MailFolder, MailMessage, MailContact } from '@/types/mail';
import { indexedDb, type MailSyncMetadata } from '../utils/indexedDb';

const accounts = ref<MailAccount[]>([]);
const activeAccount = ref<MailAccount | null>(null);
const folders = ref<MailFolder[]>([]);
const activeFolderId = ref<string>('INBOX');
const activeTab = ref<'focused' | 'other'>('focused');
const activeFilter = ref<'all' | 'unread' | 'flagged' | 'files'>('all');
const searchQuery = ref<string>('');

const messages = ref<MailMessage[]>([]);
const totalMessages = ref<number>(0);
const loadingMessages = ref<boolean>(false);

const selectedMessage = ref<MailMessage | null>(null);
const selectedThread = ref<MailMessage[]>([]);
const loadingDetail = ref<boolean>(false);

const isSyncing = ref<boolean>(false);
const lastSyncMeta = ref<MailSyncMetadata | null>(null);

function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Composer state
const isComposerOpen = ref<boolean>(false);
const composerState = ref<'docked' | 'maximized' | 'minimized'>('docked');
const composerData = ref<{
  to?: string[];
  cc?: string[];
  subject?: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string;
}>({});

export function useMail() {
  const { apiFetch } = useAuth();
  const { isVaultUnlocked, buildEphemeralPayload } = useMailVault();
  const toast = useToast();

  const activeFolder = computed(() => {
    return folders.value.find(f => f.id === activeFolderId.value) || {
      id: activeFolderId.value,
      name: activeFolderId.value,
      path: activeFolderId.value,
      unreadCount: 0,
      totalCount: 0,
      specialUse: 'INBOX'
    };
  });

  const unreadCountForActive = computed(() => {
    return messages.value.filter(m => !m.isRead).length;
  });

  // 1. Fetch Accounts
  async function fetchAccounts() {
    try {
      const res: any = await apiFetch('/api/mail/accounts');
      if (res?.success && Array.isArray(res.data)) {
        accounts.value = res.data;
        const savedId = typeof window !== 'undefined' ? window.localStorage.getItem('mail_active_account_id') : null;
        const matchingSaved = accounts.value.find(a => a.id === savedId);
        const matchingCurrent = activeAccount.value ? accounts.value.find(a => a.id === activeAccount.value!.id) : null;

        if (matchingSaved) {
          activeAccount.value = matchingSaved;
        } else if (matchingCurrent) {
          activeAccount.value = matchingCurrent;
        } else if (accounts.value.length > 0) {
          activeAccount.value = accounts.value[0] || null;
        } else {
          activeAccount.value = null;
        }

        if (activeAccount.value) {
          loadSyncMeta(activeAccount.value.id);
        }
      }
    } catch (err: any) {
      console.warn('[useMail] Fetch accounts notice:', err.message);
    }
  }

  // 1b. Switch Active Account
  async function switchAccount(accountOrId: MailAccount | string) {
    const target = typeof accountOrId === 'string'
      ? accounts.value.find(a => a.id === accountOrId)
      : accountOrId;

    if (!target) return;
    if (activeAccount.value?.id === target.id) return;

    activeAccount.value = target;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mail_active_account_id', target.id);
    }

    loadSyncMeta(target.id);

    // Reset view state for fresh mailbox load
    activeFolderId.value = 'INBOX';
    selectedMessage.value = null;
    selectedThread.value = [];
    messages.value = [];
    totalMessages.value = 0;

    // Auto-unlock vault with target account credentials if available
    const { autoUnlockIfPossible } = useMailVault();
    if (target.encryptedVaultBlob) {
      await autoUnlockIfPossible(target.encryptedVaultBlob);
    } else {
      await autoUnlockIfPossible();
    }

    await fetchFolders();
    await fetchMessages();
  }

  // 1c. Delete Account
  async function deleteAccount(accountId: string) {
    try {
      const res: any = await apiFetch(`/api/mail/accounts/${accountId}`, {
        method: 'DELETE'
      });
      if (res?.success) {
        toast.add({ title: 'Account Disconnected', description: 'Mail account removed successfully', color: 'success' });
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(`mail_vault_${accountId}`);
        }
        await fetchAccounts();
        if (activeAccount.value?.id === accountId) {
          if (accounts.value.length > 0) {
            await switchAccount(accounts.value[0]!);
          } else {
            activeAccount.value = null;
            folders.value = [];
            messages.value = [];
            selectedMessage.value = null;
            selectedThread.value = [];
          }
        }
        return true;
      }
    } catch (err: any) {
      toast.add({ title: 'Delete Failed', description: err.data?.message || err.message, color: 'error' });
      return false;
    }
  }

  // 2. Fetch Folders
  async function fetchFolders() {
    if (!activeAccount.value) return;
    try {
      const res: any = await apiFetch(`/api/mail/folders?accountId=${activeAccount.value.id}`);
      if (res?.success && Array.isArray(res.data)) {
        folders.value = res.data;
      }
    } catch (err: any) {
      console.warn('[useMail] Fetch folders notice:', err.message);
    }
  }

  // 3. Fetch Messages
  async function fetchMessages(resetOffset = true) {
    if (!activeAccount.value) return;
    loadingMessages.value = true;
    try {
      const q = new URLSearchParams({
        accountId: activeAccount.value.id,
        folderId: activeFolderId.value,
        tab: activeTab.value,
        filter: activeFilter.value,
        limit: '50'
      });
      if (searchQuery.value.trim()) {
        q.append('search', searchQuery.value.trim());
      }

      const res: any = await apiFetch(`/api/mail/messages?${q.toString()}`);
      if (res?.success && Array.isArray(res.data)) {
        messages.value = res.data;
        totalMessages.value = res.total || res.data.length;

        // Synchronize selected message with current list to avoid stale cross-tab viewing
        const isCurrentInList = messages.value.some(m => m.id === selectedMessage.value?.id);
        if (!isCurrentInList) {
          if (messages.value.length > 0) {
            selectMessage(messages.value[0] || null);
          } else {
            selectedMessage.value = null;
            selectedThread.value = [];
          }
        }
      }
    } catch (err: any) {
      console.warn('[useMail] Fetch messages error:', err.message);
    } finally {
      loadingMessages.value = false;
    }
  }

  // 4. Select Message & Load Thread
  async function selectMessage(msg: MailMessage | null) {
    selectedMessage.value = msg;
    if (!msg) {
      selectedThread.value = [];
      return;
    }

    // Optimistically mark as read
    if (!msg.isRead) {
      msg.isRead = true;
      apiFetch(`/api/mail/messages/${msg.id}/flags`, {
        method: 'PATCH',
        body: { isRead: true }
      }).catch(() => {});
    }

    loadingDetail.value = true;
    try {
      const res: any = await apiFetch(`/api/mail/messages/${msg.id}`);
      if (res?.success && res.data) {
        selectedMessage.value = res.data;
        selectedThread.value = res.thread || [res.data];
      }

      // Phase 2: On-Demand Lazy Body Hydration (if body not yet downloaded from IMAP)
      const current = selectedMessage.value;
      if (current && (!current.bodyHtml || !current.isHydrated) && activeAccount.value) {
        const ephemeral = await buildEphemeralPayload(activeAccount.value);
        if (ephemeral) {
          const hydRes: any = await apiFetch('/api/mail/hydrate', {
            method: 'POST',
            body: {
              ...ephemeral,
              folder: current.folderId || activeFolderId.value,
              uid: current.uid,
              messageId: current.id
            }
          });
          if (hydRes?.success && hydRes.data) {
            selectedMessage.value = { ...selectedMessage.value, ...hydRes.data };
            const idx = messages.value.findIndex(m => m.id === current.id);
            if (idx !== -1) {
              messages.value[idx] = { ...messages.value[idx], ...hydRes.data };
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[useMail] Fetch message detail notice:', err.message);
    } finally {
      loadingDetail.value = false;
    }
  }

  // 5. Toggle Read / Unread
  async function toggleRead(msg: MailMessage) {
    const newState = !msg.isRead;
    msg.isRead = newState;
    try {
      await apiFetch(`/api/mail/messages/${msg.id}/flags`, {
        method: 'PATCH',
        body: { isRead: newState }
      });
    } catch {
      msg.isRead = !newState; // rollback on fail
    }
  }

  // 6. Toggle Flag
  async function toggleFlag(msg: MailMessage) {
    const newState = !msg.isFlagged;
    msg.isFlagged = newState;
    try {
      await apiFetch(`/api/mail/messages/${msg.id}/flags`, {
        method: 'PATCH',
        body: { isFlagged: newState }
      });
      toast.add({
        title: newState ? 'Flagged for follow-up' : 'Flag removed',
        color: 'neutral',
        duration: 1500
      });
    } catch {
      msg.isFlagged = !newState;
    }
  }

  // 6. Select Folder & Dynamic Sync
  async function selectFolder(folderId: string) {
    activeFolderId.value = folderId;
    selectedMessage.value = null;
    selectedThread.value = [];
    await fetchMessages();
    // If newly switched folder has 0 messages and vault is unlocked, dynamically sync this folder
    if (messages.value.length === 0 && isVaultUnlocked.value && activeAccount.value) {
      syncMailbox(folderId).catch(() => {});
    }
  }

  // 7. Sync Mailbox
  async function syncMailbox(targetFolder?: string, silent = false): Promise<boolean> {
    if (!activeAccount.value) {
      if (!silent) {
        toast.add({ title: 'No Account', description: 'Configure an email account first', color: 'warning' });
      }
      return false;
    }
    const folderToSync = (typeof targetFolder === 'string' && targetFolder.trim()) 
      ? targetFolder.trim() 
      : (activeFolderId.value || 'INBOX');
    isSyncing.value = true;
    try {
      const ephemeralPayload = await buildEphemeralPayload(activeAccount.value);
      if (!ephemeralPayload) {
        if (!silent) {
          toast.add({
            title: 'Vault PIN Needed',
            description: 'Could not decrypt email credentials. Click Unlock Vault to enter your PIN (Default: 1234)',
            color: 'warning'
          });
        }
        return false;
      }

      const res: any = await apiFetch('/api/mail/sync', {
        method: 'POST',
        body: {
          ...ephemeralPayload,
          folder: folderToSync,
          limit: 50
        }
      });

      if (res?.success) {
        if (!silent) {
          toast.add({
            title: 'Sync Complete',
            description: `Updated ${res.syncedCount || 0} messages in ${folderToSync}`,
            color: 'success'
          });
        }
        await fetchMessages();
        await fetchFolders();

        // Update IndexedDB sync metadata
        const todayStr = getTodayDateString();
        const meta: MailSyncMetadata = {
          accountId: activeAccount.value.id,
          lastSyncDate: todayStr,
          lastSyncTimestamp: Date.now(),
          lastStatus: 'SUCCESS',
          folder: folderToSync,
          syncedCount: res.syncedCount || 0
        };
        lastSyncMeta.value = meta;
        await indexedDb.setMailSyncMeta(meta);

        return true;
      }
      return false;
    } catch (err: any) {
      if (!silent) {
        toast.add({
          title: 'Sync Failed',
          description: err.data?.message || err.message || 'Error connecting to IMAP',
          color: 'error'
        });
      }
      return false;
    } finally {
      isSyncing.value = false;
    }
  }

  async function loadSyncMeta(accountId?: string) {
    const id = accountId || activeAccount.value?.id;
    if (!id || typeof window === 'undefined') return;
    try {
      const meta = await indexedDb.getMailSyncMeta(id);
      if (meta) {
        lastSyncMeta.value = meta;
      }
    } catch (e) {
      console.warn('[useMail] loadSyncMeta notice:', e);
    }
  }

  async function executeAutoSync(accountId: string, todayStr: string): Promise<boolean> {
    if (!activeAccount.value || activeAccount.value.id !== accountId) return false;

    // Check if vault can unlock automatically
    const { autoUnlockIfPossible } = useMailVault();
    let unlocked = isVaultUnlocked.value;
    if (!unlocked) {
      unlocked = await autoUnlockIfPossible(activeAccount.value.encryptedVaultBlob);
    }

    if (!unlocked) {
      console.log(`[useMail] Daily auto-sync skipped: vault locked for account ${accountId}`);
      return false;
    }

    console.log(`[useMail] Triggering daily auto-sync for account ${accountId}...`);
    const ok = await syncMailbox('INBOX', true);
    if (ok) {
      console.log(`[useMail] Daily auto-sync completed successfully for ${accountId}`);
    }
    return ok;
  }

  async function checkAndRunDailyAutoSync(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!activeAccount.value) return false;

    const accountId = activeAccount.value.id;
    const todayStr = getTodayDateString();

    try {
      // 1. Check IndexedDB record
      const meta = await indexedDb.getMailSyncMeta(accountId);
      if (meta) {
        lastSyncMeta.value = meta;
        if (meta.lastSyncDate === todayStr && meta.lastStatus === 'SUCCESS') {
          console.log(`[useMail] Account ${accountId} already auto-synced today (${todayStr}) via IndexedDB.`);
          return false;
        }
      }

      // 2. Concurrency lock to prevent multi-tab simultaneous syncing
      if (typeof navigator !== 'undefined' && 'locks' in navigator && (navigator as any).locks?.request) {
        let didRun = false;
        await (navigator as any).locks.request(`mail_daily_sync_${accountId}`, { ifAvailable: true }, async (lock: any) => {
          if (!lock) {
            console.log(`[useMail] Daily auto-sync lock currently acquired by another browser tab.`);
            return;
          }
          didRun = await executeAutoSync(accountId, todayStr);
        });
        return didRun;
      } else {
        return await executeAutoSync(accountId, todayStr);
      }
    } catch (err) {
      console.warn('[useMail] Daily auto-sync error:', err);
      return false;
    }
  }

  // 8. Composer Controls
  function openComposer(initialData: {
    to?: string[];
    cc?: string[];
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    inReplyTo?: string;
    references?: string;
    threadId?: string;
  } = {}) {
    composerData.value = initialData;
    isComposerOpen.value = true;
    composerState.value = 'docked';
  }

  function closeComposer() {
    isComposerOpen.value = false;
  }

  // 9. Send Email
  async function sendEmail(payload: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    importance?: 'high' | 'normal' | 'low';
    attachments?: Array<{
      filename: string;
      contentType: string;
      size: number;
      content?: string;
      b2Key?: string;
    }>;
    inReplyTo?: string;
    references?: string;
    threadId?: string;
  }) {
    if (!activeAccount.value) throw new Error('No active mail account');
    if (!isVaultUnlocked.value) throw new Error('Vault is locked. Unlock with PIN.');

    const ephemeral = await buildEphemeralPayload(activeAccount.value);
    if (!ephemeral) throw new Error('Could not decrypt SMTP credentials');

    const res: any = await apiFetch('/api/mail/send', {
      method: 'POST',
      body: {
        ...ephemeral,
        to: payload.to,
        cc: payload.cc,
        bcc: payload.bcc,
        subject: payload.subject,
        bodyHtml: payload.bodyHtml,
        bodyText: payload.bodyText,
        importance: payload.importance,
        attachments: payload.attachments,
        displayName: activeAccount.value.displayName,
        inReplyTo: payload.inReplyTo,
        references: payload.references,
        threadId: payload.threadId
      }
    });

    if (res?.success) {
      toast.add({ title: 'Email Sent', description: `Message delivered to ${payload.to.join(', ')}`, color: 'success' });
      closeComposer();
      // If we replied/forwarded within a thread, immediately refresh thread so the reply appears in continuous view
      if (selectedMessage.value) {
        selectMessage(selectedMessage.value).catch(() => {});
      }
      // If we are currently in Sent folder, refresh list
      if (activeFolderId.value === 'Sent') {
        fetchMessages();
      }
    }
    return res;
  }

  return {
    accounts,
    activeAccount,
    folders,
    activeFolderId,
    activeFolder,
    activeTab,
    activeFilter,
    searchQuery,
    messages,
    totalMessages,
    loadingMessages,
    selectedMessage,
    selectedThread,
    loadingDetail,
    isSyncing,
    isComposerOpen,
    composerState,
    composerData,
    unreadCountForActive,
    fetchAccounts,
    switchAccount,
    deleteAccount,
    fetchFolders,
    fetchMessages,
    selectMessage,
    selectFolder,
    toggleRead,
    toggleFlag,
    syncMailbox,
    lastSyncMeta,
    loadSyncMeta,
    checkAndRunDailyAutoSync,
    openComposer,
    closeComposer,
    sendEmail
  };
}

