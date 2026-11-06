import ExcelJS from 'exceljs';
import Wage from '../../models/Wage';
import MasterRoll from '../../models/MasterRoll';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';
import { computeEmployerEsic } from '~~/shared/utils/statutory-rates';

function toYmd(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString().split('T')[0] || '';
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (s.includes('T')) return s.split('T')[0] || '';
    const parts = s.split(/[-/]/);
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];
    if (p0 && p1 && p2 && p0.length <= 2 && p2.length === 4) {
      return `${p2}-${p1.padStart(2, '0')}-${p0.padStart(2, '0')}`;
    }
    return s;
  }
  return '';
}

function formatDateDisplay(date: any): string {
  if (!date) return '';
  const ymd = toYmd(date);
  if (ymd) {
    const parts = ymd.split('-');
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];
    if (p0 && p1 && p2) {
      return `${p2}-${p1}-${p0}`;
    }
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return typeof date === 'string' ? date : '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const query = getQuery(event);
  const month = query.month as string;

  if (!month) {
    throw createError({
      statusCode: 400,
      message: 'Month query parameter is required'
    });
  }

  const wages = await Wage.find({ firm_id: user.firm_id, salary_month: month })
    .populate('master_roll_id', 'employee_name aadhar bank account_no project site date_of_joining date_of_exit p_day_wage status')
    .sort({ 'master_roll_id.employee_name': 1 })
    .lean();

  const parts = month.split('-').map(Number);
  const yearPart = parts[0] ?? 2026;
  const monthPart = parts[1] ?? 1;
  const curDate = new Date(yearPart, monthPart - 1, 1);
  const prevDate = new Date(curDate.getFullYear(), curDate.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const leftEmployees = await MasterRoll.find({
    firm_id: user.firm_id,
    $or: [
      { date_of_exit: { $regex: new RegExp(`^${prevMonth}`) } },
      { date_of_exit: { $regex: new RegExp(`^${month}`) } }
    ]
  }).sort({ employee_name: 1 }).lean();

  const activeEmpIds = new Set(wages.map((w: any) => w.master_roll_id?._id?.toString()).filter(Boolean));
  const uniqueLeftEmployees = leftEmployees.filter((emp: any) => !activeEmpIds.has(emp._id.toString()));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('EPF-ESIC Report', {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'S.No', key: 'sno', width: 7 },
    { header: 'Employee Name', key: 'name', width: 26 },
    { header: 'Project', key: 'project', width: 20 },
    { header: 'Site', key: 'site', width: 20 },
    { header: 'Date of Joining', key: 'doj', width: 16 },
    { header: 'Date of Exit', key: 'doe', width: 16 },
    { header: 'Aadhar', key: 'aadhar', width: 18 },
    { header: 'Account Number', key: 'acc', width: 22 },
    { header: 'Wage Days', key: 'wage_days', width: 12 },
    { header: 'Wage Rate', key: 'wage_rate', width: 15 },
    { header: 'Gross Salary', key: 'gross', width: 16 },
    { header: 'EPF (12%)', key: 'epf', width: 16 },
    { header: 'ESIC (0.75%)', key: 'esic', width: 16 },
    { header: 'Emp. Statutory', key: 'stat', width: 16 },
    { header: 'Employer EPF (12%)', key: 'employer_epf', width: 18 },
    { header: 'Employer ESIC (3.25%)', key: 'employer_esic', width: 20 },
    { header: 'Total Employer', key: 'total_employer', width: 18 },
    { header: 'Total Contribution', key: 'grand_total', width: 18 },
    { header: 'Net Salary', key: 'net', width: 16 },
    { header: 'Paid Date', key: 'date', width: 14 },
  ];

  const colCount = worksheet.columns.length;

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  const centerCols = new Set([1, 5, 6, 7, 20]); // sno, doj, doe, aadhar, date
  const numberCols = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]); // days, rate, gross, statutory, net

  // 1. Header Styling - STRICTLY ONLY Columns 1 to colCount (stops infinite header color)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  for (let c = 1; c <= colCount; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = borderStyle;
  }

  let totalWageDays = 0;
  let totalGross = 0;
  let totalEpf = 0;
  let totalEsic = 0;
  let totalStat = 0;
  let totalEmployerEpf = 0;
  let totalEmployerEsic = 0;
  let totalTotalEmployer = 0;
  let totalGrandTotal = 0;
  let totalNet = 0;

  // 2. Active / Wage Rows
  wages.forEach((wage: any, index: number) => {
    const epf = wage.epf_deduction || 0;
    const esic = wage.esic_deduction || 0;
    const gross = wage.gross_salary || 0;
    const mr = wage.master_roll_id;

    const dojYmd = toYmd(mr?.date_of_joining);
    const doeYmd = toYmd(mr?.date_of_exit);

    const isExitInCurrent = Boolean(doeYmd && doeYmd.startsWith(month));
    const isExitInPrev = Boolean(doeYmd && doeYmd.startsWith(prevMonth));
    const isExitEmployee = isExitInCurrent || isExitInPrev || mr?.status === 'Left' || mr?.status === 'Exited' || Boolean(doeYmd && doeYmd <= `${month}-31`);

    const isNewJoining = !isExitEmployee && Boolean(dojYmd && dojYmd.startsWith(month));

    const joiningDisplay = isNewJoining ? formatDateDisplay(mr?.date_of_joining) : '';
    const exitDisplay = (isExitEmployee && mr?.date_of_exit) ? formatDateDisplay(mr.date_of_exit) : '';

    const employerEpf = epf;
    const employerEsic = computeEmployerEsic(gross, wage.salary_month || month, mr?.date_of_exit);
    const totalEmployer = employerEpf + employerEsic;
    const grandTotal = (epf + esic) + totalEmployer;

    totalWageDays += Number(wage.wage_days || 0);
    totalGross += gross;
    totalEpf += epf;
    totalEsic += esic;
    totalStat += (epf + esic);
    totalEmployerEpf += employerEpf;
    totalEmployerEsic += employerEsic;
    totalTotalEmployer += totalEmployer;
    totalGrandTotal += grandTotal;
    totalNet += Number(wage.net_salary || 0);

    const row = worksheet.addRow({
      sno: index + 1,
      name: mr?.employee_name || 'N/A',
      project: mr?.project || wage.project || '',
      site: mr?.site || wage.site || '',
      doj: joiningDisplay,
      doe: exitDisplay,
      aadhar: mr?.aadhar || '',
      acc: mr?.account_no || '',
      wage_days: wage.wage_days || 0,
      wage_rate: wage.p_day_wage || mr?.p_day_wage || 0,
      gross: gross,
      epf: epf,
      esic: esic,
      stat: epf + esic,
      employer_epf: employerEpf,
      employer_esic: employerEsic,
      total_employer: totalEmployer,
      grand_total: grandTotal,
      net: wage.net_salary || 0,
      date: formatDateDisplay(wage.paid_date),
    });

    row.height = 21;

    // Determine row colors: Green for new joining, Red for exit, Zebra for regular
    let rowBgArgb = (index % 2 === 1) ? 'FFF8FAFC' : 'FFFFFFFF';
    let rowTextArgb = 'FF1E293B';
    let isBold = false;

    if (isExitEmployee) {
      rowBgArgb = 'FFFEE2E2'; // Soft pastel red
      rowTextArgb = 'FF991B1B'; // Deep red text
      isBold = true;
    } else if (isNewJoining) {
      rowBgArgb = 'FFDCFCE7'; // Soft pastel green
      rowTextArgb = 'FF166534'; // Deep green text
      isBold = true;
    }

    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.border = borderStyle;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBgArgb }
      };
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: isBold,
        color: { argb: rowTextArgb }
      };

      if (centerCols.has(c)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (numberCols.has(c)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = (c === 9) ? '#,##0.0' : '#,##0.00';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      if (c === 8) {
        cell.numFmt = '@';
      }
    }
  });

  // 3. Unique Exited Employees (Zero wage rows - Must be RED)
  let nextSno = wages.length + 1;
  uniqueLeftEmployees.forEach((mr: any) => {
    const exitDisplay = mr.date_of_exit ? formatDateDisplay(mr.date_of_exit) : '';

    const row = worksheet.addRow({
      sno: nextSno++,
      name: mr.employee_name || 'N/A',
      project: mr.project || '',
      site: mr.site || '',
      doj: '',
      doe: exitDisplay,
      aadhar: mr.aadhar || '',
      acc: mr.account_no || '',
      wage_days: 0,
      wage_rate: mr.p_day_wage || 0,
      gross: 0,
      epf: 0,
      esic: 0,
      stat: 0,
      employer_epf: 0,
      employer_esic: 0,
      total_employer: 0,
      grand_total: 0,
      net: 0,
      date: '',
    });

    row.height = 21;

    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.border = borderStyle;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' } // Soft pastel red
      };
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: 'FF991B1B' } // Deep red text
      };

      if (centerCols.has(c)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (numberCols.has(c)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = (c === 9) ? '#,##0.0' : '#,##0.00';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      if (c === 8) {
        cell.numFmt = '@';
      }
    }
  });

  // 4. Totals Row
  const totalRow = worksheet.addRow({
    sno: '',
    name: 'TOTALS',
    project: '',
    site: '',
    doj: '',
    doe: '',
    aadhar: '',
    acc: '',
    wage_days: totalWageDays,
    wage_rate: '',
    gross: totalGross,
    epf: totalEpf,
    esic: totalEsic,
    stat: totalStat,
    employer_epf: totalEmployerEpf,
    employer_esic: totalEmployerEsic,
    total_employer: totalTotalEmployer,
    grand_total: totalGrandTotal,
    net: totalNet,
    date: ''
  });

  totalRow.height = 24;

  const totalBorderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'double', color: { argb: 'FF334155' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  for (let c = 1; c <= colCount; c++) {
    const cell = totalRow.getCell(c);
    cell.border = totalBorderStyle;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF0F172A' }
    };

    if (centerCols.has(c)) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (numberCols.has(c)) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = (c === 9) ? '#,##0.0' : '#,##0.00';
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  }

  // =========================================================================
  // SHEET 2: NEW JOININGS MASTER ROLL (Statutory KYC & EPFO/ESIC Registration)
  // =========================================================================
  const newJoinerIdSet = new Set<string>();

  // 1. Identify from wages records for this month
  wages.forEach((w: any) => {
    const mr = w.master_roll_id;
    const dojYmd = toYmd(mr?.date_of_joining);
    const doeYmd = toYmd(mr?.date_of_exit);
    const isExit = Boolean(
      (doeYmd && (doeYmd.startsWith(month) || doeYmd.startsWith(prevMonth) || doeYmd <= `${month}-31`)) ||
      mr?.status === 'Left' ||
      mr?.status === 'Exited'
    );
    if (!isExit && dojYmd && dojYmd.startsWith(month) && mr?._id) {
      newJoinerIdSet.add(mr._id.toString());
    }
  });

  // 2. Query direct MasterRoll records that joined in this month
  const directNewJoiners = await MasterRoll.find({
    firm_id: user.firm_id,
    $or: [
      { date_of_joining: { $regex: new RegExp(`^${month}`) } },
      { date_of_joining: { $regex: new RegExp(`^[0-9]{2}-${String(monthPart).padStart(2, '0')}-${yearPart}`) } }
    ]
  }).lean();

  directNewJoiners.forEach((emp: any) => {
    const doeYmd = toYmd(emp.date_of_exit);
    const isExit = Boolean(
      (doeYmd && (doeYmd.startsWith(month) || doeYmd.startsWith(prevMonth) || doeYmd <= `${month}-31`)) ||
      emp.status === 'Left' ||
      emp.status === 'Exited'
    );
    if (!isExit && emp._id) {
      newJoinerIdSet.add(emp._id.toString());
    }
  });

  const newJoiningEmployees = await MasterRoll.find({
    _id: { $in: Array.from(newJoinerIdSet) }
  }).sort({ employee_name: 1 }).lean();

  const worksheet2 = workbook.addWorksheet('New Joinings', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: 'FF16A34A' } }
  });

  worksheet2.columns = [
    { header: 'S.No', key: 'sno', width: 7 },
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Father / Husband Name', key: 'father_husband_name', width: 24 },
    { header: 'DOB', key: 'dob', width: 14 },
    { header: 'Date of Joining', key: 'doj', width: 16 },
    { header: 'Category', key: 'category', width: 15 },
    { header: 'Daily Wage', key: 'wage_rate', width: 14 },
    { header: 'Project', key: 'project', width: 20 },
    { header: 'Site', key: 'site', width: 20 },
    { header: 'Aadhar Number', key: 'aadhar', width: 18 },
    { header: 'Phone Number', key: 'phone', width: 16 },
    { header: 'PAN Number', key: 'pan', width: 16 },
    { header: 'UAN', key: 'uan', width: 18 },
    { header: 'ESIC IP No', key: 'esic_no', width: 18 },
    { header: 'Bank Name', key: 'bank', width: 20 },
    { header: 'Account Number', key: 'acc', width: 22 },
    { header: 'IFSC Code', key: 'ifsc', width: 16 },
    { header: 'Branch', key: 'branch', width: 18 },
    { header: 'Present Address', key: 'address', width: 35 },
    { header: 'Status', key: 'status', width: 12 },
  ];

  const colCount2 = worksheet2.columns.length;

  // Header Styling for Sheet 2 (Deep Emerald / Forest Green)
  const headerRow2 = worksheet2.getRow(1);
  headerRow2.height = 28;
  for (let c = 1; c <= colCount2; c++) {
    const cell = headerRow2.getCell(c);
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF166534' } // Forest Green
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = borderStyle;
  }

  const centerCols2 = new Set([1, 4, 5, 6, 10, 11, 12, 13, 14, 17, 20]); // sno, dob, doj, category, aadhar, phone, pan, uan, esic, ifsc, status

  if (newJoiningEmployees.length === 0) {
    const emptyRow = worksheet2.addRow({
      sno: '-',
      name: 'No new joining employees recorded for this salary month.',
    });
    emptyRow.height = 24;
    for (let c = 1; c <= colCount2; c++) {
      const cell = emptyRow.getCell(c);
      cell.border = borderStyle;
      cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
      cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'center' };
    }
  } else {
    newJoiningEmployees.forEach((emp: any, index: number) => {
      const row = worksheet2.addRow({
        sno: index + 1,
        name: emp.employee_name || 'N/A',
        father_husband_name: emp.father_husband_name || '',
        dob: formatDateDisplay(emp.date_of_birth),
        doj: formatDateDisplay(emp.date_of_joining),
        category: emp.category || 'UNSKILLED',
        wage_rate: typeof emp.p_day_wage === 'number' ? emp.p_day_wage : 0,
        project: emp.project || '',
        site: emp.site || '',
        aadhar: emp.aadhar ? String(emp.aadhar) : '',
        phone: emp.phone_no ? String(emp.phone_no) : '',
        pan: emp.pan ? String(emp.pan) : '',
        uan: emp.uan ? String(emp.uan) : '',
        esic_no: emp.esic_no ? String(emp.esic_no) : '',
        bank: emp.bank || '',
        acc: emp.account_no ? String(emp.account_no) : '',
        ifsc: emp.ifsc ? String(emp.ifsc) : '',
        branch: emp.branch || '',
        address: emp.address || '',
        status: emp.status || 'Active',
      });

      row.height = 21;

      // Soft light green zebra tint
      const rowBgColor = (index % 2 === 1) ? 'FFF0FDF4' : 'FFFFFFFF';

      for (let c = 1; c <= colCount2; c++) {
        const cell = row.getCell(c);
        cell.border = borderStyle;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor }
        };
        cell.font = {
          name: 'Calibri',
          size: 10,
          color: { argb: 'FF14532D' }
        };

        if (centerCols2.has(c)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (c === 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        // Text formatting for ID and account columns
        if (c === 10 || c === 11 || c === 12 || c === 13 || c === 14 || c === 16 || c === 17) {
          cell.numFmt = '@';
        }
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="EPF_ESIC_Report_${month.replace(/[^a-zA-Z0-9-]/g, '')}.xlsx"`
  });

  return buffer;
});
