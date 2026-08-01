import ExcelJS from 'exceljs';
import { requireAuthSession } from '../../utils/auth';

function formatDate(date: any) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event);
  const { month, data } = body;

  const Firm = (await import('../../models/Firm')).default;
  const firm = await Firm.findById(user.firm_id).lean();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Wages Statement');

  worksheet.columns = [
    { key: 'sno', width: 8 },
    { key: 'name', width: 25 },
    { key: 'category', width: 18 },
    { key: 'project', width: 20 },
    { key: 'site', width: 20 },
    { key: 'aadhar', width: 16 },
    { key: 'bank', width: 20 },
    { key: 'account_no', width: 20 },
    { key: 'ifsc', width: 15 },
    { key: 'p_day_wage', width: 15 },
    { key: 'wage_days', width: 12 },
    { key: 'gross_salary', width: 15 },
    { key: 'epf_deduction', width: 15 },
    { key: 'esic_deduction', width: 15 },
    { key: 'other_deduction', width: 15 },
    { key: 'advance_deduction', width: 18 },
    { key: 'other_benefit', width: 15 },
    { key: 'net_salary', width: 18 },
    { key: 'payment_mode', width: 15 },
    { key: 'paid_date', width: 15 },
    { key: 'cheque_no', width: 15 },
    { key: 'status', width: 12 }
  ];

  // Header Title
  worksheet.insertRow(1, [(firm as any)?.name || 'COMPANY NAME']);
  worksheet.mergeCells('A1:V1');
  const titleRow = worksheet.getRow(1);
  titleRow.height = 30;
  const titleCell = worksheet.getCell('A1');
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };

  worksheet.insertRow(2, [`WAGES STATEMENT - ${month}`]);
  worksheet.mergeCells('A2:V2');
  const subTitleRow = worksheet.getRow(2);
  subTitleRow.height = 20;
  const subTitleCell = worksheet.getCell('A2');
  subTitleCell.font = { bold: true, size: 12, color: { argb: 'FF1F4E78' } };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.addRow([]);

  // Table Headers
  const tableHeaderRow = worksheet.getRow(4);
  tableHeaderRow.height = 25;
  const cols = [
    'S.No', 'Employee Name', 'Category', 'Project', 'Site', 'Aadhar No.',
    'Bank Name', 'Account No.', 'IFSC Code', 'Daily Rate', 'Days Worked',
    'Gross Salary', 'EPF', 'ESIC', 'Other Ded.', 'Adv. Recovery',
    'Other Benefits', 'Net Salary', 'Pay Mode', 'Pay Date', 'Cheque/Ref No.', 'Status'
  ];
  cols.forEach((col, idx) => {
    const cell = tableHeaderRow.getCell(idx + 1);
    cell.value = col;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  let currentRow = 5;
  (data || []).forEach((wage: any, index: number) => {
    const row = worksheet.addRow({
      sno: index + 1,
      name: wage.master_roll_id?.employee_name || wage.employee_name || 'N/A',
      category: wage.master_roll_id?.category || wage.category || '',
      project: wage.project || wage.master_roll_id?.project || '',
      site: wage.site || wage.master_roll_id?.site || '',
      aadhar: wage.master_roll_id?.aadhar || wage.aadhar || '',
      bank: wage.master_roll_id?.bank || wage.bank || '',
      account_no: wage.master_roll_id?.account_no || wage.account_no || '',
      ifsc: wage.master_roll_id?.ifsc || wage.ifsc || '',
      p_day_wage: wage.p_day_wage || 0,
      wage_days: wage.wage_days || 0,
      gross_salary: wage.gross_salary || 0,
      epf_deduction: wage.epf_deduction || 0,
      esic_deduction: wage.esic_deduction || 0,
      other_deduction: wage.other_deduction || 0,
      advance_deduction: wage.advance_deduction || 0,
      other_benefit: wage.other_benefit || 0,
      net_salary: wage.net_salary || 0,
      payment_mode: wage.payment_mode || 'CASH',
      paid_date: formatDate(wage.paid_date),
      cheque_no: wage.cheque_no || '',
      status: wage.status || 'POSTED'
    });

    row.getCell('account_no').numFmt = '@';
    row.getCell('aadhar').numFmt = '@';
    ['p_day_wage', 'gross_salary', 'epf_deduction', 'esic_deduction', 'other_deduction', 'advance_deduction', 'other_benefit', 'net_salary'].forEach(key => {
      row.getCell(key).numFmt = '₹#,##0.00';
    });
    currentRow++;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="Wages_${month}.xlsx"`
  });

  return buffer;
});
