<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useMailVault } from '@/composables/useMailVault';
import { useMail } from '@/composables/useMail';
import { useToast } from '#imports';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'success'): void;
}>();

const { apiFetch } = useAuth();
const { unlockVault, storeLocalCredentials } = useMailVault();
const { fetchAccounts, fetchFolders, fetchMessages, syncMailbox } = useMail();
const toast = useToast();

const form = reactive({
  emailAddress: '',
  displayName: '',
  provider: 'CUSTOM_IMAP',
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
  smtpHost: '',
  smtpPort: 465,
  smtpSecure: true,
  username: '',
  password: '',
  vaultPin: '1234'
});

const testing = ref(false);
const saving = ref(false);
const selectedHelpTab = ref<'gmail' | 'yahoo' | 'hotmail' | 'zoho'>('gmail');

const applyProviderPreset = (providerKey: 'gmail' | 'yahoo' | 'hotmail' | 'zoho') => {
  selectedHelpTab.value = providerKey;
  if (providerKey === 'gmail') {
    form.provider = 'GMAIL';
    form.imapHost = 'imap.gmail.com';
    form.imapPort = 993;
    form.imapSecure = true;
    form.smtpHost = 'smtp.gmail.com';
    form.smtpPort = 465;
    form.smtpSecure = true;
    if (!form.username && form.emailAddress) form.username = form.emailAddress;
  } else if (providerKey === 'yahoo') {
    form.provider = 'CUSTOM_IMAP';
    form.imapHost = 'imap.mail.yahoo.com';
    form.imapPort = 993;
    form.imapSecure = true;
    form.smtpHost = 'smtp.mail.yahoo.com';
    form.smtpPort = 465;
    form.smtpSecure = true;
    if (!form.username && form.emailAddress) form.username = form.emailAddress;
  } else if (providerKey === 'hotmail') {
    form.provider = 'OFFICE_365';
    form.imapHost = 'outlook.office365.com';
    form.imapPort = 993;
    form.imapSecure = true;
    form.smtpHost = 'smtp.office365.com';
    form.smtpPort = 587;
    form.smtpSecure = false;
    if (!form.username && form.emailAddress) form.username = form.emailAddress;
  } else if (providerKey === 'zoho') {
    form.provider = 'ZOHO';
    form.imapHost = 'imap.zoho.com';
    form.imapPort = 993;
    form.imapSecure = true;
    form.smtpHost = 'smtp.zoho.com';
    form.smtpPort = 465;
    form.smtpSecure = true;
    if (!form.username && form.emailAddress) form.username = form.emailAddress;
  }
  toast.add({
    title: 'Preset Applied',
    description: `Configured IMAP & SMTP hosts for ${providerKey.toUpperCase()}`,
    color: 'success',
    duration: 2000
  });
};

const autoFillProvider = () => {
  const email = form.emailAddress.toLowerCase();
  if (email.includes('@gmail.com') || email.includes('@googlemail.com')) {
    applyProviderPreset('gmail');
  } else if (email.includes('@yahoo.') || email.includes('@ymail.com')) {
    applyProviderPreset('yahoo');
  } else if (email.includes('@outlook.com') || email.includes('@hotmail.com') || email.includes('@live.com') || email.includes('@msn.com')) {
    applyProviderPreset('hotmail');
  } else if (email.includes('@zoho.')) {
    applyProviderPreset('zoho');
  }
};

const onTestConnection = async () => {
  if (!form.imapHost || !form.smtpHost || !form.username || !form.password) {
    toast.add({ title: 'Validation', description: 'Please fill in host, username, and password', color: 'error' });
    return;
  }
  testing.value = true;
  try {
    const res: any = await apiFetch('/api/mail/test-connection', {
      method: 'POST',
      body: {
        imapHost: form.imapHost,
        imapPort: form.imapPort,
        imapSecure: form.imapSecure,
        smtpHost: form.smtpHost,
        smtpPort: form.smtpPort,
        smtpSecure: form.smtpSecure,
        username: form.username,
        password: form.password
      }
    });
    if (res?.success) {
      toast.add({ title: 'Connection Verified', description: res.message, color: 'success' });
    }
  } catch (err: any) {
    toast.add({
      title: 'Connection Failed',
      description: err.data?.message || err.message || 'Could not connect to mail servers',
      color: 'error'
    });
  } finally {
    testing.value = false;
  }
};

