import { extractPdfRows } from './pdfTableExtractor';
import type { RawTransaction, ParserInput } from '../registry';

export async function parseGenericPdf(input: ParserInput): Promise<RawTransaction[]> {
  const { rows } = await extractPdfRows(input.buffer, input.password);
  const transactions: RawTransaction[] = [];

  const datePattern = /^(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})/;

  for (const row of rows) {
    const text = row.lineText;
    if (!datePattern.test(text)) continue;

    const match = text.match(/^(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})\s+(.*)/);
    if (!match) continue;

    const dateStr = match[1];
    const remainder = match[2] || '';

    const amountItems = row.items.filter(i => /^[\d,]+\.\d{2}$/.test(i.text.trim()));

    let debit: number | undefined;
    let credit: number | undefined;
    let balance: number | undefined;

    if (amountItems.length >= 2) {
      const balanceItem = amountItems[amountItems.length - 1];
      const txnItem = amountItems[amountItems.length - 2];
      if (balanceItem) balance = parseFloat(balanceItem.text.replace(/,/g, ''));
      if (txnItem) {
        const val = parseFloat(txnItem.text.replace(/,/g, ''));
        if (text.includes('CR') || text.includes('CREDIT')) credit = val;
        else debit = val;
      }
    } else if (amountItems.length === 1) {
      balance = parseFloat(amountItems[0].text.replace(/,/g, ''));
    }

    const descItems = row.items.filter(i => !/^[\d,]+\.\d{2}$/.test(i.text.trim()));
    const narration = descItems.map(i => i.text.trim()).join(' ').replace(/^(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})\s*/, '').trim();

    transactions.push({
      date: dateStr,
      narration: narration || remainder,
      debit,
      credit,
      balance
    });
  }

  return transactions;
}
