import ExcelJS from 'exceljs';
import type { RawTransaction, ParserInput } from '../registry';

export async function parseIciciExcel(input: ParserInput): Promise<RawTransaction[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input.buffer as any);
  const sheet = workbook.worksheets[0];

  if (!sheet) return [];

  const transactions: RawTransaction[] = [];
  let headerRowIndex = -1;
  let colDate = 1;
  let colNarration = 3;
  let colRef = 4;
  let colWithdrawal = 5;
  let colDeposit = 6;
  let colBalance = 7;

  sheet.eachRow((row, rowNumber) => {
    const values = row.values as any[];
    if (!values) return;
    const rowText = values.join(' ').toLowerCase();

    if (rowText.includes('remarks') || rowText.includes('particulars') || rowText.includes('transaction details')) {
      headerRowIndex = rowNumber;
      values.forEach((cellVal, colIdx) => {
        const str = String(cellVal || '').toLowerCase().trim();
        if (str.includes('date')) colDate = colIdx;
        else if (str.includes('remarks') || str.includes('particulars') || str.includes('description')) colNarration = colIdx;
        else if (str.includes('chq') || str.includes('ref')) colRef = colIdx;
        else if (str.includes('withdrawal') || str.includes('debit') || str.includes('dr')) colWithdrawal = colIdx;
        else if (str.includes('deposit') || str.includes('credit') || str.includes('cr')) colDeposit = colIdx;
        else if (str.includes('balance')) colBalance = colIdx;
      });
    }
  });

  if (headerRowIndex === -1) headerRowIndex = 1;

  for (let i = headerRowIndex + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const dateCell = row.getCell(colDate).text?.trim();
    if (!dateCell) continue;

    const narration = row.getCell(colNarration).text?.trim() || '';
    const refNo = colRef ? row.getCell(colRef).text?.trim() || '' : '';
    const debitVal = parseAmount(row.getCell(colWithdrawal).text);
    const creditVal = parseAmount(row.getCell(colDeposit).text);
    const balanceVal = parseAmount(row.getCell(colBalance).text);

    if (!debitVal && !creditVal && !balanceVal && !narration) continue;

    transactions.push({
      date: dateCell,
      narration,
      refNo,
      debit: debitVal,
      credit: creditVal,
      balance: balanceVal
    });
  }

  return transactions;
}

function parseAmount(val?: string): number | undefined {
  if (!val) return undefined;
  const cleaned = val.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}