const onSaveAccount = async () => {
  if (!form.emailAddress || !form.imapHost || !form.smtpHost || !form.username || !form.password) {
    toast.add({ title: 'Validation Error', description: 'Please fill in all required mail fields', color: 'error' });
    return;
  }
  if (!form.vaultPin || form.vaultPin.length < 4) {
    toast.add({ title: 'PIN Required', description: 'Set a 4+ digit Client Vault PIN to encrypt secrets', color: 'error' });
    return;
  }

  saving.value = true;
  try {
    // 1. Initialize client vault with PIN
    await unlockVault(form.vaultPin);

    // 2. Generate account ID and encrypt credentials locally on client side
    const tempAccountId = `acc_${Date.now()}`;
    const encryptedVaultBlob = await storeLocalCredentials(tempAccountId, {
      username: form.username,
      password: form.password
    });

    // 3. Post account profile + opaque encrypted ciphertext to Couchbase
    const res: any = await apiFetch('/api/mail/accounts', {
      method: 'POST',
      body: {
        id: tempAccountId,
        emailAddress: form.emailAddress,
        displayName: form.displayName || form.emailAddress.split('@')[0],
        provider: form.provider,
        imapConfig: {
          host: form.imapHost,
          port: form.imapPort,
          secure: form.imapSecure
        },
        smtpConfig: {
          host: form.smtpHost,
          port: form.smtpPort,
          secure: form.smtpSecure
        },
        encryptedVaultBlob
      }
    });

    if (res?.success) {
      toast.add({
        title: 'Account Configured',
        description: `Connected ${form.emailAddress} with zero-knowledge client vault`,
        color: 'success'
      });
      emit('update:open', false);
      emit('success');
      await fetchAccounts();
      await fetchFolders();
      await fetchMessages();
      // Auto-trigger initial mailbox sync right after connect
      syncMailbox().catch((err: any) => console.warn('[MailAccountModal] Auto sync notice:', err));
    }
  } catch (err: any) {
    toast.add({
      title: 'Save Failed',
      description: err.data?.message || err.message || 'Error saving account',
      color: 'error'
    });
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <UModal
    :open="open"
    title="Connect Mail Account (Outlook Client)"
    description="Zero-knowledge enterprise setup: your credentials remain securely encrypted on the client side."
    :ui="{ content: 'w-full sm:max-w-4xl lg:max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <!-- Two-Column Master Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-xs select-none">
        
        <!-- LEFT PART (7 Cols): Account Connection Form -->
        <div class="lg:col-span-7 space-y-3.5">
          <!-- Basic Info -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <UInput
                v-model="form.emailAddress"
                placeholder="e.g. rajesh@infra.com"
                size="xs"
                class="w-full"
                @blur="autoFillProvider"
              />
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Display Name
              </label>
              <UInput
                v-model="form.displayName"
                placeholder="e.g. Rajesh Pathak"
                size="xs"
                class="w-full"
              />
            </div>
          </div>

          <!-- Incoming Server (IMAP) -->
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div class="flex items-center justify-between">
              <p class="font-bold text-primary-600 dark:text-primary-400 text-xs flex items-center gap-1.5">
                <UIcon name="i-heroicons-inbox-arrow-down" class="w-4 h-4" />
                Incoming Server (IMAP)
              </p>
              <span class="text-[10px] font-mono font-semibold text-slate-400">SSL/TLS: {{ form.imapSecure ? 'Enabled' : 'Disabled' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="col-span-2">
                <label class="block text-[10px] text-slate-400 mb-0.5">IMAP Host</label>
                <UInput v-model="form.imapHost" placeholder="imap.gmail.com" size="xs" class="w-full font-mono" />
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Port</label>
                <UInput v-model.number="form.imapPort" size="xs" class="w-full font-mono" />
              </div>
            </div>
          </div>

          <!-- Outgoing Server (SMTP) -->
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div class="flex items-center justify-between">
              <p class="font-bold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                <UIcon name="i-heroicons-paper-airplane" class="w-4 h-4" />
                Outgoing Server (SMTP)
              </p>
              <span class="text-[10px] font-mono font-semibold text-slate-400">Port {{ form.smtpPort }} ({{ form.smtpSecure ? 'SSL' : 'STARTTLS' }})</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="col-span-2">
                <label class="block text-[10px] text-slate-400 mb-0.5">SMTP Host</label>
                <UInput v-model="form.smtpHost" placeholder="smtp.gmail.com" size="xs" class="w-full font-mono" />
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Port</label>
                <UInput v-model.number="form.smtpPort" size="xs" class="w-full font-mono" />
              </div>
            </div>
          </div>

          <!-- Authentication & Password -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Username / Account ID *
              </label>
              <UInput v-model="form.username" placeholder="Username or email" size="xs" class="w-full font-mono" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password or App-Password *
              </label>
              <UInput v-model="form.password" type="password" placeholder="••••••••••••" size="xs" class="w-full font-mono" />
            </div>
          </div>

          <!-- Client Vault PIN Banner -->
          <div class="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center justify-between gap-3">
            <div>
              <p class="font-bold text-blue-900 dark:text-blue-200 text-xs flex items-center gap-1">
                <UIcon name="i-heroicons-shield-check" class="w-4 h-4 text-blue-500" />
                Client Vault Encryption PIN
              </p>
              <p class="text-[10px] text-blue-600 dark:text-blue-300">
                AES-256-GCM browser encryption. Never transmitted or stored unencrypted.
              </p>
            </div>
            <UInput
              v-model="form.vaultPin"
              type="password"
              maxlength="6"
              placeholder="PIN"
              size="xs"
              class="w-20 text-center font-mono font-bold"
            />
          </div>
        </div>

        <!-- RIGHT PART (5 Cols): Complete Provider Setup Guide -->
        <div class="lg:col-span-5 flex flex-col space-y-3 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 text-xs h-full">
          <!-- Guide Header -->
          <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/70">
            <div class="flex items-center gap-1.5 font-black text-slate-800 dark:text-slate-200 text-xs">
              <UIcon name="i-heroicons-book-open" class="w-4 h-4 text-indigo-500" />
              <span>Provider Setup Guide</span>
            </div>
            <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
              Click to Auto-Fill
            </span>
          </div>

          <!-- Provider Preset Selection Cards -->
          <div class="grid grid-cols-3 gap-1.5">
            <!-- Gmail -->
            <button
              type="button"
              class="flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer"
              :class="selectedHelpTab === 'gmail' 
                ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-bold shadow-xs' 
                : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-400 hover:border-red-200'"
              @click="applyProviderPreset('gmail')"
            >
              <div class="w-6 h-6 rounded-lg bg-red-500 text-white flex items-center justify-center font-black text-[11px] mb-1">
                G
              </div>
              <span class="text-[10px]">Gmail</span>
            </button>

            <!-- Yahoo -->
            <button
              type="button"
              class="flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer"
              :class="selectedHelpTab === 'yahoo' 
                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold shadow-xs' 
                : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-400 hover:border-purple-200'"
              @click="applyProviderPreset('yahoo')"
            >
              <div class="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-black text-[11px] mb-1">
                Y!
              </div>
              <span class="text-[10px]">Yahoo</span>
            </button>

            <!-- Hotmail / Outlook -->
            <button
              type="button"
              class="flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer"
              :class="selectedHelpTab === 'hotmail' 
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold shadow-xs' 
                : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-400 hover:border-blue-200'"
              @click="applyProviderPreset('hotmail')"
            >
              <div class="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-[11px] mb-1">
                O
              </div>
              <span class="text-[10px]">Hotmail</span>
            </button>
          </div>

          <!-- Step-by-Step Provider Guide Content -->
          
          <!-- 1. GMAIL GUIDE -->
          <div v-if="selectedHelpTab === 'gmail'" class="space-y-2.5">
            <div class="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-[11px] leading-tight">
              ⚠️ <strong>Google Security Policy</strong>: Normal passwords are blocked. You must generate a <strong>16-letter App Password</strong>.
            </div>

            <ol class="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 list-decimal list-inside pl-1">
              <li>Enable <strong>2-Step Verification</strong> on your Google Account.</li>
              <li>Go to <strong>myaccount.google.com/apppasswords</strong>.</li>
              <li>Under "App name", type <code class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">Outlook Client</code>.</li>
              <li>Click <strong>Create</strong> and copy the 16-letter code.</li>
              <li>Paste that code as the <strong>Password</strong> on the left.</li>
            </ol>

            <div class="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-[10px] text-slate-500">
              <div class="flex justify-between"><span>IMAP:</span><strong class="text-slate-700 dark:text-slate-200">imap.gmail.com:993</strong></div>
              <div class="flex justify-between"><span>SMTP:</span><strong class="text-slate-700 dark:text-slate-200">smtp.gmail.com:465</strong></div>
            </div>

            <UButton
              size="xs"
              variant="outline"
              color="error"
              icon="i-heroicons-arrow-top-right-on-square"
              label="Open Google App Passwords ↗"
              class="w-full justify-center font-bold text-[10px]"
              to="https://myaccount.google.com/apppasswords"
              target="_blank"
            />
          </div>

          <!-- 2. YAHOO GUIDE -->
          <div v-else-if="selectedHelpTab === 'yahoo'" class="space-y-2.5">
            <div class="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-purple-900 dark:text-purple-200 text-[11px] leading-tight">
              ⚠️ <strong>Yahoo Security Policy</strong>: Direct account passwords are restricted. An <strong>App Password</strong> is mandatory.
            </div>

            <ol class="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 list-decimal list-inside pl-1">
              <li>Sign in to Yahoo and visit <strong>Account Security</strong>.</li>
              <li>Scroll down to <strong>Generate app password</strong>.</li>
              <li>Enter <code class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">Outlook ERP</code> and click <strong>Generate</strong>.</li>
              <li>Copy the generated one-time code.</li>
              <li>Paste it into the <strong>Password</strong> field on the left.</li>
            </ol>

            <div class="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-[10px] text-slate-500">
              <div class="flex justify-between"><span>IMAP:</span><strong class="text-slate-700 dark:text-slate-200">imap.mail.yahoo.com:993</strong></div>
              <div class="flex justify-between"><span>SMTP:</span><strong class="text-slate-700 dark:text-slate-200">smtp.mail.yahoo.com:465</strong></div>
            </div>

            <UButton
              size="xs"
              variant="outline"
              color="primary"
              icon="i-heroicons-arrow-top-right-on-square"
              label="Open Yahoo Security ↗"
              class="w-full justify-center font-bold text-[10px]"
              to="https://login.yahoo.com/account/security"
              target="_blank"
            />
          </div>

          <!-- 3. HOTMAIL / OUTLOOK GUIDE -->
          <div v-else-if="selectedHelpTab === 'hotmail'" class="space-y-2.5">
            <div class="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200 text-[11px] leading-tight">
              ⚠️ <strong>Microsoft Setting</strong>: Make sure IMAP is toggled ON in Outlook Web settings.
            </div>

            <ol class="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 list-decimal list-inside pl-1">
              <li>Open Outlook Web &gt; <strong>Settings (Gear)</strong> &gt; <strong>Sync email</strong>.</li>
              <li>Ensure <strong>"Let devices use IMAP"</strong> is set to <strong>Yes</strong>.</li>
              <li>If 2FA is active, generate an App Password in Microsoft Security.</li>
              <li>Use your full email as Username (e.g. <code class="font-mono text-[10px]">name@hotmail.com</code>).</li>
            </ol>

            <div class="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1 font-mono text-[10px] text-slate-500">
              <div class="flex justify-between"><span>IMAP:</span><strong class="text-slate-700 dark:text-slate-200">outlook.office365.com:993</strong></div>
              <div class="flex justify-between"><span>SMTP:</span><strong class="text-slate-700 dark:text-slate-200">smtp.office365.com:587 (TLS)</strong></div>
            </div>

            <UButton
              size="xs"
              variant="outline"
              color="primary"
              icon="i-heroicons-arrow-top-right-on-square"
              label="Open Microsoft Security ↗"
              class="w-full justify-center font-bold text-[10px]"
              to="https://account.microsoft.com/security"
              target="_blank"
            />
          </div>

          <!-- Quick Apply Button for Current Tab -->
          <div class="pt-2 mt-auto">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-heroicons-bolt"
              :label="`⚡ Auto-Fill ${selectedHelpTab.toUpperCase()} Parameters`"
              class="w-full justify-center font-bold"
              @click="applyProviderPreset(selectedHelpTab)"
            />
          </div>

        </div>

      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <UButton
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-heroicons-signal"
          :loading="testing"
          label="Test Connection"
          @click="onTestConnection"
        />

        <div class="flex items-center gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            label="Cancel"
            @click="emit('update:open', false)"
          />
          <UButton
            color="primary"
            size="sm"
            icon="i-heroicons-check"
            :loading="saving"
            label="Save & Connect"
            class="font-bold px-4"
            @click="onSaveAccount"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
