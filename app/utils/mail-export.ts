import type { MailMessage } from '@/types/mail';

function sanitizeFilename(name: string): string {
  return (name || 'email')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

function formatDate(val: string | number): string {
  if (!val) return '';
  try {
    return new Date(val).toUTCString();
  } catch {
    return String(val);
  }
}

/**
 * Generates and downloads an authentic RFC 822 .eml file compatible with
 * Microsoft Outlook, Windows Mail, Apple Mail, and Mozilla Thunderbird
 */
export function exportMailToEml(message: MailMessage): void {
  if (typeof window === 'undefined') return;

  const boundary = `----=_Part_BProSuite_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const dateStr = formatDate(message.timestamp || message.date);
  const fromStr = message.from?.name
    ? `"${message.from.name}" <${message.from.address}>`
    : message.from?.address || 'unknown@domain.com';

  const toStr = (message.to || [])
    .map(t => (t.name ? `"${t.name}" <${t.address}>` : t.address))
    .join(', ');

  const ccStr = (message.cc || [])
    .map(t => (t.name ? `"${t.name}" <${t.address}>` : t.address))
    .join(', ');

  const subject = message.subject || '(No Subject)';
  const bodyText = message.bodyText || message.snippet || '';
  const bodyHtml = message.bodyHtml || `<div>${(message.bodyText || '').replace(/\n/g, '<br>')}</div>`;

  let eml = '';
  eml += `From: ${fromStr}\r\n`;
  eml += `To: ${toStr}\r\n`;
  if (ccStr) eml += `Cc: ${ccStr}\r\n`;
  eml += `Subject: ${subject}\r\n`;
  eml += `Date: ${dateStr}\r\n`;
  eml += `Message-ID: ${message.messageId || `<${message.id}@businesspro-suite.com>`}\r\n`;
  if (message.threadId) eml += `Thread-Index: ${message.threadId}\r\n`;
  eml += `MIME-Version: 1.0\r\n`;
  eml += `X-Mailer: BusinessPro Suite Enterprise Webmail\r\n`;
  eml += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
  eml += `\r\n`;

  // Plain Text Version
  eml += `--${boundary}\r\n`;
  eml += `Content-Type: text/plain; charset="utf-8"\r\n`;
  eml += `Content-Transfer-Encoding: 7bit\r\n`;
  eml += `\r\n`;
  eml += `${bodyText}\r\n`;
  eml += `\r\n`;

  // HTML Version
  eml += `--${boundary}\r\n`;
  eml += `Content-Type: text/html; charset="utf-8"\r\n`;
  eml += `Content-Transfer-Encoding: 7bit\r\n`;
  eml += `\r\n`;
  eml += `${bodyHtml}\r\n`;
  eml += `\r\n`;

  eml += `--${boundary}--\r\n`;

  const blob = new Blob([eml], { type: 'message/rfc822;charset=utf-8' });
  triggerFileDownload(blob, `${sanitizeFilename(subject)}.eml`);
}

/**
 * Exports single message or full conversation thread as a clean text transcript (.txt)
 */
export function exportMailToText(options: {
  message: MailMessage;
  thread?: MailMessage[];
  exportEntireThread?: boolean;
}): void {
  if (typeof window === 'undefined') return;

  const { message, thread = [], exportEntireThread = false } = options;
  const isThread = exportEntireThread && thread.length > 1;
  const list = isThread
    ? [...thread].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    : [message];

  let text = '';
  text += `======================================================================\n`;
  text += `BUSINESS PRO SUITE - MAIL RECORD\n`;
  text += `Subject: ${message.subject || '(No Subject)'}\n`;
  text += `Generated: ${new Date().toLocaleString()}\n`;
  text += `Messages: ${list.length}\n`;
  text += `======================================================================\n\n`;

  list.forEach((m, idx) => {
    if (list.length > 1) {
      text += `--- Message ${idx + 1} of ${list.length} ---\n`;
    }
    text += `From: ${m.from?.name || ''} <${m.from?.address || ''}>\n`;
    text += `To: ${(m.to || []).map(t => `${t.name ? t.name + ' ' : ''}<${t.address}>`).join(', ')}\n`;
    if (m.cc && m.cc.length > 0) {
      text += `Cc: ${m.cc.map(t => `${t.name ? t.name + ' ' : ''}<${t.address}>`).join(', ')}\n`;
    }
    text += `Date: ${new Date(m.timestamp || m.date).toLocaleString()}\n`;
    if (m.attachments && m.attachments.length > 0) {
      text += `Attachments: ${m.attachments.map(a => `${a.filename} (${a.size} B)`).join(', ')}\n`;
    }
    text += `\n`;
    text += (m.bodyText || m.snippet || '').trim();
    text += `\n\n`;
    if (idx < list.length - 1) {
      text += `----------------------------------------------------------------------\n\n`;
    }
  });

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const filename = `${sanitizeFilename(message.subject || 'email')}${isThread ? '_thread' : ''}.txt`;
  triggerFileDownload(blob, filename);
}

/**
 * Downloads server-generated official PDF for a message or full conversation thread
 */
export async function exportMailToPdf(options: {
  messageId: string;
  subject: string;
  isThread?: boolean;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  const { messageId, subject, isThread = false } = options;
  const url = `/api/mail/messages/${encodeURIComponent(messageId)}/export/pdf?thread=${isThread}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to generate PDF: ${res.statusText}`);
  }

  const blob = await res.blob();
  const filename = `${sanitizeFilename(subject)}${isThread ? '_thread' : ''}.pdf`;
  triggerFileDownload(blob, filename);
}

function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
