import ExcelJS from 'exceljs';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

function toYmd(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString().split('T')[0] || '';
  }
  if (typeof val === 'string') {
    return val.split('T')[0] || '';
  }
  return '';
}

function formatDate(date: any): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const body = await readBody(event);
  const { month, data: rawData } = body;

  const Firm = (await import('../../models/Firm')).default;
  const firm = await Firm.findById(user.firm_id).lean();

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payroll Statement', {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { key: 'sno', width: 6 },
    { key: 'name', width: 30 },
    { key: 'project', width: 20 },
    { key: 'site', width: 20 },
    { key: 'doj', width: 16 },
    { key: 'doe', width: 16 },
    { key: 'bank', width: 38 },
    { key: 'rate', width: 12 },
    { key: 'days', width: 10 },
    { key: 'gross', width: 16 },
    { key: 'epf', width: 14 },
    { key: 'esic', width: 14 },
    { key: 'other_ded', width: 14 },
    { key: 'other_ben', width: 14 },
    { key: 'adv', width: 14 },
    { key: 'net', width: 16 }
  ];

  const bannerGradient: any = {
    type: 'gradient',
    gradient: 'angle',
    degree: 0,
    stops: [
      { position: 0, color: { argb: 'FF0D9488' } },    // Teal / Green
      { position: 0.25, color: { argb: 'FF2563EB' } }, // Blue
      { position: 0.55, color: { argb: 'FF7C3AED' } }, // Purple
      { position: 0.8, color: { argb: 'FFC026D3' } },  // Magenta
      { position: 1, color: { argb: 'FFE11D48' } }     // Coral / Red
    ]
  };

  const headerStyle: any = {
    font: { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 9.5 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FF374151' } },
      left: { style: 'thin', color: { argb: 'FF374151' } },
      bottom: { style: 'thin', color: { argb: 'FF374151' } },
      right: { style: 'thin', color: { argb: 'FF374151' } }
    }
  };

  const borderStyle: any = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
  };

  // Row 1: Company Name Banner
  const companyName = ((firm as any)?.name || 'PRAKASH ENTERPRISE').toUpperCase();
  worksheet.insertRow(1, [companyName]);
  worksheet.mergeCells('A1:P1');
  const titleRow = worksheet.getRow(1);
  titleRow.height = 34;
  for (let c = 1; c <= 16; c++) {
    titleRow.getCell(c).fill = bannerGradient;
  }
  const titleCell = worksheet.getCell('A1');
  titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 2: Payroll Statement Subtitle Banner
  worksheet.insertRow(2, [`PAYROLL STATEMENT FOR ${month || ''}`]);
  worksheet.mergeCells('A2:P2');
  const subtitleRow = worksheet.getRow(2);
  subtitleRow.height = 24;
  for (let c = 1; c <= 16; c++) {
    subtitleRow.getCell(c).fill = bannerGradient;
  }
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.font = { name: 'Calibri', bold: true, size: 11.5, color: { argb: 'FFFFFFFF' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 3: Spacer Row
  const spacerRow = worksheet.insertRow(3, []);
  spacerRow.height = 12;

  // Row 4: Column Headers
  const tableHeaderRow = worksheet.getRow(4);
  tableHeaderRow.height = 26;
  const headers = [
    'S.NO', 'EMPLOYEE NAME', 'PROJECT', 'SITE', 'DATE OF JOINING', 'DATE OF EXIT',
    'BANK ACCOUNT', 'RATE', 'DAYS', 'GROSS SALARY', 'EPF (12%)', 'ESIC (0.75%)',
    'OTHER DED', 'OTHER BEN', 'ADVANCE', 'NET SALARY'
  ];
  headers.forEach((h, idx) => {
    const cell = tableHeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.style = headerStyle;
  });

  // Calculate previous month for Date of Exit display logic
  const [year, m] = (month || '').split('-').map(Number);
  const prevDate = new Date(year, m - 2, 1);
  const prevMonth = !isNaN(year) && !isNaN(m)
    ? `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    : '';

  let currentRowIndex = 5;
  const dataList: any[] = Array.isArray(rawData) ? rawData : [];

  let sumGross = 0;
  let sumEpf = 0;
  let sumEsic = 0;
  let sumOtherDed = 0;
  let sumOtherBen = 0;
  let sumAdv = 0;
  let sumNet = 0;

  dataList.forEach((item: any, index: number) => {
    const empName = item.employee_name || item.master_roll_id?.employee_name || 'N/A';
    const project = item.project || item.master_roll_id?.project || '';
    const site = item.site || item.master_roll_id?.site || '';

    const rawDoj = item.date_of_joining || item.master_roll_id?.date_of_joining;
    const rawDoe = item.date_of_exit || item.master_roll_id?.date_of_exit;

    const dojYmd = toYmd(rawDoj);
    const doeYmd = toYmd(rawDoe);

    const joiningDisplay = (dojYmd && month && dojYmd.startsWith(month)) ? formatDate(rawDoj) : '';
    const exitDisplay = (doeYmd && prevMonth && doeYmd.startsWith(prevMonth)) ? formatDate(rawDoe) : '';

    const bankName = (item.bank || item.master_roll_id?.bank || '').trim();
    const accountNo = (item.account_no || item.master_roll_id?.account_no || '').trim();

    let bankAccountStr = '';
    const hasBank = bankName && bankName !== 'N/A';
    const hasAccount = accountNo && accountNo !== 'N/A';
    if (hasBank && hasAccount) {
      bankAccountStr = `${bankName} (A/C ${accountNo})`;
    } else if (hasAccount) {
      bankAccountStr = `A/C ${accountNo}`;
    } else if (hasBank) {
      bankAccountStr = bankName;
    }

    const rate = Number(item.p_day_wage ?? item.rate ?? 0);
    const days = Number(item.wage_days ?? item.days ?? 0);
    const gross = Number(item.gross_salary ?? (rate * days));
    const epf = Number(item.epf_deduction ?? 0);
    const esic = Number(item.esic_deduction ?? 0);
    const otherDed = Number(item.other_deduction ?? 0);
    const otherBen = Number(item.other_benefit ?? 0);
    const adv = Number(item.advance_deduction ?? 0);
    const net = Number(item.net_salary ?? (gross - (epf + esic + otherDed + adv) + otherBen));

    sumGross += gross;
    sumEpf += epf;
    sumEsic += esic;
    sumOtherDed += otherDed;
    sumOtherBen += otherBen;
    sumAdv += adv;
    sumNet += net;

    const row = worksheet.addRow({
      sno: index + 1,
      name: empName,
      project: project,
      site: site,
      doj: joiningDisplay,
      doe: exitDisplay,
      bank: bankAccountStr,
      rate: rate,
      days: days,
      gross: { formula: `H${currentRowIndex}*I${currentRowIndex}`, result: gross },
      epf: epf,
      esic: esic,
      other_ded: otherDed,
      other_ben: otherBen,
      adv: adv,
      net: {
        formula: `J${currentRowIndex}-(K${currentRowIndex}+L${currentRowIndex}+M${currentRowIndex}+O${currentRowIndex})+N${currentRowIndex}`,
        result: net
      }
    });

    row.height = 20;

    const rowFill: any = (index % 2 === 1)
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      : null;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = borderStyle;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } };
      cell.alignment = { vertical: 'middle' };
      if (rowFill) cell.fill = rowFill;

      if (colNumber === 1 || colNumber === 5 || colNumber === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber >= 8) {
        cell.numFmt = '#,##0.00';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    currentRowIndex++;
  });

  // TOTALS Row
  const lastDataRow = currentRowIndex - 1;
  const hasRows = dataList.length > 0;

  const totalRow = worksheet.addRow({
    name: 'TOTALS',
    gross: hasRows ? { formula: `SUM(J5:J${lastDataRow})`, result: sumGross } : 0,
    epf: hasRows ? { formula: `SUM(K5:K${lastDataRow})`, result: sumEpf } : 0,
    esic: hasRows ? { formula: `SUM(L5:L${lastDataRow})`, result: sumEsic } : 0,
    other_ded: hasRows ? { formula: `SUM(M5:M${lastDataRow})`, result: sumOtherDed } : 0,
    other_ben: hasRows ? { formula: `SUM(N5:N${lastDataRow})`, result: sumOtherBen } : 0,
    adv: hasRows ? { formula: `SUM(O5:O${lastDataRow})`, result: sumAdv } : 0,
    net: hasRows ? { formula: `SUM(P5:P${lastDataRow})`, result: sumNet } : 0
  });

  totalRow.height = 24;
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.border = borderStyle;
    cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF000000' } };
    cell.alignment = { vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    if (colNumber === 2) {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    } else if (colNumber >= 10) {
      cell.numFmt = '#,##0.00';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const safeMonth = (month || 'export').replace(/[^a-zA-Z0-9-]/g, '');
  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="Wages_${safeMonth}.xlsx"`
  });

  return buffer;
});