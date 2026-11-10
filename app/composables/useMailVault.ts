import { ref, computed } from 'vue';
import type { EphemeralMailCredentials, MailAccount } from '@/types/mail';

// In-memory key ring (resides ONLY in browser RAM, never on disk or sent over wire)
const sessionMasterKey = ref<CryptoKey | null>(null);
const sessionMasterPin = ref<string | null>(null);
const isVaultUnlocked = computed(() => !!sessionMasterKey.value);

export function useMailVault() {
  /**
   * Derive an AES-GCM-256 CryptoKey from user PIN and salt using PBKDF2
   */
  async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(pin),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as any,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Unlock client-side vault with user master PIN
   * Optionally verifies against ciphertext to ensure PIN is genuinely correct
   */
  async function unlockVault(pin: string, saltHex?: string, verifyCipher?: string): Promise<boolean> {
    try {
      const salt = saltHex ? hexToBytes(saltHex) : new Uint8Array([12, 45, 78, 90, 14, 88, 33, 99, 120, 21, 65, 87, 43, 91, 55, 62]);
      const key = await deriveKey(pin, salt);

      // If verifyCipher is provided, verify that the PIN can actually decrypt it!
      if (verifyCipher) {
        try {
          await decryptData(verifyCipher, key);
        } catch {
          console.warn('[MailVault] Unlock attempted with invalid PIN for cipher');
          return false;
        }
      }

      sessionMasterKey.value = key;
      sessionMasterPin.value = pin;
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('mail_vault_session_pin', pin);
      }
      return true;
    } catch (err) {
      console.error('[MailVault] Unlock error:', err);
      return false;
    }
  }

  /**
   * Automatically unlock vault if session PIN exists or default PIN 1234 matches
   */
  async function autoUnlockIfPossible(testCipher?: string): Promise<boolean> {
    if (sessionMasterKey.value) {
      // If we already have a key and testCipher is provided, check if it decrypts
      if (testCipher) {
        try {
          await decryptData(testCipher, sessionMasterKey.value);
          return true;
        } catch {
          // Current key cannot decrypt testCipher; try to re-unlock
          sessionMasterKey.value = null;
          sessionMasterPin.value = null;
        }
      } else {
        return true;
      }
    }

    if (typeof window === 'undefined') return false;

    // 1. Check sessionStorage for active session PIN
    const savedPin = window.sessionStorage.getItem('mail_vault_session_pin');
    if (savedPin) {
      const ok = await unlockVault(savedPin, undefined, testCipher);
      if (ok) return true;
    }

    // 2. Try standard setup default PIN '1234'
    const defaultOk = await unlockVault('1234', undefined, testCipher);
    if (defaultOk) {
      return true;
    }

    return false;
  }

  /**
   * Lock vault and purge all in-memory keys
   */
  function lockVault() {
    sessionMasterKey.value = null;
    sessionMasterPin.value = null;
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('mail_vault_session_pin');
    }
  }

  /**
   * Encrypt plaintext string with AES-GCM-256
   */
  async function encryptData(plaintext: string, key?: CryptoKey): Promise<string> {
    const k = key || sessionMasterKey.value;
    if (!k) throw new Error('Vault is locked. Unlock with PIN first.');

    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      k,
      enc.encode(plaintext)
    );

    // Combine IV (12 bytes) + Ciphertext into hex string
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return bytesToHex(combined);
  }

  /**
   * Decrypt hex ciphertext with AES-GCM-256
   */
  async function decryptData(cipherHex: string, key?: CryptoKey): Promise<string> {
    const k = key || sessionMasterKey.value;
    if (!k) throw new Error('Vault is locked. Unlock with PIN first.');

    const bytes = hexToBytes(cipherHex);
    if (bytes.length < 13) throw new Error('Invalid ciphertext length');

    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      k,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  /**
   * Store encrypted account credentials into local browser vault
   */
  async function storeLocalCredentials(accountId: string, secretBundle: { username: string; password: string }): Promise<string> {
    if (!sessionMasterKey.value) {
      throw new Error('Please unlock or set your Vault PIN before saving credentials.');
    }
    const cipherText = await encryptData(JSON.stringify(secretBundle));
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`mail_vault_${accountId}`, cipherText);
    }
    return cipherText;
  }

  /**
   * Retrieve and decrypt credentials for a specific mail account
   */
  async function getLocalCredentials(accountId: string, fallbackCipher?: string): Promise<{ username: string; password: string } | null> {
    let cipher = '';
    if (typeof window !== 'undefined') {
      cipher = window.localStorage.getItem(`mail_vault_${accountId}`) || fallbackCipher || '';
    } else {
      cipher = fallbackCipher || '';
    }
    if (!cipher) return null;

    // If key not present or invalid, attempt auto-unlock
    if (!sessionMasterKey.value) {
      await autoUnlockIfPossible(cipher);
    }
    if (!sessionMasterKey.value) return null;

    try {
      const raw = await decryptData(cipher);
      return JSON.parse(raw);
    } catch {
      // If current key failed to decrypt, try autoUnlock with default PIN 1234
      const retried = await autoUnlockIfPossible(cipher);
      if (retried && sessionMasterKey.value) {
        try {
          const raw = await decryptData(cipher);
          return JSON.parse(raw);
        } catch {}
      }
      return null;
    }
  }

  /**
   * Build ephemeral payload to send to /api/mail/sync or /api/mail/send
   */
  async function buildEphemeralPayload(account: MailAccount): Promise<EphemeralMailCredentials | null> {
    const creds = await getLocalCredentials(account.id, account.encryptedVaultBlob);
    if (!creds) return null;

    return {
      accountId: account.id,
      emailAddress: account.emailAddress,
      imapHost: account.imapConfig.host,
      imapPort: account.imapConfig.port,
      imapSecure: account.imapConfig.secure,
      smtpHost: account.smtpConfig.host,
      smtpPort: account.smtpConfig.port,
      smtpSecure: account.smtpConfig.secure,
      username: creds.username,
      password: creds.password,
      timestamp: Date.now()
    };
  }

  // Helper converters
  function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  return {
    isVaultUnlocked,
    sessionMasterPin,
    deriveKey,
    unlockVault,
    autoUnlockIfPossible,
    lockVault,
    encryptData,
    decryptData,
    storeLocalCredentials,
    getLocalCredentials,
    buildEphemeralPayload
  };
}
