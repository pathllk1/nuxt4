import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { MailCouchbaseService } from '../../utils/mail-couchbase.service';
import { assertAccountAccess } from '../../utils/mail-auth';
import { uploadToBackblazeB2 } from '../../utils/b2';
import type { MailMessage, MailAttachment } from '../../../app/types/mail';

export default defineEventHandler(async (event) => {
  let client: ImapFlow | null = null;
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const body = await readBody(event);

    if (!body.accountId || !body.imapHost || !body.username || !body.password || !body.uid) {
      throw createError({ statusCode: 400, statusMessage: 'Account ID, credentials, and UID are required' });
    }

    // Strict User Isolation: verify that the requesting user owns this account
    await assertAccountAccess(body.accountId, session);

    const docId = body.messageId || `msg::${body.accountId}::${body.uid}`;
    const folderName = (typeof body.folder === 'string' && body.folder.trim()) ? body.folder.trim() : 'INBOX';

    // 1. Fast Cache Check: If already hydrated in Couchbase, verify ownership and return immediately (0ms)
    const existing = await MailCouchbaseService.getMessage(docId);
    if (existing) {
      if (String(existing.firmId) !== firmId || String(existing.userId) !== userId) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: You do not have permission to access this message' });
      }
      if (existing.isHydrated && existing.bodyHtml) {
        return {
          success: true,
          data: existing,
          cached: true
        };
      }
    }

    // 2. Connect to IMAP to fetch only this single email's full body
    client = new ImapFlow({
      host: body.imapHost,
      port: Number(body.imapPort) || 993,
      secure: body.imapSecure !== false,
      auth: {
        user: body.username,
        pass: body.password
      },
      logger: false
    });

    await client.connect();

    // 3. Resolve folder
    let targetPath = folderName;
    try {
      const mailboxes = await client.list();
      if (Array.isArray(mailboxes)) {
        const exact = mailboxes.find(mb => mb.path?.toLowerCase() === folderName.toLowerCase());
        if (exact) {
          targetPath = exact.path;
        } else {
          const lower = folderName.toLowerCase();
          const matched = mailboxes.find(mb =>
            (lower.includes('sent') && /sent/i.test(mb.path || '')) ||
            (lower.includes('draft') && /draft/i.test(mb.path || '')) ||
            (lower.includes('trash') && /trash|deleted/i.test(mb.path || '')) ||
            (lower.includes('junk') && /junk|bulk|spam/i.test(mb.path || '')) ||
            (lower === 'inbox' && (mb.specialUse === '\\Inbox' || mb.path?.toUpperCase() === 'INBOX'))
          );
          if (matched && matched.path) targetPath = matched.path;
        }
      }
    } catch {}

    const lock = await client.getMailboxLock(targetPath);
    let updatedDoc: MailMessage | null = null;

    try {
      const uidNum = Number(body.uid);
      for await (const msg of client.fetch(uidNum, { source: true, flags: true }, { uid: true })) {
        if (!msg.source) continue;

        const parsed = await simpleParser(msg.source);

        const bodyHtml = (parsed.html as string) || (parsed.textAsHtml as string) || `<p>${parsed.subject || ''}</p>`;
        const bodyText = parsed.text || parsed.subject || '';
        const snippet = (parsed.text || parsed.subject || '').replace(/\s+/g, ' ').trim().slice(0, 180);

        // Upload attachments to Backblaze B2
        const attachments: MailAttachment[] = [];
        if (Array.isArray(parsed.attachments)) {
          for (let idx = 0; idx < parsed.attachments.length; idx++) {
            const att = parsed.attachments[idx];
            if (!att) continue;
            const attId = `att_${msg.uid}_${idx}`;
            const filename = att.filename || `attachment_${idx}`;
            const size = att.size || att.content?.length || 0;
            let b2Key: string | undefined = undefined;
            const downloadUrl = `/api/mail/attachment?messageId=${encodeURIComponent(docId)}&attachmentId=${encodeURIComponent(attId)}`;

            if (att.content && (Buffer.isBuffer(att.content) || (att.content as any) instanceof Uint8Array)) {
              try {
                const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content as any);
                const b2Prefix = `mail-attachments/${firmId}/${userId}/${body.accountId}/${msg.uid}`;
                const uploadResult = await uploadToBackblazeB2(buf, filename, b2Prefix);
                b2Key = uploadResult.targetPath;
              } catch (b2Err: any) {
                console.warn(`[Hydrate] B2 upload skipped for ${filename}:`, b2Err.message);
              }
            }

            attachments.push({
              id: attId,
              filename,
              contentType: att.contentType || 'application/octet-stream',
              size,
              contentId: att.cid,
              b2Key,
              downloadUrl
            });
          }
        }

        const fromAddr = parsed.from?.value?.[0] || { name: 'Unknown', address: 'unknown@mail.com' };
        const fromAddress = fromAddr.address || 'unknown@mail.com';
        const fromName = fromAddr.name || fromAddress;

        const toAddrs = (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [])
          .flatMap(t => t.value || [])
          .map(t => ({
            name: t.name || t.address || '',
            address: t.address || ''
          }));

        const ccAddrs = (parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]) : [])
          .flatMap(c => c.value || [])
          .map(c => ({
            name: c.name || c.address || '',
            address: c.address || ''
          }));

        const flagsList = msg.flags ? Array.from(msg.flags) : (existing?.flags || []);
        const isRead = msg.flags ? msg.flags.has('\\Seen') : (existing?.isRead ?? false);
        const isFlagged = msg.flags ? msg.flags.has('\\Flagged') : (existing?.isFlagged ?? false);
        const isAnswered = msg.flags ? msg.flags.has('\\Answered') : (existing?.isAnswered ?? false);

        const subject = parsed.subject || existing?.subject || '(No Subject)';
        const msgDate = parsed.date ? new Date(parsed.date).toISOString() : (existing?.date || new Date().toISOString());
        const timestamp = parsed.date ? new Date(parsed.date).getTime() : (existing?.timestamp || Date.now());
        const messageId = parsed.messageId || existing?.messageId || `<${msg.uid}.${timestamp}@mail>`;

        let rawRef: string | undefined = undefined;
        if (parsed.references) {
          if (Array.isArray(parsed.references)) {
            rawRef = parsed.references[0];
          } else {
            rawRef = String(parsed.references).split(/\s+/)[0];
          }
        }
        const threadRootCandidate = existing?.threadId || rawRef || parsed.inReplyTo || messageId;
        const rootThreadId = (threadRootCandidate || '').replace(/[<>]/g, '');

        updatedDoc = {
          ...(existing || {}),
          id: docId,
          type: 'message',
          accountId: body.accountId,
          folderId: targetPath,
          firmId,
          userId,
          uid: msg.uid,
          messageId,
          threadId: rootThreadId,
          subject,
          from: { name: fromName, address: fromAddress },
          to: toAddrs,
          cc: ccAddrs,
          date: msgDate,
          timestamp,
          snippet,
          bodyHtml,
          bodyText,
          hasAttachments: attachments.length > 0,
          attachments,
          isHydrated: true,
          flags: flagsList,
          isRead,
          isFlagged,
          isAnswered,
          importance: existing?.importance || 'normal',
          tab: existing?.tab || 'focused',
          categories: existing?.categories || []
        };

        await MailCouchbaseService.saveMessage(updatedDoc);
      }
    } finally {
      lock.release();
    }

    await client.logout();
    client = null;

    if (!updatedDoc) {
      if (existing) return { success: true, data: existing };
      throw createError({ statusCode: 404, statusMessage: 'Message not found on mail server' });
    }

    return {
      success: true,
      data: updatedDoc
    };
  } catch (error: any) {
    if (client) {
      try { await client.logout(); } catch {}
    }
    console.error('[IMAP Hydrate Error]:', error.message || error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.responseText || error.message || 'Error hydrating email body'
    });
  }
});

