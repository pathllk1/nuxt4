import { initializeApp, getApps, cert } from 'firebase-admin/app';

export default defineNitroPlugin(() => {
  if (getApps().length === 0) {
    const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    let serviceAccount: any = null;

    if (rawBase64) {
      try {
        const decoded = Buffer.from(rawBase64.trim(), 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      } catch (err: any) {
        console.error('❌ [Firebase Plugin] Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', err.message);
      }
    } else if (rawJson) {
      try {
        serviceAccount = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
      } catch (err: any) {
        console.error('❌ [Firebase Plugin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
      }
    }

    if (serviceAccount && serviceAccount.project_id && serviceAccount.private_key) {
      try {
        initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        console.log(`🔥 [Firebase Plugin] Firebase Admin SDK initialized for project: ${serviceAccount.project_id}`);
      } catch (initErr: any) {
        console.error('❌ [Firebase Plugin] initializeApp failed:', initErr.message);
      }
    } else {
      console.warn('⚠️ [Firebase Plugin] FIREBASE_SERVICE_ACCOUNT_BASE64 is not configured.');
    }
  }
});
