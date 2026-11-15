import type { MailMessage } from '@/types/mail';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(val: string | number): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    return d.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return String(val);
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSingleMessageHtml(msg: MailMessage, index?: number, total?: number): string {
  const fromName = msg.from?.name || '';
  const fromAddr = msg.from?.address || '';
  const fromDisplay = fromName ? `${escapeHtml(fromName)} &lt;${escapeHtml(fromAddr)}&gt;` : escapeHtml(fromAddr);

  const toList = (msg.to || []).map(t => {
    return t.name ? `${escapeHtml(t.name)} &lt;${escapeHtml(t.address)}&gt;` : escapeHtml(t.address);
  }).join(', ');

  const ccList = (msg.cc || []).map(t => {
    return t.name ? `${escapeHtml(t.name)} &lt;${escapeHtml(t.address)}&gt;` : escapeHtml(t.address);
  }).join(', ');

  const attachmentsList = (msg.attachments || []).map(a => {
    return `<span class="attachment-pill">📎 ${escapeHtml(a.filename)} (${formatFileSize(a.size)})</span>`;
  }).join(' ');

  const isSent = msg.folderId === 'Sent';
  const roleBadge = isSent ? `<span class="badge badge-sent">SENT BY YOU</span>` : '';

  let bodyContent = '';
  if (msg.bodyHtml) {
    bodyContent = `<div class="email-body-html">${msg.bodyHtml}</div>`;
  } else {
    bodyContent = `<div class="email-body-text">${escapeHtml(msg.bodyText || msg.snippet || '')}</div>`;
  }

  const threadStep = total && total > 1 ? `<div class="message-step-pill">Message ${index! + 1} of ${total}</div>` : '';

  return `
    <div class="message-card">
      <div class="message-header">
        <div class="meta-row header-primary">
          <div class="from-block">
            <span class="meta-label">From:</span>
            <span class="meta-value font-bold">${fromDisplay}</span>
            ${roleBadge}
          </div>
          <div class="date-block">
            <span class="meta-label">Date:</span>
            <span class="meta-value">${formatDate(msg.timestamp || msg.date)}</span>
          </div>
        </div>

        <div class="meta-row">
          <span class="meta-label">To:</span>
          <span class="meta-value">${toList || 'Undisclosed recipients'}</span>
        </div>

        ${ccList ? `
          <div class="meta-row">
            <span class="meta-label">Cc:</span>
            <span class="meta-value">${ccList}</span>
          </div>
        ` : ''}

        ${attachmentsList ? `
          <div class="meta-row attachments-row">
            <span class="meta-label">Attachments:</span>
            <div class="attachments-wrap">${attachmentsList}</div>
          </div>
        ` : ''}
      </div>

      ${threadStep}

      <div class="message-content">
        ${bodyContent}
      </div>
    </div>
  `;
}

/**
 * Triggers clean, high-fidelity browser print dialog for an email or conversation thread
 */
export function printMailContent(options: {
  message: MailMessage;
  thread?: MailMessage[];
  printEntireThread?: boolean;
}): void {
  if (typeof window === 'undefined') return;

  const { message, thread = [], printEntireThread = false } = options;
  const isThread = printEntireThread && thread.length > 1;
  const messagesToPrint = isThread
    ? [...thread].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    : [message];

  const subject = message.subject || '(No Subject)';
  const printTimestamp = formatDate(Date.now());

  const messagesHtml = messagesToPrint
    .map((m, idx) => buildSingleMessageHtml(m, idx, messagesToPrint.length))
    .join('<div class="thread-divider"></div>');

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)} - Print Preview</title>
  <style>
    @page {
      size: auto;
      margin: 12mm 15mm 15mm 15mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.5;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    .print-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      margin-bottom: 12px;
      border-bottom: 2px solid #0f172a;
    }

    .brand-title {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
    }

    .brand-subtitle {
      font-size: 8.5pt;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .print-meta {
      text-align: right;
      font-size: 8.5pt;
      color: #64748b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .subject-headline {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 14px 0;
      line-height: 1.3;
      padding-bottom: 6px;
    }

    .message-card {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }

    .message-header {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 12px;
      font-size: 9pt;
    }

    .meta-row {
      display: flex;
      margin-bottom: 4px;
      line-height: 1.4;
    }

    .meta-row:last-child {
      margin-bottom: 0;
    }

    .header-primary {
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }

    .meta-label {
      width: 75px;
      font-weight: 700;
      color: #475569;
      flex-shrink: 0;
    }

    .meta-value {
      color: #0f172a;
      word-break: break-word;
    }

    .font-bold {
      font-weight: 700;
    }

    .badge {
      display: inline-block;
      font-size: 7.5pt;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      margin-left: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-sent {
      background: #e0e7ff;
      color: #4338ca;
      border: 1px solid #c7d2fe;
    }

    .message-step-pill {
      display: inline-block;
      font-size: 8pt;
      font-weight: 700;
      color: #6366f1;
      background: #eef2ff;
      border: 1px solid #e0e7ff;
      padding: 2px 8px;
      border-radius: 9999px;
      margin-bottom: 8px;
    }

    .attachments-row {
      align-items: center;
      margin-top: 4px;
    }

    .attachments-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .attachment-pill {
      display: inline-block;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 8pt;
      color: #334155;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .message-content {
      padding: 6px 4px 16px 4px;
      font-size: 10.5pt;
      line-height: 1.5;
      color: #1e293b;
      word-break: break-word;
    }

    .email-body-text {
      white-space: pre-wrap;
      font-family: inherit;
    }

    .email-body-html {
      width: 100%;
      word-break: break-word;
    }

    .email-body-html img {
      max-width: 100% !important;
      height: auto !important;
    }

    /* Preserve native email HTML structure, data tables & newsletter layouts */
    .email-body-html table {
      max-width: 100%;
      page-break-inside: auto;
    }

    .email-body-html tr {
      page-break-inside: avoid;
    }

    .email-body-html th {
      font-weight: 700;
    }

    .thread-divider {
      border-top: 2px dashed #cbd5e1;
      margin: 16px 0;
      position: relative;
    }

    .print-footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #94a3b8;
    }

    @media screen {
      body {
        padding: 20px;
        background: #f1f5f9;
      }
      .page-container {
        max-width: 900px;
        margin: 0 auto;
        background: #ffffff;
        padding: 30px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        border-radius: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="print-banner">
      <div>
        <div class="brand-title">BusinessPro Suite</div>
        <div class="brand-subtitle">Official Mail Record</div>
      </div>
      <div class="print-meta">
        <div>Printed: ${printTimestamp}</div>
        ${isThread ? `<div>Conversation Thread (${messagesToPrint.length} Messages)</div>` : '<div>Single Message Record</div>'}
      </div>
    </div>

    <h1 class="subject-headline">${escapeHtml(subject)}</h1>

    ${messagesHtml}

    <div class="print-footer">
      <span>Confidential &bull; BusinessPro Suite Enterprise Messaging</span>
      <span>Page Record Generated Automatically</span>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;

  // Create isolated offscreen iframe for seamless printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(fullHtml);
  doc.close();

  // Clean up iframe after user completes or cancels the print dialog
  const cleanup = () => {
    try {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    } catch {}
  };

  iframe.contentWindow?.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 120000); // 2 minute fail-safe fallback
}
