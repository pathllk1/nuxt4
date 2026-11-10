import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import nodemailer from 'nodemailer';
import { MailCouchbaseService } from '../../utils/mail-couchbase.service';
import { uploadToBackblazeB2 } from '../../utils/b2';
import type { MailMessage, MailAttachment } from '../../../app/types/mail';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const body = await readBody(event);

    if (!body.smtpHost || !body.username || !body.password || !body.to || !body.to.length) {
      throw createError({ statusCode: 400, statusMessage: 'Recipient and SMTP credentials are required' });
    }

    const transporter = nodemailer.createTransport({
      host: body.smtpHost,
      port: Number(body.smtpPort) || 465,
      secure: body.smtpSecure !== false,
      auth: {
        user: body.username,
        pass: body.password
      }
    });

    const toAddresses = Array.isArray(body.to) ? body.to : [body.to];
    const ccAddresses = Array.isArray(body.cc) ? body.cc : (body.cc ? [body.cc] : []);
    const bccAddresses = Array.isArray(body.bcc) ? body.bcc : (body.bcc ? [body.bcc] : []);

    const mailOptions: any = {
      from: body.from || `"${body.displayName || body.username}" <${body.username}>`,
      to: toAddresses.map((t: any) => typeof t === 'string' ? t : t.address).join(', '),
      subject: body.subject || '(No Subject)',
      html: body.bodyHtml || `<p>${body.bodyText || ''}</p>`,
      text: body.bodyText || body.bodyHtml?.replace(/<[^>]*>/g, '') || ''
    };

    if (ccAddresses.length > 0) {
      mailOptions.cc = ccAddresses.map((c: any) => typeof c === 'string' ? c : c.address).join(', ');
    }
    if (bccAddresses.length > 0) {
      mailOptions.bcc = bccAddresses.map((b: any) => typeof b === 'string' ? b : b.address).join(', ');
    }
    if (body.inReplyTo) {
      mailOptions.inReplyTo = body.inReplyTo;
    }
    if (body.references) {
      mailOptions.references = body.references;
    }
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const sentDocId = `msg::${body.accountId || 'default'}::sent_${nowMs}`;

    const nodemailerAttachments: any[] = [];
    const savedAttachments: MailAttachment[] = [];

    if (body.attachments && Array.isArray(body.attachments)) {
      for (let idx = 0; idx < body.attachments.length; idx++) {
        const att = body.attachments[idx];
        const filename = att.filename || `attachment_${idx}`;
        const contentType = att.contentType || 'application/octet-stream';
        let buffer: Buffer | null = null;

        if (att.content) {
          if (Buffer.isBuffer(att.content)) {
            buffer = att.content;
          } else if (typeof att.content === 'string') {
            // Check if base64 encoded
            const base64Data = att.content.includes(';base64,') ? att.content.split(';base64,').pop() : att.content;
            buffer = Buffer.from(base64Data || '', 'base64');
          }
        }

        if (buffer && buffer.length > 0) {
          const attId = `att_sent_${nowMs}_${idx}`;
          let b2Key: string | undefined = undefined;

          try {
            const b2Prefix = `mail-attachments/${firmId}/${body.accountId || 'default'}/sent_${nowMs}`;
            const uploadResult = await uploadToBackblazeB2(buffer, filename, b2Prefix);
            b2Key = uploadResult.targetPath;
          } catch (b2Err: any) {
            console.warn(`[MailSend] Outgoing attachment upload skipped for ${filename}:`, b2Err.message);
          }

          nodemailerAttachments.push({
            filename,
            content: buffer,
            contentType
          });

          savedAttachments.push({
            id: attId,
            filename,
            contentType,
            size: buffer.length,
            b2Key,
            downloadUrl: `/api/mail/attachment?messageId=${encodeURIComponent(sentDocId)}&attachmentId=${encodeURIComponent(attId)}`
          });
        }
      }
    }

    if (nodemailerAttachments.length > 0) {
      mailOptions.attachments = nodemailerAttachments;
    }

    // Dispatch via SMTP
    const info = await transporter.sendMail(mailOptions);

    // Save copy in Couchbase Sent folder
    const sentMailDoc: MailMessage = {
      id: sentDocId,
      type: 'message',
      accountId: body.accountId || 'default',
      folderId: 'Sent',
      firmId,
      userId,
      uid: Math.floor(nowMs / 1000),
      messageId: info.messageId || `<${nowMs}@local>`,
      threadId: (body.inReplyTo || info.messageId || String(nowMs)).replace(/[<>]/g, ''),
      subject: body.subject || '(No Subject)',
      from: { name: body.displayName || body.username, address: body.username },
      to: toAddresses.map((t: any) => typeof t === 'string' ? { name: t, address: t } : t),
      cc: ccAddresses.map((c: any) => typeof c === 'string' ? { name: c, address: c } : c),
      date: nowIso,
      timestamp: nowMs,
      snippet: (body.bodyText || body.bodyHtml?.replace(/<[^>]*>/g, '') || '').slice(0, 180),
      bodyHtml: body.bodyHtml || `<p>${body.bodyText || ''}</p>`,
      hasAttachments: savedAttachments.length > 0,
      attachments: savedAttachments.length > 0 ? savedAttachments : undefined,
      flags: ['\\Seen'],
      isRead: true,
      isFlagged: false,
      isAnswered: false,
      importance: body.importance || 'normal',
      tab: 'focused',
      categories: []
    };

    await MailCouchbaseService.saveMessage(sentMailDoc);

    // Auto-collect recipient contacts to train suggestion engine
    for (const recipient of toAddresses) {
      const addr = typeof recipient === 'string' ? { name: recipient.split('@')[0], address: recipient } : recipient;
      await MailCouchbaseService.autoCollectContact(firmId, userId, addr);
    }

    return {
      success: true,
      messageId: info.messageId,
      sentMessage: sentMailDoc
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error sending email'
    });
  }
});

