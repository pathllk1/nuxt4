import ExcelJS from 'exceljs';
import MasterRoll from '../../models/MasterRoll';
import Wage from '../../models/Wage';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  // Bug (report B1): this route was missing requireWageRole entirely. Same
  // check applied to its sibling at wages/history/[masterRollId]/export.get.ts
  // — worth confirming with the team whether these two routes should even
  // both exist, since they're byte-for-byte the same handler.
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const masterRollId = getRouterParam(event, 'masterRollId');

  const employee = await MasterRoll.findOne({ _id: masterRollId, firm_id: user.firm_id }).lean();
  if (!employee) {
    throw createError({
      statusCode: 404,
      message: 'Employee not found'
    });
  }

  const wages = await Wage.find({
    firm_id: user.firm_id,
    master_roll_id: masterRollId
  })
  .sort({ salary_month: -1 })
  .lean();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Wages Statement');

  worksheet.columns = [
    { key: 'month', width: 14 },
    { key: 'days', width: 10 },
    { key: 'rate', width: 15 },
    { key: 'gross', width: 18 },
    { key: 'epf', width: 16 },
    { key: 'esic', width: 16 },
    { key: 'adv', width: 20 },
    { key: 'other_ded', width: 20 },
    { key: 'other_ben', width: 18 },
    { key: 'net', width: 18 },
    { key: 'pay_mode', width: 16 },
    { key: 'pay_date', width: 16 },
    { key: 'status', width: 12 }
  ];

  const dualGradient: any = {
    type: 'gradient',
    gradient: 'angle',
    angle: 0,
    stops: [
      { position: 0, color: { argb: 'FF065F46' } },
      { position: 1, color: { argb: 'FF0D9488' } }
    ]
  };

  const headerStyle: any = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FF4B5563' } },
      left: { style: 'thin', color: { argb: 'FF4B5563' } },
      bottom: { style: 'thin', color: { argb: 'FF4B5563' } },
      right: { style: 'thin', color: { argb: 'FF4B5563' } }
    }
  };

  const borderStyle: any = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
  };

  worksheet.insertRow(1, ['INDIVIDUAL WAGES STATEMENT']);
  worksheet.mergeCells('A1:M1');
  const titleRow = worksheet.getRow(1);
  titleRow.height = 36;
  const titleCell = worksheet.getCell('A1');
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = dualGradient;

  worksheet.addRow([]);

  const labelFont = { bold: true, size: 10, color: { argb: 'FF4B5563' } };
  const valFont = { bold: true, size: 10, color: { argb: 'FF111827' } };

  const addMetaRow = (label1: string, val1: string, label2: string, val2: string, label3: string, val3: string) => {
    const row = worksheet.addRow([label1, val1, '', label2, val2, '', label3, val3]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      if (colNum === 1 || colNum === 4 || colNum === 7) {
        cell.font = labelFont;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNum === 2 || colNum === 5 || colNum === 8) {
        cell.font = valFont;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
    worksheet.mergeCells(`B${row.number}:C${row.number}`);
    worksheet.mergeCells(`E${row.number}:F${row.number}`);
    worksheet.mergeCells(`H${row.number}:M${row.number}`);
  };

  addMetaRow('Employee Name:', employee.employee_name, 'Aadhar Number:', employee.aadhar || 'N/A', 'Bank Account:', employee.account_no ? `${employee.bank} (A/C: ${employee.account_no})` : 'N/A');
  addMetaRow('Category:', employee.category || 'N/A', 'Project:', employee.project || 'N/A', 'Branch / IFSC:', `${employee.branch || 'N/A'} / ${employee.ifsc || 'N/A'}`);
  addMetaRow('Date of Joining:', employee.date_of_joining || 'N/A', 'Daily Wage Rate:', employee.p_day_wage ? `Rs. ${employee.p_day_wage}` : 'N/A', 'Employment Status:', employee.status || 'Active');

  worksheet.addRow([]);

  const tableHeaderRow = worksheet.getRow(7);
  tableHeaderRow.height = 26;
  const cols = [
    'MONTH', 'DAYS', 'RATE (DAILY)', 'GROSS SALARY', 'EPF DEDUCTION',
    'ESIC DEDUCTION', 'ADVANCE DEDUCTION', 'OTHER DEDUCTIONS',
    'OTHER BENEFITS', 'NET SALARY', 'PAYMENT MODE', 'PAYMENT DATE', 'STATUS'
  ];
  cols.forEach((col, idx) => {
    const cell = tableHeaderRow.getCell(idx + 1);
    cell.value = col;
    cell.style = headerStyle;
  });

  let currentRowIndex = 8;
  wages.forEach((wage: any, index) => {
    const row = worksheet.addRow({
      month: wage.salary_month,
      days: wage.wage_days || 0,
      rate: employee.p_day_wage || 0,
      gross: wage.gross_salary || 0,
      epf: wage.epf_deduction || 0,
      esic: wage.esic_deduction || 0,
      adv: wage.advance_deduction || 0,
      other_ded: wage.other_deduction || 0,
      other_ben: wage.other_benefit || 0,
      net: wage.net_salary || 0,
      pay_mode: wage.payment_mode || '-',
      pay_date: wage.paid_date ? new Date(wage.paid_date).toLocaleDateString('en-IN') : '-',
      status: wage.status || 'DRAFT'
    });

    row.height = 22;
    const zebraColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = borderStyle;
      cell.font = { size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraColor } };

      if (colNumber === 1 || colNumber === 11 || colNumber === 12 || colNumber === 13) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }

      if (colNumber === 2) {
        cell.numFmt = '0.0';
      } else if (colNumber >= 3 && colNumber <= 10) {
        cell.numFmt = '₹#,##0.00';
      }

      if (colNumber === 10) {
        cell.font = { bold: true, size: 10, color: { argb: 'FF065F46' } };
      }
    });
    currentRowIndex++;
  });

  if (wages.length > 0) {
    const totalRow = worksheet.addRow({
      month: 'TOTAL SUMMARY',
      days: { formula: `SUM(B8:B${currentRowIndex - 1})` },
      rate: '',
      gross: { formula: `SUM(D8:D${currentRowIndex - 1})` },
      epf: { formula: `SUM(E8:E${currentRowIndex - 1})` },
      esic: { formula: `SUM(F8:F${currentRowIndex - 1})` },
      adv: { formula: `SUM(G8:G${currentRowIndex - 1})` },
      other_ded: { formula: `SUM(H8:H${currentRowIndex - 1})` },
      other_ben: { formula: `SUM(I8:I${currentRowIndex - 1})` },
      net: { formula: `SUM(J8:J${currentRowIndex - 1})` }
    });

    totalRow.height = 26;
    totalRow.font = { bold: true, size: 10 };

    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = borderStyle;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 2) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '0.0';
      } else if (colNumber >= 4 && colNumber <= 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '₹#,##0.00';
      }

      if (colNumber === 10) {
        cell.font = { bold: true, size: 10, color: { argb: 'FF047857' } };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = (employee.employee_name || 'employee').replace(/[^a-zA-Z0-9]/g, '_');

  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="Wages_Statement_${safeName}.xlsx"`
  });

  return buffer;
});