import { createHash } from 'crypto';

export interface B2UploadResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  targetPath?: string;
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
export async function uploadToBackblazeB2(
  buffer: Buffer,
  originalName: string,
  customPrefix?: string
): Promise<B2UploadResult> {
  const keyId = String(process.env.B2_APPLICATION_KEY_ID || '').trim();
  const appKey = String(process.env.B2_APPLICATION_KEY || '').trim();
  const bucketId = String(process.env.B2_BUCKET_ID || '').trim();
  const bucketNameConfig = String(process.env.B2_BUCKET_NAME || '').trim();
  const defaultPrefix = String(process.env.B2_BUCKET_PREFIX || 'documents').trim().replace(/^\/+|\/+$/g, '');
  const prefix = (customPrefix !== undefined ? customPrefix : defaultPrefix).trim().replace(/^\/+|\/+$/g, '');

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

  // B2 expects slashes to remain slashes in X-Bz-File-Name so it creates folders
  const encodedB2FileName = targetName.split('/').map(encodeURIComponent).join('/');

  const uploadResp = await fetch(uploadInfo.uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: uploadInfo.authorizationToken,
      'X-Bz-File-Name': encodedB2FileName,
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
  const fileUrl = `${auth.downloadUrl}/file/${resolvedBucketName}/${encodedB2FileName}`;

  return {
    fileUrl,
    fileName: safeOriginalName,
    fileSize: buffer.length,
    targetPath: targetName
  };
}

/**
 * Download a file buffer from Backblaze B2 using server-side master credentials
 */
export async function downloadFromBackblazeB2(pathOrUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const keyId = String(process.env.B2_APPLICATION_KEY_ID || '').trim();
  const appKey = String(process.env.B2_APPLICATION_KEY || '').trim();
  const bucketNameConfig = String(process.env.B2_BUCKET_NAME || '').trim();

  if (!keyId || !appKey) {
    return null;
  }

  try {
    // 1. Authorize Account
    const basicAuth = Buffer.from(`${keyId}:${appKey}`).toString('base64');
    const authResp = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: { Authorization: `Basic ${basicAuth}` }
    });

    if (!authResp.ok) return null;
    const auth: any = await authResp.json();

    // 2. Resolve URL
    let downloadUrl = pathOrUrl;
    if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
      const cleanPath = pathOrUrl.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
      downloadUrl = `${auth.downloadUrl}/file/${bucketNameConfig}/${cleanPath}`;
    }

    // 3. Fetch with server authorization token
    let fileResp = await fetch(downloadUrl, {
      headers: {
        Authorization: auth.authorizationToken
      }
    });

    // Fallback: If 404/400 and URL contains %2F, try replacing with slash
    if (!fileResp.ok && downloadUrl.includes('%2F')) {
      const altUrl = downloadUrl.split('%2F').join('/');
      fileResp = await fetch(altUrl, {
        headers: { Authorization: auth.authorizationToken }
      });
    }

    // Fallback 2: Try encoded %2F if slash failed
    if (!fileResp.ok && !downloadUrl.includes('%2F')) {
      const filePart = downloadUrl.split(`/file/${bucketNameConfig}/`)[1];
      if (filePart) {
        const altUrl = `${auth.downloadUrl}/file/${bucketNameConfig}/${encodeURIComponent(filePart)}`;
        fileResp = await fetch(altUrl, {
          headers: { Authorization: auth.authorizationToken }
        });
      }
    }

    if (!fileResp.ok) {
      console.warn('[B2Download] File not found or inaccessible in B2:', downloadUrl);
      return null;
    }

    const arrayBuffer = await fileResp.arrayBuffer();
    const contentType = fileResp.headers.get('content-type') || 'application/octet-stream';

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType
    };
  } catch (err: any) {
    console.error('[B2Download] Error downloading from B2:', err.message);
    return null;
  }
}
