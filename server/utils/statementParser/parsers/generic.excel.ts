import ExcelJS from 'exceljs';
import type { RawTransaction, ParserInput } from '../registry';

export async function parseGenericExcel(input: ParserInput): Promise<RawTransaction[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input.buffer as any);
  const sheet = workbook.worksheets[0];

  if (!sheet) return [];

  const transactions: RawTransaction[] = [];
  let headerRowIndex = 1;

  sheet.eachRow((row, rowNumber) => {
    const rowText = row.values?.toString().toLowerCase() || '';
    if (rowText.includes('date') && (rowText.includes('description') || rowText.includes('narration') || rowText.includes('particulars'))) {
      headerRowIndex = rowNumber;
    }
  });

  for (let i = headerRowIndex + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const dateCell = row.getCell(1).text?.trim();
    if (!dateCell) continue;

    const narration = row.getCell(2).text?.trim() || '';
    const refNo = row.getCell(3).text?.trim() || '';
    const debitVal = parseAmount(row.getCell(4).text);
    const creditVal = parseAmount(row.getCell(5).text);
    const balanceVal = parseAmount(row.getCell(6).text);

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
