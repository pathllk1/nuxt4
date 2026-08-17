import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import BulkPayment from '../../../../models/BulkPayment';
import { requireAuthSession } from '../../../../utils/auth';

function formatDateForBankReport(dateStr: string | Date | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const id = getRouterParam(event, 'id');

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid Batch ID is required' });
  }

  const batch = await BulkPayment.findOne({
    _id: new mongoose.Types.ObjectId(id),
    firmId: firmIdObj
  }).lean();

  if (!batch) {
    throw createError({ statusCode: 404, statusMessage: 'Bulk payment batch not found' });
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Bank Report');

  // Row 1: CHEQUE NUMBER
  const r1 = worksheet.addRow(['CHEQUE NUMBER', batch.chequeNo || '']);
  r1.getCell(1).font = { bold: true };
  r1.getCell(2).numFmt = '@';

  // Row 2: CHEQUE DATE
  const r2 = worksheet.addRow(['CHEQUE DATE', formatDateForBankReport(batch.paymentDate)]);
  r2.getCell(1).font = { bold: true };
  r2.getCell(2).numFmt = '@';

  // Row 3: 10 Standard Corporate Bank CMS Column Headers
  const headers = [
    'PAYSYS ID(RTGS/NEFT)',
    'DEBIT ACCOUNT',
    'TRAN AMOUNT',
    'BENEFICIARY ACCOUNT',
    'BENEFICIARY ACCOUNT TYPE',
    'BENEFICIARY NAME',
    'BENEFICIARY ADD1',
    'BENEFICIARY ADD2',
    'BENEFICIARY IFSC',
    'SENDER TO RECEIVER INFO'
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FF000000' } };
  headerRow.height = 20;

  // Set column widths for clean viewing
  worksheet.getColumn(1).width = 24;  // PAYSYS ID
  worksheet.getColumn(2).width = 22;  // DEBIT ACCOUNT
  worksheet.getColumn(3).width = 16;  // TRAN AMOUNT
  worksheet.getColumn(4).width = 24;  // BENEFICIARY ACCOUNT
  worksheet.getColumn(5).width = 26;  // BENEFICIARY ACCOUNT TYPE
  worksheet.getColumn(6).width = 28;  // BENEFICIARY NAME
  worksheet.getColumn(7).width = 26;  // BENEFICIARY ADD1 (Bank Name)
  worksheet.getColumn(8).width = 26;  // BENEFICIARY ADD2 (Branch Name)
  worksheet.getColumn(9).width = 20;  // BENEFICIARY IFSC
  worksheet.getColumn(10).width = 26; // SENDER TO RECEIVER INFO

  let calculatedTotal = 0;

  // Data Rows
  (batch.items || []).forEach((item: any) => {
    const amount = Number(item.amount) || 0;
    calculatedTotal += amount;

    const paysys = item.paysysId || (amount >= 200000 ? 'RTGS' : 'NEFT');
    const displayInfo = batch.chequeNo || item.narration || '';

    const row = worksheet.addRow([
      paysys,
      String(batch.bankAccountNumber || '').trim(),
      amount,
      String(item.beneficiaryAccountNo || '').trim(),
      String(item.beneficiaryAccountType || '10').trim(),
      String(item.beneficiaryName || '').trim(),
      String(item.beneficiaryBankName || '').trim(),
      String(item.beneficiaryBranch || '').trim(),
      String(item.beneficiaryIfsc || '').trim().toUpperCase(),
      String(displayInfo).trim()
    ]);

    // Force strict text formatting (@) on all account numbers and code columns
    // to preserve leading zeros and prevent 16+ digit IEEE-754 precision cutoff
    row.getCell(1).numFmt = '@';
    row.getCell(2).numFmt = '@';
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(4).numFmt = '@';
    row.getCell(5).numFmt = '@';
    row.getCell(6).numFmt = '@';
    row.getCell(7).numFmt = '@';
    row.getCell(8).numFmt = '@';
    row.getCell(9).numFmt = '@';
    row.getCell(10).numFmt = '@';
  });

  // Summary Row with Total Amount
  const totalRow = worksheet.addRow(['', '', calculatedTotal]);
  totalRow.font = { bold: true };
  totalRow.getCell(3).numFmt = '#,##0.00';

  // Apply clean thin cell borders matching standard corporate bank exports
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 3) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
        };
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const safeBatchName = String(batch.batchNo).replace(/[^a-zA-Z0-9_-]/g, '_');

  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="Bank_Report_${safeBatchName}.xlsx"`
  });

  return buffer;
});
