// Polyfill DOMMatrix for Node.js server environment prior to loading pdfjs-dist
if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(init?: any) {
      if (Array.isArray(init) && init.length >= 6) {
        this.a = init[0]; this.b = init[1]; this.c = init[2];
        this.d = init[3]; this.e = init[4]; this.f = init[5];
      }
    }
  };
}

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface TextItemPos {
  text: string;
  x: number;
  y: number;
  width: number;
}

export interface PdfRow {
  y: number;
  items: TextItemPos[];
  lineText: string;
}

export async function extractPdfRows(
  buffer: Buffer | Uint8Array,
  password?: string,
  providedRawText?: string
): Promise<{ rows: PdfRow[]; fullText: string; pageCount: number }> {
  // If pre-extracted rawText was provided by client, construct rows directly; otherwise use pdfjs-dist legacy engine
  if (providedRawText && providedRawText.trim().length > 0) {
    const lines = providedRawText.split('\n');
    const rows: PdfRow[] = lines.map((line, idx) => ({
      y: 1000 - idx * 10,
      items: [{ text: line, x: 0, y: 1000 - idx * 10, width: line.length * 6 }],
      lineText: line.trim()
    }));
    return { rows, fullText: providedRawText, pageCount: 1 };
  }

  const loadingTask = (pdfjsLib as any).getDocument({
    data: new Uint8Array(buffer),
    password: password || undefined
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;

  const allRows: PdfRow[] = [];
  let combinedFullText = '';

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as any[];

    const posItems: TextItemPos[] = items
      .filter(it => it.str && it.str.trim())
      .map(it => ({
        text: String(it.str),
        x: Number(it.transform?.[4] || 0),
        y: Number(it.transform?.[5] || 0),
        width: Number(it.width || 0)
      }));

    const rowsMap = new Map<number, TextItemPos[]>();
    for (const item of posItems) {
      let matchedY: number | null = null;
      for (const existingY of rowsMap.keys()) {
        if (Math.abs(existingY - item.y) <= 3.5) {
          matchedY = existingY;
          break;
        }
      }
      if (matchedY !== null) {
        rowsMap.get(matchedY)!.push(item);
      } else {
        rowsMap.set(item.y, [item]);
      }
    }

    const sortedYs = Array.from(rowsMap.keys()).sort((a, b) => b - a);

    for (const y of sortedYs) {
      const lineItems = rowsMap.get(y) || [];
      lineItems.sort((a, b) => a.x - b.x);

      let lineText = '';
      let prevX = -1;
      for (const item of lineItems) {
        if (prevX !== -1 && item.x - prevX > 15) {
          lineText += '   ';
        } else if (prevX !== -1 && item.x - prevX > 3) {
          lineText += ' ';
        }
        lineText += item.text;
        prevX = item.x + item.width;
      }

      combinedFullText += lineText + '\n';
      allRows.push({ y, items: lineItems, lineText: lineText.trim() });
    }
  }

  return { rows: allRows, fullText: combinedFullText, pageCount };
}
