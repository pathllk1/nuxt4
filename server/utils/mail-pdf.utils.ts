// @ts-ignore - pdfmake server-side entry point
import pdfMake from 'pdfmake';
// @ts-ignore - pdfkit for safe image validation
import PDFDocument from 'pdfkit';
import { parseDocument, DomUtils } from 'htmlparser2';
import { dejavuVfs } from './accounting/vfs-dejavu-fonts';

// Register in-memory VFS fonts for serverless & local environments
if ((pdfMake as any).virtualfs) {
  for (const [fontFile, base64Data] of Object.entries(dejavuVfs)) {
    (pdfMake as any).virtualfs.writeFileSync(fontFile, base64Data, 'base64');
  }
}

const fonts = {
  DejaVuSans: {
    normal: 'DejaVuSans.ttf',
    bold: 'DejaVuSans-Bold.ttf',
    italics: 'DejaVuSans-Oblique.ttf',
    bolditalics: 'DejaVuSans-BoldOblique.ttf',
  },
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  }
};

if (typeof (pdfMake as any).addFonts === 'function') {
  (pdfMake as any).addFonts(fonts);
} else {
  (pdfMake as any).setFonts({
    ...((pdfMake as any).fonts || {}),
    ...fonts,
  });
}

if (typeof (pdfMake as any).setUrlAccessPolicy === 'function') {
  (pdfMake as any).setUrlAccessPolicy(() => false);
}
if (typeof (pdfMake as any).setLocalAccessPolicy === 'function') {
  (pdfMake as any).setLocalAccessPolicy(() => true);
}

function stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validates raster image data before passing to pdfmake to ensure zero crash
 */
function isValidPdfImage(dataUrl: string): boolean {
  if (!dataUrl) return false;
  try {
    const doc = new PDFDocument();
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match || !match[2]) return false;
    const buf = Buffer.from(match[2], 'base64');
    (doc as any).openImage(buf);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely resolves an image src (data URL or HTTPS logo) into a validated base64 data URL
 */
async function resolveImageDataUrl(src: string, attribs: any = {}): Promise<string | null> {
  if (!src) return null;
  // Ignore tracking pixels
  if (attribs.width === '1' || attribs.height === '1' || attribs.width === '0' || attribs.height === '0') return null;

  if (src.startsWith('data:image/')) {
    if (src.startsWith('data:image/png') || src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg')) {
      return isValidPdfImage(src) ? src : null;
    }
    return null;
  }

  if (!src.startsWith('http://') && !src.startsWith('https://')) return null;

  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (!ctype.includes('png') && !ctype.includes('jpeg') && !ctype.includes('jpg')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 1.5 * 1024 * 1024) return null; // 1.5 MB limit
    const dataUrl = `data:${ctype.split(';')[0]};base64,${buf.toString('base64')}`;
    return isValidPdfImage(dataUrl) ? dataUrl : null;
  } catch {
    return null;
  }
}

/**
 * Recursively extracts rich inline spans from DOM nodes preserving bold,
 * italics, underlines, hyperlinks, inline code, and line breaks.
 */
function extractInlineSpans(node: any, currentStyle: any = {}): any[] {
  if (!node) return [];

  // Plain Text Node
  if (node.type === 'text') {
    const raw = (node.data || '').replace(/[\r\n\t]+/g, ' ');
    if (!raw.trim() && raw.length > 1) return [{ text: ' ' }];
    if (!raw) return [];
    return [{ text: raw, ...currentStyle }];
  }

  // Line Break
  if (node.name === 'br') {
    return [{ text: '\n' }];
  }

  // Derive inherited inline style
  const newStyle = { ...currentStyle };
  const tag = (node.name || '').toLowerCase();

  if (tag === 'strong' || tag === 'b') newStyle.bold = true;
  if (tag === 'em' || tag === 'i') newStyle.italics = true;
  if (tag === 'u') newStyle.decoration = 'underline';
  if (tag === 'code') {
    newStyle.fontSize = (currentStyle.fontSize || 9.5) * 0.9;
    newStyle.color = '#B91C1C';
  }
  if (tag === 'a') {
    const href = node.attribs?.href;
    if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))) {
      newStyle.link = href;
      newStyle.color = '#2563EB';
      newStyle.decoration = 'underline';
    }
  }

  const spans: any[] = [];
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      spans.push(...extractInlineSpans(child, newStyle));
    }
  }

  return spans;
}

