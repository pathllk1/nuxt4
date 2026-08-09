import { extractPdfRows } from './pdfTableExtractor';
import type { RawTransaction, ParserInput } from '../registry';

export async function parseSbiPdf(input: ParserInput): Promise<RawTransaction[]> {
  const { rows } = await extractPdfRows(input.buffer, input.password, input.rawText);
  const transactions: RawTransaction[] = [];

  const datePattern = /^(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;

  for (const row of rows) {
    const text = row.lineText;

    if (
      text.startsWith('Statement of Account') ||
      text.startsWith('Txn Date') ||
      text.startsWith('Account Name') ||
      text.includes('STATE BANK OF INDIA') ||
      text.includes('Page No.')
    ) {
      continue;
    }

    if (datePattern.test(text)) {
      const match = text.match(/^(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s+(.*)/);
      if (!match) continue;

      const dateStr = match[1] || '';
      if (!dateStr) continue;
      const remainder = match[2] || '';

      const amountItems = row.items.filter(i => /^[\d,]+\.\d{2}$/.test(i.text.trim()));

      let debit: number | undefined;
      let credit: number | undefined;
      let balance: number | undefined;

      const item0 = amountItems[0];
      const item1 = amountItems[1];
      const item2 = amountItems[2];

      if (amountItems.length >= 3 && item0 && item1 && item2) {
        debit = parseFloat(item0.text.replace(/,/g, ''));
        credit = parseFloat(item1.text.replace(/,/g, ''));
        balance = parseFloat(item2.text.replace(/,/g, ''));
      } else if (amountItems.length === 2 && item0 && item1) {
        const amtVal = parseFloat(item0.text.replace(/,/g, ''));
        balance = parseFloat(item1.text.replace(/,/g, ''));
        if (text.includes('CR') || text.includes('CREDIT')) {
          credit = amtVal;
        } else {
          debit = amtVal;
        }
      } else if (amountItems.length === 1 && item0) {
        balance = parseFloat(item0.text.replace(/,/g, ''));
      }

      const descItems = row.items.filter(i => !/^[\d,]+\.\d{2}$/.test(i.text.trim()));
      let fullDesc = descItems.map(i => i.text.trim()).join(' ').replace(/^(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s*/, '').trim();

      transactions.push({
        date: dateStr,
        narration: fullDesc || remainder,
        debit,
        credit,
        balance
      });
    } else if (transactions.length > 0 && text.trim().length > 0 && !/^Total|^Ending/i.test(text)) {
      const last = transactions[transactions.length - 1];
      if (last) {
        last.narration += ' ' + text.trim();
      }
    }
  }

  return transactions;
}
