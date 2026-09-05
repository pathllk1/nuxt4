import ExcelJS from 'exceljs';
import Wage from '../../models/Wage';
import BankAccount from '../../models/BankAccount';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const query = getQuery(event);
  const month = query.month as string;
  const chequeNo = query.chequeNo as string;
  const paymentMode = query.paymentMode as string;

  if (!month) {
    throw createError({
      statusCode: 400,
      message: 'Month is required'
    });
  }

  if (!chequeNo || chequeNo.trim() === '' || chequeNo.trim().toLowerCase() === 'all') {
    throw createError({
      statusCode: 400,
      message: 'Cheque / Ref No is required to generate the Bank Payout Report'
    });
  }

  const cleanChequeNo = chequeNo.trim();
  const filter: any = { 
    firm_id: user.firm_id, 
    salary_month: month,
    cheque_no: cleanChequeNo
  };

  if (paymentMode && paymentMode !== 'all') {
    filter.payment_mode = paymentMode;
  } else {
    // Exclude CASH payments from bank payout report by default
    filter.payment_mode = { $ne: 'CASH' };
  }

  const wages = await Wage.find(filter)
    .populate('master_roll_id', 'employee_name aadhar bank account_no ifsc branch project site')
    .populate('bank_account_id', 'account_number bank_name')
    .sort({ 'master_roll_id.employee_name': 1 })
    .lean();

  if (wages.length === 0) {
    throw createError({
      statusCode: 404,
      message: `No wage records found for Cheque / Ref No "${cleanChequeNo}" in ${month}`
    });
  }

  const defaultBankAccount = await BankAccount.findOne({
    firm_id: user.firm_id,
    is_default: true,
    status: { $ne: 'INACTIVE' }
  }).lean() || await BankAccount.findOne({
    firm_id: user.firm_id,
    status: { $ne: 'INACTIVE' }
  }).lean();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Bank Report');

  const resolvedChequeNo = cleanChequeNo;

  const firstPaidDate = wages.find((w: any) => w.paid_date)?.paid_date;

  // Row 1: CHEQUE NUMBER
  const r1 = worksheet.addRow(['CHEQUE NUMBER', String(resolvedChequeNo).trim()]);
  r1.getCell(1).font = { name: 'Calibri', size: 11 };
  r1.getCell(2).font = { name: 'Calibri', size: 11 };
  r1.getCell(2).numFmt = '@';

  // Row 2: CHEQUE DATE
  const r2 = worksheet.addRow(['CHEQUE DATE', '']);
  r2.getCell(1).font = { name: 'Calibri', size: 11 };
  r2.getCell(2).font = { name: 'Calibri', size: 11 };
  const validDate = firstPaidDate ? new Date(firstPaidDate) : new Date();
  if (!isNaN(validDate.getTime())) {
    r2.getCell(2).value = validDate;
    r2.getCell(2).numFmt = 'mm-dd-yy';
  } else {
    r2.getCell(2).value = String(firstPaidDate || '');
  }

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
  headerRow.height = 60;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  // Set column widths matching sample corporate bank layout
  worksheet.getColumn(1).width = 10;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 15;
  worksheet.getColumn(4).width = 24;
  worksheet.getColumn(5).width = 14;
  worksheet.getColumn(6).width = 28;
  worksheet.getColumn(7).width = 25;
  worksheet.getColumn(8).width = 30;
  worksheet.getColumn(9).width = 18;
  worksheet.getColumn(10).width = 15;

  let totalPayout = 0;

  wages.forEach((wage: any) => {
    const mr = wage.master_roll_id;
    const net = Math.round(wage.net_salary || 0);
    totalPayout += net;

    const paysys = wage.payment_mode === 'RTGS' || (net >= 200000 && wage.payment_mode !== 'NEFT') ? 'RTGS' : 'NEFT';
    const debitAccount = String((wage.bank_account_id as any)?.account_number || defaultBankAccount?.account_number || '').trim();
    const benefBranch = mr?.branch || mr?.site || mr?.project || '';
    const itemCheque = wage.cheque_no || resolvedChequeNo || '';

    const row = worksheet.addRow([
      paysys,
      debitAccount,
      net,
      String(mr?.account_no || '').trim(),
      '10',
      String(mr?.employee_name || '').trim(),
      String(mr?.bank || '').trim(),
      String(benefBranch).trim(),
      String(mr?.ifsc || '').trim().toUpperCase(),
      String(itemCheque).trim()
    ]);

    row.getCell(1).font = { name: 'Calibri', size: 11 };
    row.getCell(2).font = { name: 'Calibri', size: 11 };
    row.getCell(2).numFmt = '@';
    row.getCell(3).font = { name: 'Calibri', size: 11 };
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(4).font = { name: 'Calibri', size: 11 };
    row.getCell(4).numFmt = '@';
    row.getCell(5).font = { name: 'Calibri', size: 11 };
    row.getCell(5).numFmt = '@';
    row.getCell(6).font = { name: 'Calibri', size: 11 };
    row.getCell(7).font = { name: 'Calibri', size: 11 };
    row.getCell(8).font = { name: 'Calibri', size: 11 };
    row.getCell(9).font = { name: 'Calibri', size: 11 };
    row.getCell(9).numFmt = '@';
    row.getCell(10).font = { name: 'Calibri', size: 11 };
    row.getCell(10).numFmt = '@';
  });

  if (wages.length > 0) {
    const totalRow = worksheet.addRow(['', '', totalPayout]);
    totalRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true };
    totalRow.getCell(2).font = { name: 'Calibri', size: 11, bold: true };
    totalRow.getCell(3).font = { name: 'Calibri', size: 11, bold: true };
    totalRow.getCell(3).numFmt = '#,##0.00';
  }

  // Apply clean thin cell borders to all cells
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  r1.getCell(1).border = thinBorder;
  r1.getCell(2).border = thinBorder;
  r2.getCell(1).border = thinBorder;
  r2.getCell(2).border = thinBorder;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 3) {
      for (let c = 1; c <= 10; c++) {
        row.getCell(c).border = thinBorder;
      }
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="Bank_Report_${month.replace(/[^a-zA-Z0-9-]/g, '')}${resolvedChequeNo ? `_${resolvedChequeNo.replace(/[^a-zA-Z0-9-]/g, '')}` : ''}.xlsx"`
  });

  return buffer;
});