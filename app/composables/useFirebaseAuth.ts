import { ref } from 'vue';
import { useRuntimeConfig } from '#app';
import { useAuth } from './useAuth';

// Module-level reactive singleton state to share across all tabs and components
const isLinked = ref<boolean>(false);
const linkedUid = ref<string | null>(null);
const linkedEmail = ref<string | null>(null);
const isSuperadmin = ref<boolean>(false);
const isAuthenticating = ref<boolean>(false);
const authError = ref<string | null>(null);

let clientAuthInstance: any = null;

export const useFirebaseAuth = () => {
  const { apiFetch } = useAuth();
  const runtimeConfig = useRuntimeConfig();

  const getClientAuth = async () => {
    if (!import.meta.client) return null;
    if (clientAuthInstance) return clientAuthInstance;

    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');

    const config = runtimeConfig.public.firebase as any;
    const firebaseConfig = {
      apiKey: config?.apiKey || 'AIzaSyCKMWfNfD4fuCknFhceuhcYA3fJGgw5suU',
      authDomain: config?.authDomain || 'work-vs-payment.firebaseapp.com',
      projectId: config?.projectId || 'work-vs-payment',
      storageBucket: config?.storageBucket || 'work-vs-payment.firebasestorage.app',
      messagingSenderId: config?.messagingSenderId || '432257160846',
      appId: config?.appId || '1:432257160846:web:afa71b4fe4b38381909bdf',
      measurementId: config?.measurementId || 'G-J77N3W1H4C'
    };

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    clientAuthInstance = getAuth(app);
    return clientAuthInstance;
  };

  const fetchAuthStatus = async () => {
    try {
      const res = await apiFetch<{
        isLinked: boolean;
        firebaseUid: string | null;
        firebaseEmail: string | null;
        isSuperadmin: boolean;
      }>('/api/work-tracker/auth/status');

      if (res) {
        isLinked.value = res.isLinked;
        linkedUid.value = res.firebaseUid;
        linkedEmail.value = res.firebaseEmail;
        isSuperadmin.value = res.isSuperadmin;
      }
      return res;
    } catch (err: any) {
      console.warn('Failed to fetch Firebase link status:', err);
      return null;
    }
  };

  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (!import.meta.client) return { success: false, error: 'Client-only action' };
    isAuthenticating.value = true;
    authError.value = null;

    try {
      const auth = await getClientAuth();
      if (!auth) throw new Error('Firebase Auth client could not be initialized');

      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const userCredential = await signInWithPopup(auth, provider);
      const idToken = await userCredential.user.getIdToken(true);

      const linkRes = await apiFetch<{
        success: boolean;
        firebaseUid: string;
        firebaseEmail: string;
      }>('/api/work-tracker/auth/link-google', {
        method: 'POST',
        body: { idToken }
      });

      if (linkRes?.success) {
        isLinked.value = true;
        linkedUid.value = linkRes.firebaseUid;
        linkedEmail.value = linkRes.firebaseEmail;
        return { success: true };
      }

      throw new Error('Server link response failed');
    } catch (err: any) {
      const msg = err?.data?.statusMessage || err?.message || 'Google Sign-in failed';
      authError.value = msg;
      console.error('Google Sign-In Error:', err);
      return { success: false, error: msg };
    } finally {
      isAuthenticating.value = false;
    }
  };

  const unlinkGoogle = async (): Promise<boolean> => {
    isAuthenticating.value = true;
    try {
      await apiFetch('/api/work-tracker/auth/unlink-google', { method: 'POST' });
      isLinked.value = false;
      linkedUid.value = null;
      linkedEmail.value = null;
      return true;
    } catch (err) {
      console.error('Failed to unlink Google account:', err);
      return false;
    } finally {
      isAuthenticating.value = false;
    }
  };

  return {
    isLinked,
    linkedUid,
    linkedEmail,
    isSuperadmin,
    isAuthenticating,
    authError,
    fetchAuthStatus,
    signInWithGoogle,
    unlinkGoogle
  };
};