/**
 * Distinguishes genuine tabular data (e.g. invoices, financial screeners, billing grids)
 * from HTML email layout wrapper tables (used by Dropbox, newsletters, etc. for alignment).
 */
function isRealDataTable(tableNode: any): boolean {
  if (!tableNode || !tableNode.attribs) return false;
  const role = (tableNode.attribs.role || '').toLowerCase();
  if (role === 'presentation' || role === 'none') return false;

  // Real data tables have table headers (<th>) or a <thead> block
  const ths = DomUtils.getElementsByTagName('th', tableNode);
  if (ths.length > 0) return true;

  const theads = DomUtils.getElementsByTagName('thead', tableNode);
  if (theads.length > 0) return true;

  // If table contains nested tables, it's a layout wrapper, not a leaf data table
  const nestedTables = DomUtils.getElementsByTagName('table', tableNode);
  if (nestedTables.length > 0) return false;

  // If a table has an explicit data border attribute with multiple rows and cells
  const hasBorder = tableNode.attribs.border && tableNode.attribs.border !== '0';
  if (hasBorder) {
    const rows = DomUtils.getElementsByTagName('tr', tableNode);
    return rows.length >= 2;
  }

  // Multi-column grid (3+ columns across multiple rows) without large block containers
  const rows = DomUtils.getElementsByTagName('tr', tableNode);
  if (rows.length >= 2 && rows[0]) {
    const firstRowCells = DomUtils.findAll((el: any) => el.name === 'td', [rows[0]]);
    if (firstRowCells.length >= 3) {
      const hasBlockChildren = DomUtils.findAll(
        (el: any) => ['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol'].includes(el.name),
        tableNode
      ).length > 0;
      return !hasBlockChildren;
    }
  }

  return false;
}

/**
 * Dynamic HTML-to-PdfMake content converter.
 * Converts genuine data tables into crisp vector PDF tables.
 * Layout tables (used in newsletters like Dropbox) are seamlessly unpacked
 * and rendered with rich inline spans (bold, italics, links, images, bullet lists).
 */
