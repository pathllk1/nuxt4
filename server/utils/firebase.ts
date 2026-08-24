import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, CollectionReference } from 'firebase-admin/firestore';
import { getHeader, createError, type H3Event } from 'h3';

let firestoreInstance: Firestore | null = null;

export function getFirestoreDb(): Firestore {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  if (getApps().length === 0) {
    const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    let serviceAccount: any = null;

    if (rawBase64) {
      const decoded = Buffer.from(rawBase64.trim(), 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
    } else if (rawJson) {
      serviceAccount = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
    }

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    } else {
      throw new Error('Firebase service account credentials are not configured in environment variables');
    }
  }

  firestoreInstance = getFirestore();
  return firestoreInstance;
}

/**
 * Returns a user-scoped collection reference in Firestore.
 * Matches existing Angular Firestore schema: users/{uid}/{collectionName}
 */
export function getScopedCollection(event: H3Event | null, collectionName: string): CollectionReference {
  const db = getFirestoreDb();

  // Normalize collection names to match existing Angular Firestore subcollections
  let normalizedName = collectionName;
  if (collectionName === 'transfers') normalizedName = 'wallet_transfers';
  if (collectionName === 'templates') normalizedName = 'recurring_templates';

  // Read header passed from browser (Settings Tab storage) or session
  const uid = (event ? getHeader(event, 'x-firebase-user-uid') : '') || event?.context?.user?.firebaseUid || '';

  if (!uid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Firebase User UID is required. Please set your UID in Settings.'
    });
  }

  return db.collection('users').doc(uid).collection(normalizedName);
}

export async function getScopedDocs<T = any>(event: H3Event | null, collectionName: string): Promise<T[]> {
  const col = getScopedCollection(event, collectionName);
  const snapshot = await col.get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    const parsedId = Number(doc.id) || doc.id;
    return {
      ...data,
      id: data.id !== undefined ? (Number(data.id) || data.id) : parsedId,
      clientId: data.clientId !== undefined ? (Number(data.clientId) || data.clientId) : undefined,
      workId: data.workId !== undefined ? (Number(data.workId) || data.workId) : undefined,
      walletId: data.walletId !== undefined ? (Number(data.walletId) || data.walletId) : undefined,
      fromWalletId: data.fromWalletId !== undefined ? (Number(data.fromWalletId) || data.fromWalletId) : undefined,
      toWalletId: data.toWalletId !== undefined ? (Number(data.toWalletId) || data.toWalletId) : undefined
    };
  }) as T[];
}
