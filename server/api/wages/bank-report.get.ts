import ExcelJS from 'exceljs';
import Wage from '../../models/Wage';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

function formatDate(date: any) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const query = getQuery(event);
  const month = query.month as string;
  const chequeNo = query.chequeNo as string;

  if (!month) {
    throw createError({
      statusCode: 400,
      message: 'Month is required'
    });
  }

  const filter: any = { firm_id: user.firm_id, salary_month: month };
  if (chequeNo) {
    filter.cheque_no = chequeNo;
  }

  const wages = await Wage.find(filter)
    .populate('master_roll_id', 'employee_name aadhar bank account_no ifsc project site')
    .sort({ 'master_roll_id.employee_name': 1 })
    .lean();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Bank Payout Report');

  worksheet.columns = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Bank Name', key: 'bank', width: 20 },
    { header: 'Account Number', key: 'account_no', width: 20 },
    { header: 'IFSC Code', key: 'ifsc', width: 15 },
    { header: 'Net Salary (₹)', key: 'net_salary', width: 18 },
    { header: 'Payment Mode', key: 'payment_mode', width: 15 },
    { header: 'Paid Date', key: 'paid_date', width: 15 },
    { header: 'Cheque/Ref No.', key: 'cheque_no', width: 18 }
  ];

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }
  };

  let totalPayout = 0;
  wages.forEach((wage: any, index: number) => {
    const mr = wage.master_roll_id;
    const net = wage.net_salary || 0;
    totalPayout += net;

    const row = worksheet.addRow({
      sno: index + 1,
      name: mr?.employee_name || 'N/A',
      bank: mr?.bank || '',
      account_no: mr?.account_no || '',
      ifsc: mr?.ifsc || '',
      net_salary: net,
      payment_mode: wage.payment_mode || 'BANK',
      paid_date: formatDate(wage.paid_date),
      cheque_no: wage.cheque_no || ''
    });

    row.getCell('account_no').numFmt = '@';
    row.getCell('net_salary').numFmt = '₹#,##0.00';
  });

  if (wages.length > 0) {
    const totalRow = worksheet.addRow({
      sno: '',
      name: 'TOTAL PAYOUT',
      bank: '',
      account_no: '',
      ifsc: '',
      net_salary: totalPayout,
      payment_mode: '',
      paid_date: '',
      cheque_no: ''
    });
    totalRow.font = { bold: true };
    totalRow.getCell('net_salary').numFmt = '₹#,##0.00';
  }

  const buffer = await workbook.xlsx.writeBuffer();
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="Bank_Report_${month.replace(/[^a-zA-Z0-9-]/g, '')}${chequeNo ? `_${chequeNo.replace(/[^a-zA-Z0-9-]/g, '')}` : ''}.xlsx"`
  });

  return buffer;
});