import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore, type CollectionReference } from 'firebase-admin/firestore';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { getHeader, createError, type H3Event } from 'h3';
import User from '../models/User';

let firebaseAdminApp: App | null = null;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;

export function getFirebaseAdminApp(): App {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
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
      firebaseAdminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    } else {
      throw new Error('Firebase service account credentials are not configured in environment variables');
    }
  } else {
    firebaseAdminApp = getApps()[0]!;
  }

  return firebaseAdminApp;
}

export function getFirestoreDb(): Firestore {
  if (firestoreInstance) {
    return firestoreInstance;
  }
  const app = getFirebaseAdminApp();
  firestoreInstance = getFirestore(app);
  return firestoreInstance;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) {
    return authInstance;
  }
  const app = getFirebaseAdminApp();
  authInstance = getAuth(app);
  return authInstance;
}

/**
 * Verifies a Google/Firebase ID Token cryptographically on the server
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const auth = getFirebaseAuth();
  return await auth.verifyIdToken(idToken);
}

/**
 * Returns a user-scoped collection reference in Firestore.
 * Matches existing Angular Firestore schema: users/{uid}/{collectionName}
 * Cryptographically secured to the authenticated user's linked firebaseUid.
 */
export async function getScopedCollectionAsync(event: H3Event | null, collectionName: string): Promise<CollectionReference> {
  const db = getFirestoreDb();

  // Normalize collection names to match existing Angular Firestore subcollections
  let normalizedName = collectionName;
  if (collectionName === 'transfers') normalizedName = 'wallet_transfers';
  if (collectionName === 'templates') normalizedName = 'recurring_templates';

  let uid = event?.context?.userDoc?.firebaseUid || event?.context?.user?.firebaseUid;

  // Fallback: If not on context, fetch user document from database
  if (!uid && event?.context?.user?.id) {
    const user = await User.findById(event.context.user.id).select('firebaseUid role').lean();
    if (user) {
      uid = user.firebaseUid;
      if (event.context.userDoc) {
        event.context.userDoc.firebaseUid = uid;
      }
    }
  }

  // Superadmin dev override (only if superadmin explicitly passes header for testing)
  const isSuperadmin = event?.context?.userDoc?.role === 'superadmin' || event?.context?.user?.role === 'superadmin';
  const superadminOverride = isSuperadmin && event ? getHeader(event, 'x-firebase-user-uid') : null;
  if (superadminOverride) {
    uid = superadminOverride;
  }

  if (!uid) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Firebase Account Not Linked. Please connect your Google Account in Work Tracker Settings.',
      data: { code: 'FIREBASE_NOT_LINKED' }
    });
  }

  return db.collection('users').doc(uid).collection(normalizedName);
}

export function getScopedCollection(event: H3Event | null, collectionName: string): CollectionReference {
  const db = getFirestoreDb();

  let normalizedName = collectionName;
  if (collectionName === 'transfers') normalizedName = 'wallet_transfers';
  if (collectionName === 'templates') normalizedName = 'recurring_templates';

  let uid = event?.context?.userDoc?.firebaseUid || event?.context?.user?.firebaseUid;

  // Superadmin dev override
  const isSuperadmin = event?.context?.userDoc?.role === 'superadmin' || event?.context?.user?.role === 'superadmin';
  const superadminOverride = isSuperadmin && event ? getHeader(event, 'x-firebase-user-uid') : null;
  if (superadminOverride) {
    uid = superadminOverride;
  }

  if (!uid) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Firebase Account Not Linked. Please connect your Google Account in Work Tracker Settings.',
      data: { code: 'FIREBASE_NOT_LINKED' }
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