async function convertHtmlToPdfmake(html: string, fallbackText: string): Promise<{ elements: any[]; maxCols: number }> {
  if (!html || !html.trim()) {
    return {
      elements: [{ text: fallbackText || '', fontSize: 9.5, lineHeight: 1.45, color: '#1E293B', margin: [0, 0, 0, 10] }],
      maxCols: 0
    };
  }

  try {
    const dom = parseDocument(html);
    const elements: any[] = [];
    let maxCols = 0;

    async function walk(node: any): Promise<void> {
      if (!node) return;

      // Images (Logos, email graphics)
      if (node.name === 'img') {
        const src = node.attribs?.src;
        if (src) {
          const dataUrl = await resolveImageDataUrl(src, node.attribs);
          if (dataUrl) {
            elements.push({
              image: dataUrl,
              fit: [140, 50],
              margin: [0, 4, 0, 8]
            });
          }
        }
        return;
      }

      // Real Data Table (e.g. Screener 13-column financial alert, invoices)
      if (node.name === 'table' && isRealDataTable(node)) {
        const rows = DomUtils.getElementsByTagName('tr', node);
        const tableBody: any[][] = [];
        let cols = 0;

        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
          const row = rows[rIdx];
          if (!row) continue;
          const cells = DomUtils.findAll((el: any) => el.name === 'th' || el.name === 'td', [row]);
          cols = Math.max(cols, cells.length);
          const isHeader = rIdx === 0 || cells.some((c: any) => c.name === 'th');

          const rowCells = cells.map((c: any) => {
            const isTh = c.name === 'th' || isHeader;
            const spans = extractInlineSpans(c, {
              bold: isTh,
              color: isTh ? '#0F172A' : '#1E293B',
            });

            const rawText = DomUtils.innerText(c).trim();
            const isNumeric = /^[\d,.\-%+₹$€£\s]+$/.test(rawText) && rawText.length > 0 && !rawText.endsWith('.');

            let fontSize = 8;
            if (cols > 10) fontSize = 5.5;
            else if (cols > 7) fontSize = 6.5;
            else if (cols > 5) fontSize = 7.5;

            return {
              stack: spans.length > 0 ? [{ text: spans, fontSize, lineHeight: 1.25 }] : [{ text: rawText, fontSize, lineHeight: 1.25 }],
              alignment: isNumeric && !isTh ? 'right' : 'left',
              fillColor: isTh ? '#F1F5F9' : undefined,
              borderColor: ['#CBD5E1', '#CBD5E1', '#CBD5E1', '#CBD5E1']
            };
          });

          if (rowCells.length > 0) {
            tableBody.push(rowCells);
          }
        }

        maxCols = Math.max(maxCols, cols);

        if (tableBody.length > 0) {
          tableBody.forEach(r => {
            while (r.length < cols) {
              r.push({ text: '', borderColor: ['#CBD5E1', '#CBD5E1', '#CBD5E1', '#CBD5E1'] });
            }
          });

          elements.push({
            table: {
              headerRows: 1,
              widths: Array(cols).fill('*'),
              body: tableBody
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#CBD5E1',
              vLineColor: () => '#CBD5E1',
              paddingLeft: () => (cols > 8 ? 2 : 4),
              paddingRight: () => (cols > 8 ? 2 : 4),
              paddingTop: () => 3,
              paddingBottom: () => 3
            },
            margin: [0, 8, 0, 14]
          });
        }
        return;
      }

      // Layout table (Dropbox, Mailchimp, newsletter wrappers) -> unpack children
      if (node.name === 'table' || node.name === 'tbody' || node.name === 'thead' || node.name === 'tr') {
        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            await walk(child);
          }
        }
        return;
      }

      // Table cell in a layout table
      if (node.name === 'td') {
        const hasBlockChildren = DomUtils.findAll((el: any) =>
          ['table', 'p', 'div', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'img'].includes(el.name),
          [node]
        ).length > 0;

        if (hasBlockChildren) {
          if (node.children) {
            for (const child of node.children) {
              await walk(child);
            }
          }
        } else {
          const spans = extractInlineSpans(node);
          if (spans.length > 0) {
            elements.push({
              text: spans,
              fontSize: 9.5,
              lineHeight: 1.45,
              color: '#1E293B',
              margin: [0, 0, 0, 6]
            });
          }
        }
        return;
      }

      // Lists (<ul>, <ol>)
      if (node.name === 'ul' || node.name === 'ol') {
        const listItems = DomUtils.getElementsByTagName('li', node);
        const itemStacks = listItems.map((li: any) => {
          const spans = extractInlineSpans(li);
          return { text: spans, fontSize: 9.5, lineHeight: 1.4, color: '#1E293B' };
        }).filter((item: any) => item.text.length > 0);

        if (itemStacks.length > 0) {
          if (node.name === 'ol') {
            elements.push({ ol: itemStacks, margin: [12, 4, 0, 8] });
          } else {
            elements.push({ ul: itemStacks, margin: [12, 4, 0, 8] });
          }
        }
        return;
      }

      // Headings
      if (['h1', 'h2', 'h3', 'h4', 'h5'].includes(node.name)) {
        const spans = extractInlineSpans(node, { bold: true });
        if (spans.length > 0) {
          const sizes: Record<string, number> = { h1: 14, h2: 12.5, h3: 11, h4: 10, h5: 9.5 };
          const margins: Record<string, number[]> = { h1: [0, 14, 0, 6], h2: [0, 10, 0, 4], h3: [0, 8, 0, 3], h4: [0, 6, 0, 2], h5: [0, 4, 0, 2] };
          elements.push({
            text: spans,
            fontSize: sizes[node.name] || 11,
            bold: true,
            color: '#0F172A',
            margin: margins[node.name] || [0, 8, 0, 4]
          });
        }
        return;
      }

      // Paragraphs and Divs
      if (node.name === 'p' || node.name === 'div') {
        const childDataTables = DomUtils.findAll((el: any) => el.name === 'table' && isRealDataTable(el), [node]);
        const childLists = DomUtils.findAll((el: any) => el.name === 'ul' || el.name === 'ol', [node]);
        const childImages = DomUtils.findAll((el: any) => el.name === 'img', [node]);

        if (childDataTables.length > 0 || childLists.length > 0 || childImages.length > 0) {
          if (node.children) {
            for (const child of node.children) {
              await walk(child);
            }
          }
        } else {
          const spans = extractInlineSpans(node);
          if (spans.length > 0) {
            // Detect if this paragraph is an executive subheading (all spans bold, < 90 chars)
            const rawText = spans.map((s: any) => s.text).join('').trim();
            const isAllBold = spans.every((s: any) => s.bold || !s.text.trim());
            const isSubheading = isAllBold && rawText.length > 0 && rawText.length < 90 && !rawText.endsWith('.');

            if (isSubheading) {
              elements.push({
                text: spans,
                fontSize: 11,
                bold: true,
                color: '#0F172A',
                margin: [0, 10, 0, 4]
              });
            } else {
              elements.push({
                text: spans,
                fontSize: 9.5,
                lineHeight: 1.45,
                color: '#1E293B',
                margin: [0, 0, 0, 6]
              });
            }
          }
        }
        return;
      }

      // Fallback: traverse remaining children
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          await walk(child);
        }
      }
    }

    const root = DomUtils.getElementsByTagName('body', dom)[0] || dom;
    if (root.children) {
      for (const child of root.children) {
        await walk(child);
      }
    }

    if (elements.length === 0) {
      const cleanText = stripHtmlToText(html);
      elements.push({
        text: cleanText || fallbackText,
        fontSize: 9.5,
        lineHeight: 1.45,
        color: '#1E293B',
        margin: [0, 0, 0, 10]
      });
    }

    return { elements, maxCols };
  } catch (err) {
    console.warn('[mail-pdf.utils] HTML parsing notice:', err);
    return {
      elements: [{ text: stripHtmlToText(html) || fallbackText, fontSize: 9.5, lineHeight: 1.45, color: '#1E293B', margin: [0, 0, 0, 10] }],
      maxCols: 0
    };
  }
}

