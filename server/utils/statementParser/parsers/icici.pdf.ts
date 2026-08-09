import { extractPdfRows } from './pdfTableExtractor';
import type { RawTransaction, ParserInput } from '../registry';

export async function parseIciciPdf(input: ParserInput): Promise<RawTransaction[]> {
  const { rows } = await extractPdfRows(input.buffer, input.password, input.rawText);
  const transactions: RawTransaction[] = [];

  const datePattern = /^(\d{2}[-/.]\d{2}[-/.]\d{4}|\d{2}[-/][A-Za-z]{3}[-/]\d{4})/;

  let withdrawalHeaderX = 420;
  let depositHeaderX = 520;

  for (const row of rows) {
    const text = row.lineText;

    for (const item of row.items) {
      const s = item.text.trim();
      if (/Withdrawal/i.test(s) || /Dr/i.test(s)) {
        withdrawalHeaderX = item.x;
      } else if (/Deposit/i.test(s) || /Cr/i.test(s)) {
        depositHeaderX = item.x;
      }
    }

    if (
      text.includes('ICICI BANK') ||
      text.includes('Statement of Account') ||
      text.includes('Page') ||
      text.includes('Transaction Remarks') ||
      text.startsWith('S No')
    ) {
      continue;
    }

    if (datePattern.test(text) || /^\d+\s+\d{2}[-/.]\d{2}[-/.]\d{4}/.test(text)) {
      const match = text.match(/(\d{2}[-/.]\d{2}[-/.]\d{4}|\d{2}[-/][A-Za-z]{3}[-/]\d{4})\s+(.*)/);
      if (!match || !match[1]) continue;

      const dateStr: string = match[1];
      const remainder = match[2] || '';

      const amountItems = row.items.filter(i => /^[\d,]+\.\d{2}$/.test(i.text.trim()));

      let debit: number | undefined;
      let credit: number | undefined;
      let balance: number | undefined;

      const midPointX = (withdrawalHeaderX + depositHeaderX) / 2;

      if (amountItems.length >= 2) {
        const balItem = amountItems[amountItems.length - 1];
        const txnItem = amountItems[amountItems.length - 2];

        if (balItem) balance = parseFloat(balItem.text.replace(/,/g, ''));
        if (txnItem) {
          const val = parseFloat(txnItem.text.replace(/,/g, ''));
          if (txnItem.x >= midPointX) {
            credit = val;
          } else {
            debit = val;
          }
        }
      } else if (amountItems.length === 1 && amountItems[0]) {
        balance = parseFloat(amountItems[0].text.replace(/,/g, ''));
      }

      const descItems = row.items.filter(i => !/^[\d,]+\.\d{2}$/.test(i.text.trim()));
      const narration = descItems.map(i => i.text.trim()).join(' ').replace(/^(\d+\s+)?(\d{2}[-/.]\d{2}[-/.]\d{4}|\d{2}[-/][A-Za-z]{3}[-/]\d{4})\s*/, '').trim();

      transactions.push({
        date: dateStr,
        narration: narration || remainder,
        debit,
        credit,
        balance
      });
    } else if (transactions.length > 0 && text.trim().length > 0 && !/^Total/i.test(text)) {
      const last = transactions[transactions.length - 1];
      if (last) {
        last.narration += ' ' + text.trim();
      }
    }
  }

  return transactions;
}
