import { createHash } from 'crypto';

export interface B2UploadResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

/**
 * Generate a download authorization token from Backblaze B2
 * scoped to the document prefix, valid for 24 hours (86400 seconds).
 * Appending this token to private bucket download URLs prevents 401 unauthorized errors.
 */
export async function getB2DownloadToken(): Promise<string | null> {
  const keyId = String(process.env.B2_APPLICATION_KEY_ID || '').trim();
  const appKey = String(process.env.B2_APPLICATION_KEY || '').trim();
  const bucketId = String(process.env.B2_BUCKET_ID || '').trim();
  const prefix = String(process.env.B2_BUCKET_PREFIX || 'documents').trim().replace(/^\/+|\/+$/g, '');

  if (!keyId || !appKey || !bucketId) {
    return null;
  }

  try {
    // 1. Authorize Account
    const basicAuth = Buffer.from(`${keyId}:${appKey}`).toString('base64');
    const authResp = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    });

    if (!authResp.ok) {
      console.warn('[B2_AUTH] Authorization failed with status:', authResp.status);
      return null;
    }

    const auth: any = await authResp.json();

    // 2. Get Download Authorization
    const downloadAuthResp = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bucketId,
        fileNamePrefix: prefix ? `${prefix}/` : '',
        validDurationInSeconds: 86400, // 24 hours
      }),
    });

    if (!downloadAuthResp.ok) {
      console.warn('[B2_DOWNLOAD_AUTH] Failed with status:', downloadAuthResp.status);
      return null;
    }

    const downloadAuthData: any = await downloadAuthResp.json();
    return downloadAuthData.authorizationToken || null;
  } catch (err: any) {
    console.error('[B2_DOWNLOAD_AUTH] Error generating download token:', err.message);
    return null;
  }
}

/**
 * Uploads a file buffer to Backblaze B2 using the native B2 API v2.
 */
export async function uploadToBackblazeB2(buffer: Buffer, originalName: string): Promise<B2UploadResult> {
  const keyId = String(process.env.B2_APPLICATION_KEY_ID || '').trim();
  const appKey = String(process.env.B2_APPLICATION_KEY || '').trim();
  const bucketId = String(process.env.B2_BUCKET_ID || '').trim();
  const bucketNameConfig = String(process.env.B2_BUCKET_NAME || '').trim();
  const prefix = String(process.env.B2_BUCKET_PREFIX || 'documents').trim().replace(/^\/+|\/+$/g, '');

  if (!keyId || !appKey) {
    throw new Error('B2_APPLICATION_KEY_ID / B2_APPLICATION_KEY not configured');
  }
  if (!bucketId) {
    throw new Error('B2_BUCKET_ID is not configured');
  }

  // 1. Authorize Account
  const basicAuth = Buffer.from(`${keyId}:${appKey}`).toString('base64');
  const authResp = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: {
      Authorization: `Basic ${basicAuth}`,
    },
  });

  if (!authResp.ok) {
    const errorText = await authResp.text();
    throw new Error(`B2 authorize_account failed (${authResp.status}): ${errorText.slice(0, 200)}`);
  }

  const auth: any = await authResp.json();

  // 2. Get Upload URL
  const urlResp = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId }),
  });

  if (!urlResp.ok) {
    const errorText = await urlResp.text();
    throw new Error(`B2 get_upload_url failed (${urlResp.status}): ${errorText.slice(0, 200)}`);
  }

  const uploadInfo: any = await urlResp.json();

  // 3. Upload File
  const safeOriginalName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const targetName = prefix ? `${prefix}/${Date.now()}-${safeOriginalName}` : `${Date.now()}-${safeOriginalName}`;
  const sha1 = createHash('sha1').update(buffer).digest('hex');

  const uploadResp = await fetch(uploadInfo.uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: uploadInfo.authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(targetName),
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(buffer.length),
      'X-Bz-Content-Sha1': sha1,
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadResp.ok) {
    const errorText = await uploadResp.text();
    throw new Error(`B2 upload failed (${uploadResp.status}): ${errorText.slice(0, 200)}`);
  }

  const fileInfo: any = await uploadResp.json();
  const resolvedBucketName = fileInfo.bucketName || bucketNameConfig || '';
  const fileUrl = `${auth.downloadUrl}/file/${resolvedBucketName}/${encodeURIComponent(targetName)}`;

  return {
    fileUrl,
    fileName: safeOriginalName,
    fileSize: buffer.length,
  };
}
