import { defineEventHandler, readMultipartFormData, createError } from 'h3';
import { uploadToBackblazeB2 } from '../../utils/b2';

/**
 * Validate file magic numbers (signatures) to prevent executable spoofing
 */
function isValidFileSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (mimeType.startsWith('image/jpeg') || mimeType.startsWith('image/jpg')) {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47
  if (mimeType.startsWith('image/png')) {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // WebP: RIFF .... WEBP
  if (mimeType.startsWith('image/webp')) {
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer.length >= 12 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }

  // PDF: %PDF (25 50 44 46)
  if (mimeType.includes('pdf')) {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  // Office / ZIP (DOCX, XLSX, etc.): PK.. (50 4B 03 04)
  if (
    mimeType.includes('officedocument') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('zip')
  ) {
    return buffer[0] === 0x50 && buffer[1] === 0x4b;
  }

  // For plain text / csv / other generic safe files
  if (mimeType.startsWith('text/') || mimeType.includes('csv')) {
    return true;
  }

  // Allow standard recognized image / doc types
  return true;
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const currentUserId = (user.id || user._id).toString();

  const parts = await readMultipartFormData(event);
  if (!parts || parts.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No multipart data provided' });
  }

  let fileBuffer: Buffer | null = null;
  let originalFileName = '';
  let mimeType = 'application/octet-stream';
  let chatId = '';
  let width: number | undefined;
  let height: number | undefined;

  for (const part of parts) {
    if (part.name === 'file' && part.filename) {
      fileBuffer = part.data;
      originalFileName = part.filename;
      mimeType = part.type || 'application/octet-stream';
    } else if (part.name === 'chatId') {
      chatId = part.data.toString('utf-8').trim();
    } else if (part.name === 'width') {
      const w = parseInt(part.data.toString('utf-8'), 10);
      if (!isNaN(w)) width = w;
    } else if (part.name === 'height') {
      const h = parseInt(part.data.toString('utf-8'), 10);
      if (!isNaN(h)) height = h;
    }
  }

  if (!fileBuffer || !originalFileName) {
    throw createError({ statusCode: 400, statusMessage: 'File is required' });
  }

  if (!chatId) {
    throw createError({ statusCode: 400, statusMessage: 'chatId is required' });
  }

  // Security: verify caller is an authorized participant in chatId (userIdA:userIdB)
  const participants = chatId.split(':');
  if (!participants.includes(currentUserId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: You are not a participant in this chat'
    });
  }

  // Enforce 15 MB file size limit
  if (fileBuffer.length > 15 * 1024 * 1024) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File size exceeds maximum permitted limit of 15 MB'
    });
  }

  // Security: validate magic bytes against claimed MIME type
  if (!isValidFileSignature(fileBuffer, mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or unsupported file format'
    });
  }

  // Build structured Backblaze B2 folder path: chat/attachments/{chatId}/{YYYY-MM}
  const yearMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-08"
  const b2Prefix = `chat/attachments/${chatId}/${yearMonth}`;

  try {
    const uploadResult = await uploadToBackblazeB2(fileBuffer, originalFileName, b2Prefix);

    const attachmentId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const filePath = uploadResult.targetPath || uploadResult.fileName || originalFileName;
    const attachmentUrl = `/api/chat/attachment?path=${encodeURIComponent(filePath)}`;

    return {
      success: true,
      data: {
        id: attachmentId,
        name: uploadResult.fileName || originalFileName,
        url: attachmentUrl,
        size: uploadResult.fileSize,
        mimeType,
        width,
        height
      }
    };
  } catch (error: any) {
    console.error('[ChatUpload] Backblaze B2 upload error:', error.message);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to upload attachment to Backblaze B2'
    });
  }
});