export async function generateMailPdfBuffer(options: {
  message: any;
  thread?: any[];
  isThread?: boolean;
}): Promise<Buffer> {
  const { message, thread = [], isThread = false } = options;
  const messagesToExport = isThread && thread.length > 1
    ? [...thread].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    : [message];

  const subject = message.subject || '(No Subject)';
  const content: any[] = [];
  let globalMaxCols = 0;

  // Header Banner
  content.push({
    columns: [
      {
        stack: [
          { text: 'BUSINESSPRO SUITE', fontSize: 13, bold: true, color: '#0F172A' },
          { text: 'OFFICIAL ENTERPRISE MAIL RECORD', fontSize: 7.5, bold: true, color: '#64748B', margin: [0, 2, 0, 0] }
        ]
      },
      {
        stack: [
          { text: `Exported: ${new Date().toLocaleString()}`, fontSize: 7.5, color: '#64748B', alignment: 'right' },
          {
            text: isThread ? `Conversation: ${messagesToExport.length} Messages` : 'Single Message',
            fontSize: 7.5,
            bold: true,
            color: '#475569',
            alignment: 'right',
            margin: [0, 2, 0, 0]
          }
        ]
      }
    ],
    margin: [0, 0, 0, 10]
  });

  // Divider Line
  content.push({
    table: {
      widths: ['*'],
      body: [[{ text: '', border: [false, false, false, true], borderColor: ['#000', '#000', '#000', '#0F172A'] }]]
    },
    margin: [0, 0, 0, 10]
  });

  // Subject Heading
  content.push({
    text: subject,
    fontSize: 14,
    bold: true,
    color: '#0F172A',
    margin: [0, 0, 0, 10]
  });

  // Loop through messages
  for (let idx = 0; idx < messagesToExport.length; idx++) {
    const msg = messagesToExport[idx];
    const fromName = msg.from?.name || '';
    const fromAddr = msg.from?.address || '';
    const fromDisplay = fromName ? `${fromName} <${fromAddr}>` : fromAddr;

    const toList = (msg.to || [])
      .map((t: any) => (t.name ? `${t.name} <${t.address}>` : t.address))
      .join(', ') || 'Undisclosed recipients';

    const ccList = (msg.cc || [])
      .map((t: any) => (t.name ? `${t.name} <${t.address}>` : t.address))
      .join(', ');

    const dateStr = new Date(msg.timestamp || msg.date).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const isSent = msg.folderId === 'Sent';
    const roleTag = isSent ? ' [SENT BY YOU]' : '';

    // Metadata Card
    const metaStack: any[] = [
      {
        columns: [
          { text: [{ text: 'From: ', bold: true, color: '#475569' }, { text: fromDisplay + roleTag, bold: true, color: '#0F172A' }], width: '*' },
          { text: [{ text: 'Date: ', bold: true, color: '#475569' }, { text: dateStr, color: '#334155' }], width: 'auto' }
        ],
        margin: [0, 0, 0, 3]
      },
      {
        text: [{ text: 'To: ', bold: true, color: '#475569' }, { text: toList, color: '#334155' }],
        margin: [0, 0, 0, 3]
      }
    ];

    if (ccList) {
      metaStack.push({
        text: [{ text: 'Cc: ', bold: true, color: '#475569' }, { text: ccList, color: '#334155' }],
        margin: [0, 0, 0, 3]
      });
    }

    if (msg.attachments && msg.attachments.length > 0) {
      const attsText = msg.attachments
        .map((a: any) => `${a.filename} (${formatBytes(a.size)})`)
        .join('  •  ');
      metaStack.push({
        text: [{ text: 'Attachments: ', bold: true, color: '#475569' }, { text: attsText, color: '#1E293B', font: 'Helvetica' }],
        margin: [0, 0, 0, 3]
      });
    }

    if (messagesToExport.length > 1) {
      content.push({
        text: `Message ${idx + 1} of ${messagesToExport.length}`,
        fontSize: 8.5,
        bold: true,
        color: '#6366F1',
        margin: [0, idx > 0 ? 12 : 0, 0, 4]
      });
    }

    content.push({
      table: {
        widths: ['*'],
        body: [[
          {
            fillColor: '#F8FAFC',
            borderColor: ['#CBD5E1', '#CBD5E1', '#CBD5E1', '#CBD5E1'],
            stack: metaStack,
            margin: [5, 5, 5, 5]
          }
        ]]
      },
      margin: [0, 0, 0, 10]
    });

    // Body content: dynamically converted from HTML with rich formatting
    const { elements: bodyElements, maxCols } = await convertHtmlToPdfmake(
      msg.bodyHtml || '',
      msg.bodyText || msg.snippet || ''
    );
    globalMaxCols = Math.max(globalMaxCols, maxCols);

    bodyElements.forEach(el => content.push(el));

    if (idx < messagesToExport.length - 1) {
      content.push({
        table: {
          widths: ['*'],
          body: [[{ text: '', border: [false, false, false, true], borderColor: ['#000', '#000', '#000', '#CBD5E1'] }]]
        },
        margin: [0, 0, 0, 12]
      });
    }
  }

  // Switch to landscape orientation if email contains wide tables (more than 6 columns)
  const isLandscape = globalMaxCols > 6;

  const docDefinition = {
    defaultStyle: {
      font: 'DejaVuSans',
      fontSize: 10,
      color: '#0F172A'
    },
    pageOrientation: isLandscape ? 'landscape' : 'portrait',
    pageMargins: isLandscape ? [24, 24, 24, 24] : [36, 36, 36, 36],
    footer: (currentPage: number, pageCount: number) => {
      return {
        columns: [
          { text: 'Confidential • BusinessPro Suite Enterprise Messaging', fontSize: 7.5, color: '#94A3B8', margin: [isLandscape ? 24 : 36, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7.5, color: '#94A3B8', alignment: 'right', margin: [0, 0, isLandscape ? 24 : 36, 0] }
        ]
      };
    },
    content
  };

  const doc = (pdfMake as any).createPdf(docDefinition);
  const buffer = await doc.getBuffer();
  return Buffer.from(buffer);
}
