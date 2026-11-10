import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { MailCouchbaseService } from '../../utils/mail-couchbase.service';
import { uploadToBackblazeB2 } from '../../utils/b2';
import type { MailMessage, MailAttachment } from '../../../app/types/mail';

export default defineEventHandler(async (event) => {
  let client: ImapFlow | null = null;
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const body = await readBody(event);

    if (!body.accountId || !body.imapHost || !body.username || !body.password) {
      throw createError({ statusCode: 400, statusMessage: 'Ephemeral credentials required for sync' });
    }

    const folderName = (typeof body.folder === 'string' && body.folder.trim()) ? body.folder.trim() : 'INBOX';
    const limit = Number(body.limit) || 50;

    // 1. Initialize ephemeral IMAP client
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

    // 2. Discover remote mailboxes and keep Couchbase folders in sync
    let remoteMailboxes: any[] = [];
    try {
      const mailboxes = await client.list();
      if (Array.isArray(mailboxes)) {
        remoteMailboxes = mailboxes;
        for (const mb of mailboxes) {
          const mbPath = String(mb?.path || '');
          if (!mbPath) continue;

          let specialUse: any = 'USER';
          if (mb.specialUse === '\\Inbox' || mbPath.toUpperCase() === 'INBOX') specialUse = 'INBOX';
          else if (mb.specialUse === '\\Sent' || mbPath.match(/sent/i)) specialUse = 'SENT';
          else if (mb.specialUse === '\\Drafts' || mbPath.match(/draft/i)) specialUse = 'DRAFTS';
          else if (mb.specialUse === '\\Archive' || mbPath.match(/archive/i)) specialUse = 'ARCHIVE';
          else if (mb.specialUse === '\\Junk' || mbPath.match(/junk|bulk|spam/i)) specialUse = 'JUNK';
          else if (mb.specialUse === '\\Trash' || mbPath.match(/trash|deleted/i)) specialUse = 'TRASH';

          let displayName = String(mb.name || mbPath);
          if (mbPath.toUpperCase() === 'INBOX') displayName = 'Inbox';
          else if (mbPath.toLowerCase() === 'draft') displayName = 'Drafts';
          else if (mbPath.toLowerCase() === 'bulk') displayName = 'Junk Email';
          else if (mbPath.toLowerCase() === 'trash') displayName = 'Deleted Items';

          await MailCouchbaseService.saveFolder({
            id: mbPath,
            accountId: body.accountId,
            firmId,
            name: displayName,
            path: mbPath,
            delimiter: mb.delimiter || '/',
            specialUse,
            unreadCount: 0,
            totalCount: 0,
            updatedAt: new Date().toISOString()
          });
        }
      }
    } catch (listErr: any) {
      console.warn('[IMAP Sync] Mailbox listing notice:', listErr?.message || listErr);
    }

    // 3. Resolve the exact remote mailbox path matching requested folderName
    let targetPath = folderName;
    if (remoteMailboxes.length > 0) {
      const exactMatch = remoteMailboxes.find(mb => mb.path?.toLowerCase() === folderName.toLowerCase());
      if (exactMatch) {
        targetPath = exactMatch.path;
      } else {
        const lower = folderName.toLowerCase();
        let matched: any = null;
        if (lower === 'inbox') {
          matched = remoteMailboxes.find(mb => mb.specialUse === '\\Inbox' || mb.path?.toUpperCase() === 'INBOX');
        } else if (lower.includes('sent')) {
          matched = remoteMailboxes.find(mb => mb.specialUse === '\\Sent' || mb.path?.toLowerCase().includes('sent'));
        } else if (lower.includes('draft')) {
          matched = remoteMailboxes.find(mb => mb.specialUse === '\\Drafts' || mb.path?.toLowerCase().includes('draft'));
        } else if (lower.includes('archive')) {
          matched = remoteMailboxes.find(mb => mb.specialUse === '\\Archive' || mb.path?.toLowerCase().includes('archive'));
        } else if (lower.includes('junk') || lower.includes('spam') || lower.includes('bulk')) {
          matched = remoteMailboxes.find(mb => mb.specialUse === '\\Junk' || /junk|spam|bulk/i.test(mb.path || ''));
        } else if (lower.includes('trash') || lower.includes('delete')) {
          matched = remoteMailboxes.find(mb => mb.specialUse === '\\Trash' || /trash|deleted/i.test(mb.path || ''));
        }

        if (matched && matched.path) {
          targetPath = matched.path;
        } else {
          console.warn(`[IMAP Sync] Mailbox "${folderName}" not found on IMAP server. Defaulting to INBOX.`);
          targetPath = 'INBOX';
        }
      }
    }

    // 4. Acquire mailbox lock (selects target mailbox on server)
    const lock = await client.getMailboxLock(targetPath);

    let syncedCount = 0;
    try {
      // Use live selected mailbox metrics directly (STATUS on selected mailbox is forbidden by RFC 3501)
      const mailboxInfo = (client as any).mailbox;
      const totalCount = (mailboxInfo && typeof mailboxInfo.exists === 'number') ? mailboxInfo.exists : 0;
      const uidVal = (mailboxInfo && mailboxInfo.uidValidity) ? Number(mailboxInfo.uidValidity) : undefined;

      // RFC-compliant unread search on the selected mailbox
      let unreadCount = 0;
      try {
        const unreadUids = await client.search({ seen: false }, { uid: true });
        unreadCount = Array.isArray(unreadUids) ? unreadUids.length : 0;
      } catch (unseenErr) {
        console.warn('[IMAP Sync] Unseen search notice:', unseenErr);
      }

      // Search for recent message UIDs in this mailbox
      const searchResult = await client.search({ all: true }, { uid: true });
      const recentUids = (searchResult || []).slice(-limit);

      if (recentUids.length > 0) {
        // Fetch raw RFC 822 source in pipelined batch with { uid: true }
        for await (const msg of client.fetch(recentUids, {
          envelope: true,
          flags: true,
          source: true
        }, { uid: true })) {
          if (!msg.source) continue;

          // Parse full MIME message with mailparser for 100% compliant decoding
          const parsed = await simpleParser(msg.source);

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

          const flagsList = msg.flags ? Array.from(msg.flags) : [];
          const isRead = msg.flags ? msg.flags.has('\\Seen') : false;
          const isFlagged = msg.flags ? msg.flags.has('\\Flagged') : false;
          const isAnswered = msg.flags ? msg.flags.has('\\Answered') : false;

          const subject = parsed.subject || '(No Subject)';
          const msgDate = parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString();
          const timestamp = parsed.date ? new Date(parsed.date).getTime() : Date.now();
          const messageId = parsed.messageId || `<${msg.uid}.${timestamp}@mail>`;

          // Heuristic classifier: marketing/automated to 'other', personal/work/system alerts to 'focused'
          const isAutomated = subject.match(/newsletter|digest|mailer-daemon|unsubscribe|promotions/i) ||
            fromAddress.match(/mailer-daemon|unsubscribe/i);
          const tab: 'focused' | 'other' = isAutomated ? 'other' : 'focused';

          const snippet = (parsed.text || subject).replace(/\s+/g, ' ').trim().slice(0, 180);
          const bodyHtml = (parsed.html as string) || (parsed.textAsHtml as string) || `<p>${subject}</p>`;
          const bodyText = parsed.text || snippet;

          const docId = `msg::${body.accountId}::${msg.uid}`;

          // Parse attachments and upload binary content to Backblaze B2 cloud storage
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
                  const b2Prefix = `mail-attachments/${firmId}/${body.accountId}/${msg.uid}`;
                  const uploadResult = await uploadToBackblazeB2(buf, filename, b2Prefix);
                  b2Key = uploadResult.targetPath;
                } catch (b2Err: any) {
                  console.warn(`[MailSync] B2 upload skipped for ${filename}:`, b2Err.message);
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
          const mailDoc: MailMessage = {
            id: docId,
            type: 'message',
            accountId: body.accountId,
            folderId: folderName,
            firmId,
            userId,
            uid: msg.uid,
            messageId,
            threadId: messageId.replace(/[<>]/g, ''),
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
            flags: flagsList,
            isRead,
            isFlagged,
            isAnswered,
            importance: 'normal',
            tab,
            categories: []
          };

          await MailCouchbaseService.saveMessage(mailDoc);

          // Auto-collect sender contact
          await MailCouchbaseService.autoCollectContact(firmId, userId, {
            name: fromName,
            address: fromAddress
          });

          syncedCount++;
        }
      }

      // Update folder counts using live mailbox metrics
      await MailCouchbaseService.saveFolder({
        id: targetPath,
        accountId: body.accountId,
        firmId,
        name: folderName === 'INBOX' ? 'Inbox' : folderName,
        path: targetPath,
        delimiter: '/',
        specialUse: targetPath.toUpperCase() === 'INBOX' ? 'INBOX' : 'USER',
        unreadCount,
        totalCount,
        uidValidity: uidVal,
        updatedAt: new Date().toISOString()
      });

    } finally {
      lock.release();
    }

    await client.logout();
    client = null;

    return {
      success: true,
      syncedCount,
      folder: targetPath
    };
  } catch (error: any) {
    if (client) {
      try { await client.logout(); } catch {}
    }
    const details = [
      error.message,
      error.responseText,
      error.executedCommand,
      error.responseStatus
    ].filter(Boolean).join(' | ');
    console.error('[IMAP Sync Error]:', details || error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.responseText || error.message || 'Error executing mail synchronization'
    });
  }
});
