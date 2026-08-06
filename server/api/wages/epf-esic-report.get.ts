import ExcelJS from 'exceljs';
import Wage from '../../models/Wage';
import MasterRoll from '../../models/MasterRoll';
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

  if (!month) {
    throw createError({
      statusCode: 400,
      message: 'Month query parameter is required'
    });
  }

  const wages = await Wage.find({ firm_id: user.firm_id, salary_month: month })
    .populate('master_roll_id', 'employee_name aadhar bank account_no project site date_of_joining date_of_exit p_day_wage')
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
    date_of_exit: { $regex: new RegExp(`^${prevMonth}`) }
  }).sort({ employee_name: 1 }).lean();

  const activeEmpIds = new Set(wages.map((w: any) => w.master_roll_id?._id?.toString()).filter(Boolean));
  const uniqueLeftEmployees = leftEmployees.filter((emp: any) => !activeEmpIds.has(emp._id.toString()));

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('EPF-ESIC Report');

  worksheet.columns = [
    { header: 'S.No', key: 'sno', width: 8 },
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Project', key: 'project', width: 20 },
    { header: 'Site', key: 'site', width: 20 },
    { header: 'Date of Joining', key: 'doj', width: 15 },
    { header: 'Date of Exit', key: 'doe', width: 15 },
    { header: 'Aadhar', key: 'aadhar', width: 15 },
    { header: 'Account Number', key: 'acc', width: 20 },
    { header: 'Wage Days', key: 'wage_days', width: 12 },
    { header: 'Wage Rate', key: 'wage_rate', width: 15 },
    { header: 'Gross Salary', key: 'gross', width: 15 },
    { header: 'EPF (12%)', key: 'epf', width: 18 },
    { header: 'ESIC (0.75%)', key: 'esic', width: 18 },
    { header: 'Emp. Statutory', key: 'stat', width: 18 },
    { header: 'Employer EPF (12%)', key: 'employer_epf', width: 18 },
    { header: 'Employer ESIC (3.25%)', key: 'employer_esic', width: 20 },
    { header: 'Total Employer', key: 'total_employer', width: 18 },
    { header: 'Total Contribution', key: 'grand_total', width: 18 },
    { header: 'Net Salary', key: 'net', width: 15 },
    { header: 'Paid Date', key: 'date', width: 12 },
  ];

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }
  };

  wages.forEach((wage: any, index: number) => {
    const epf = wage.epf_deduction || 0;
    const esic = wage.esic_deduction || 0;
    const gross = wage.gross_salary || 0;
    const mr = wage.master_roll_id;

    const joiningDisplay = (mr?.date_of_joining && mr.date_of_joining.startsWith(month)) ? mr.date_of_joining : '';
    const exitDisplay = (mr?.date_of_exit && mr.date_of_exit.startsWith(prevMonth)) ? mr.date_of_exit : '';

    const employerEpf = epf;
    const employerEsic = Math.ceil(gross * 0.0325);
    const totalEmployer = employerEpf + employerEsic;
    const grandTotal = (epf + esic) + totalEmployer;

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
      date: formatDate(wage.paid_date),
    });

    row.getCell('acc').numFmt = '@';
    ['wage_rate', 'gross', 'epf', 'esic', 'stat', 'employer_epf', 'employer_esic', 'total_employer', 'grand_total', 'net'].forEach(key => {
      row.getCell(key).numFmt = '#,##0.00';
    });
  });

  let nextSno = wages.length + 1;
  uniqueLeftEmployees.forEach((mr: any) => {
    const exitDisplay = (mr.date_of_exit && mr.date_of_exit.startsWith(prevMonth)) ? mr.date_of_exit : '';

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

    row.getCell('acc').numFmt = '@';
    ['wage_rate', 'gross', 'epf', 'esic', 'stat', 'employer_epf', 'employer_esic', 'total_employer', 'grand_total', 'net'].forEach(key => {
      row.getCell(key).numFmt = '#,##0.00';
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="EPF_ESIC_Report_${month.replace(/[^a-zA-Z0-9-]/g, '')}.xlsx"`
  });

  return buffer;
});