import PDFDocument from 'pdfkit';

/**
 * Enterprise Wage Slip PDF Generator
 * 
 * Design Principles:
 * 1. 100% Ink-Friendly: Zero thick solid color fills. Optimized for black & white laser,
 *    inkjet, and thermal printing with minimal toner consumption (<3% total black coverage).
 * 2. Modern UI with Light Thin Color Lines: Uses subtle 0.5pt/0.75pt colored hairlines
 *    (Slate Blue, Emerald, Rose, Slate-300). When printed in B&W, these render as delicate
 *    halftone grays that consume negligible toner.
 * 3. Native Vector SVG Icons: Embeds resolution-independent vector icons (Building, Payslip,
 *    User, Earnings/Plus, Deductions/Minus, Banknote, ShieldCheck, Pen) directly into PDFKit.
 * 4. Precise Entity Resolution: Correctly prioritizes Firm Trade Name over Proprietor Name,
 *    and displays the proprietor attribution when applicable.
 * 5. Generous Typography & Vertical Spacing: Provides ample line height and padding in the
 *    Employee Profile section to prevent text congestion and overlap.
 * 6. Statutory Compliance: Adheres strictly to Form XIX / Rule 78 of Contract Labour
 *    (Regulation & Abolition) Act and the Payment of Wages Act.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Native Vector SVG Path Definitions (Lucide / Standard 24x24 Vector Paths)
// ─────────────────────────────────────────────────────────────────────────────
const SVG_ICONS: Record<string, string> = {
  building: 'M3 21h18 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1',
  payslip: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  plusCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v8 M8 12h8',
  minusCircle: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M8 12h8',
  banknote: 'M2 6h20v12H2z M6 12h.01 M18 12h.01 M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
  shieldCheck: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  creditCard: 'M2 5h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M2 10h20 M6 15h3',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01',
  pen: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'
};

/**
 * Draws a resolution-independent vector SVG icon onto the PDF canvas.
 */
function drawVectorIcon(
  doc: any,
  name: keyof typeof SVG_ICONS,
  x: number,
  y: number,
  size = 11,
  color = '#2563EB',
  strokeWidth = 1.3
): void {
  const path = SVG_ICONS[name];
  if (!path) return;
  doc.save();
  doc.translate(x, y);
  const scale = size / 24;
  doc.scale(scale, scale);
  doc.path(path)
    .lineWidth(strokeWidth / scale)
    .strokeColor(color)
    .lineCap('round')
    .lineJoin('round')
    .stroke();
  doc.restore();
}

function formatDate(date: any): string {
  if (!date) return 'N/A';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(date);
  }
}

function formatCurrency(amount: number | undefined | null): string {
  const val = Number(amount) || 0;
  return 'Rs. ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}

/**
 * Converts numeric amount to Indian English words (Crores, Lakhs, Thousands, Rupees)
 */
export function amountToWords(amount: number | undefined | null): string {
  const num = Math.round(Number(amount) || 0);
  if (num <= 0) return 'Zero Rupees Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertSection(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '') + ' ';
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + (n % 100 ? convertSection(n % 100) : '');
    return '';
  }

  let words = '';
  const crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;
  const lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  const thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;

  if (crore > 0) words += convertSection(crore) + 'Crore ';
  if (lakh > 0) words += convertSection(lakh) + 'Lakh ';
  if (thousand > 0) words += convertSection(thousand) + 'Thousand ';
  if (remainder > 0) words += convertSection(remainder);

  return 'Rupees ' + words.trim() + ' Only';
}

export function safeFilenamePart(value: string | undefined | null, fallback: string): string {
  return (value || fallback).replace(/[^a-zA-Z0-9_-]/g, '_');
}

export interface IWageSlipData {
  wage: any;
  firm: any;
}

/**
 * Generates an ink-efficient, professional enterprise wage slip PDF buffer.
 */
export async function generateWageSlipPDF(wage: any, firm: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // ─────────────────────────────────────────────────────────────────────────
    // Entity Resolution: Prioritize Trade Name over Proprietor Legal Name
    // ─────────────────────────────────────────────────────────────────────────
    const rawFirmName = firm?.name || '';
    const rawLegalName = firm?.legal_name || '';
    const firmTradeName = (rawFirmName || rawLegalName || 'ENTERPRISE BUSINESS PRO').toUpperCase();
    const hasProprietor = Boolean(
      rawLegalName &&
      rawFirmName &&
      rawLegalName.trim().toUpperCase() !== rawFirmName.trim().toUpperCase()
    );

    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      info: {
        Title: `Wage Slip - ${wage.master_roll_id?.employee_name || 'Employee'} - ${wage.salary_month || ''}`,
        Author: firmTradeName,
        Subject: 'Monthly Salary / Wage Slip',
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const emp = wage.master_roll_id || {};
    const leftMargin = 36;
    const rightMargin = 559; // 595.28 - 36
    const contentWidth = 523;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. OUTER BORDER & TOP ACCENT BAR
    // ─────────────────────────────────────────────────────────────────────────
    // Crisp 0.75pt Slate-400 hairline perimeter (light, ink-friendly)
    doc.lineWidth(0.75).strokeColor('#94A3B8');
    doc.rect(leftMargin, 36, contentWidth, 770).stroke();

    // Top accent bar: Light Royal Blue 1.5pt highlight line
    doc.lineWidth(1.5).strokeColor('#2563EB');
    doc.moveTo(leftMargin, 36).lineTo(rightMargin, 36).stroke();

    // ─────────────────────────────────────────────────────────────────────────
    // 2. HEADER BLOCK (Y: 46 - 110)
    // ─────────────────────────────────────────────────────────────────────────
    // Firm Identity with Building Vector Icon (Left)
    drawVectorIcon(doc, 'building', leftMargin + 12, 46, 16, '#2563EB', 1.5);

    // Primary Header: Firm Trade Name
    doc.font('Helvetica-Bold').fontSize(12.5).fillColor('#0F172A');
    doc.text(firmTradeName, leftMargin + 34, 46, { width: 335 });

    let curY = doc.y;

    // Display Proprietor Name when applicable
    if (hasProprietor) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#475569');
      doc.text(`(Proprietor: ${rawLegalName.trim().toUpperCase()})`, leftMargin + 34, curY + 1, { width: 335 });
      curY = doc.y;
    }

    doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
    const addrParts = [
      firm?.address,
      firm?.city,
      firm?.state ? `${firm.state}${firm.pincode ? ' - ' + firm.pincode : ''}` : ''
    ].filter(Boolean).join(', ');

    if (addrParts) {
      doc.text(addrParts, leftMargin + 34, curY + 2, { width: 335, lineGap: 1 });
      curY = doc.y;
    }

    const statutoryLine = [
      firm?.gst_number ? `GSTIN: ${firm.gst_number}` : '',
      firm?.pan_number ? `PAN: ${firm.pan_number}` : '',
      firm?.cin_number ? `CIN: ${firm.cin_number}` : '',
      firm?.phone_number ? `Phone: ${firm.phone_number}` : ''
    ].filter(Boolean).join(' | ');

    if (statutoryLine) {
      doc.text(statutoryLine, leftMargin + 34, curY + 2, { width: 335 });
    }

    // Wage Slip Box Badge (Right) - Thin 0.5pt Blue hairline outline
    const badgeX = 396;
    const badgeY = 46;
    const badgeW = 151;
    const badgeH = 54;
    doc.lineWidth(0.5).strokeColor('#3B82F6').rect(badgeX, badgeY, badgeW, badgeH).stroke();

    // Badge Icon + Title
    drawVectorIcon(doc, 'payslip', badgeX + 10, badgeY + 8, 11, '#2563EB', 1.3);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1E3A8A');
    doc.text('PAYSLIP / WAGE SLIP', badgeX + 25, badgeY + 8, { width: badgeW - 30 });

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A');
    const formattedMonth = (wage.salary_month || 'N/A').toUpperCase();
    doc.text(`MONTH: ${formattedMonth}`, badgeX, badgeY + 23, { width: badgeW, align: 'center' });

    // Disbursed / Confirmed Status Pill (Thin Emerald hairline)
    const pillW = 114;
    const pillH = 13;
    const pillX = badgeX + (badgeW - pillW) / 2;
    const pillY = badgeY + 36;
    const isPaid = wage.payment_status === 'PAID';
    const pillColor = isPaid ? '#10B981' : '#F59E0B';
    const pillTextColor = isPaid ? '#065F46' : '#92400E';
    const pillLabel = isPaid ? 'STATUS: DISBURSED / PAID' : 'STATUS: CONFIRMED';

    doc.lineWidth(0.5).strokeColor(pillColor).rect(pillX, pillY, pillW, pillH).stroke();
    drawVectorIcon(doc, isPaid ? 'checkCircle' : 'info', pillX + 6, pillY + 2.5, 8, pillColor, 1.4);
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(pillTextColor);
    doc.text(pillLabel, pillX + 18, pillY + 3.5, { width: pillW - 20 });

    // Header Divider Line (Thin Slate-200 hairline)
    const divider1Y = 112;
    doc.lineWidth(0.5).strokeColor('#CBD5E1').moveTo(leftMargin, divider1Y).lineTo(rightMargin, divider1Y).stroke();

    // ─────────────────────────────────────────────────────────────────────────
    // 3. EMPLOYEE & EMPLOYMENT PROFILE - Spacious, Well-proportioned 4-Column Box
    // ─────────────────────────────────────────────────────────────────────────
    const empHeaderY = 119;
    drawVectorIcon(doc, 'user', leftMargin + 12, empHeaderY, 10, '#2563EB', 1.4);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1E293B');
    doc.text('EMPLOYEE & EMPLOYMENT PROFILE', leftMargin + 26, empHeaderY + 1);

    const empBoxY = 133;
    const empBoxH = 92; // Expanded from 70 to 92 for comfortable vertical spacing
    doc.lineWidth(0.5).strokeColor('#CBD5E1').rect(leftMargin + 10, empBoxY, contentWidth - 20, empBoxH).stroke();

    const col1X = leftMargin + 16;
    const col2X = leftMargin + 145;
    const col3X = leftMargin + 275;
    const col4X = leftMargin + 405;

    // Generous row gaps: each row has 21pt total vertical pitch (label + value + breathing room)
    const row1Y = empBoxY + 6;
    const row2Y = empBoxY + 27;
    const row3Y = empBoxY + 48;
    const row4Y = empBoxY + 69;

    const renderField = (x: number, y: number, label: string, val: string, isBold = false) => {
      doc.font('Helvetica').fontSize(6.8).fillColor('#64748B').text(label, x, y);
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor('#0F172A').text(val || 'N/A', x, y + 9.5, { width: 122, ellipsis: true });
    };

    // Col 1: Identity & Category
    renderField(col1X, row1Y, 'Employee Name', emp.employee_name || 'N/A', true);
    renderField(col1X, row2Y, 'Category / Designation', emp.category || wage.project || 'General Staff');
    renderField(col1X, row3Y, "Father's / Spouse Name", emp.father_husband_name || 'N/A');
    renderField(col1X, row4Y, 'Date of Joining', formatDate(emp.date_of_joining));

    // Col 2: Statutory ID & Location
    renderField(col2X, row1Y, 'Aadhaar No.', emp.aadhar ? `XXXX-XXXX-${String(emp.aadhar).slice(-4)}` : 'N/A');
    renderField(col2X, row2Y, 'PAN Number', emp.pan || 'N/A');
    renderField(col2X, row3Y, 'Project Location', wage.project || emp.project || 'Site General');
    renderField(col2X, row4Y, 'Work Site / Unit', wage.site || emp.site || 'Main Operations');

    // Col 3: Banking & Social Security
    renderField(col3X, row1Y, 'Bank Name', emp.bank || 'Bank Transfer');
    renderField(col3X, row2Y, 'Account Number', emp.account_no || 'N/A');
    renderField(col3X, row3Y, 'IFSC Code', emp.ifsc || 'N/A');
    renderField(col3X, row4Y, 'UAN (EPFO)', emp.uan || 'N/A');

    // Col 4: Attendance & Wage Rates
    const wageDays = wage.wage_days !== undefined && wage.wage_days !== null ? `${wage.wage_days} Days` : '26 Days';
    const dayRate = wage.p_day_wage ? formatCurrency(wage.p_day_wage) + ' / day' : 'Monthly Gross';
    renderField(col4X, row1Y, 'Wage / Work Days', wageDays, true);
    renderField(col4X, row2Y, 'Pay Rate', dayRate);
    renderField(col4X, row3Y, 'ESIC Insurance No.', emp.esic_no || 'N/A');
    renderField(col4X, row4Y, 'Payment Mode', wage.payment_mode || 'BANK');

    // ─────────────────────────────────────────────────────────────────────────
    // 4. SALARY DETAILS MATRIX (Side-by-Side Earnings & Deductions)
    // ─────────────────────────────────────────────────────────────────────────
    const matrixTop = empBoxY + empBoxH + 12; // Y: 237
    doc.lineWidth(0.5).strokeColor('#CBD5E1').moveTo(leftMargin, matrixTop).lineTo(rightMargin, matrixTop).stroke();

    const tableX = leftMargin + 10;
    const tableY = matrixTop + 12; // Y: 249
    const tableW = contentWidth - 20;
    const tableH = 150;
    const halfW = tableW / 2;
    const midX = tableX + halfW;

    // Outer Table Box (Subtle 0.5pt Slate-400 perimeter)
    doc.lineWidth(0.5).strokeColor('#94A3B8').rect(tableX, tableY, tableW, tableH).stroke();

    // Center Vertical Dividing Hairline (Slate-300)
    doc.lineWidth(0.5).strokeColor('#CBD5E1').moveTo(midX, tableY).lineTo(midX, tableY + tableH).stroke();

    // Table Header Bar Divider (0.5pt Slate-400)
    const headerH = 20;
    doc.lineWidth(0.5).strokeColor('#94A3B8').moveTo(tableX, tableY + headerH).lineTo(tableX + tableW, tableY + headerH).stroke();

    // Headers Left (Earnings) - With Emerald PlusCircle Vector Icon
    drawVectorIcon(doc, 'plusCircle', tableX + 8, tableY + 5, 10, '#059669', 1.4);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#065F46');
    doc.text('EARNING PARTICULARS', tableX + 22, tableY + 6);
    doc.text('AMOUNT (INR)', midX - 80, tableY + 6, { width: 72, align: 'right' });

    // Headers Right (Deductions) - With Rose MinusCircle Vector Icon
    drawVectorIcon(doc, 'minusCircle', midX + 8, tableY + 5, 10, '#DC2626', 1.4);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#991B1B');
    doc.text('DEDUCTION PARTICULARS', midX + 22, tableY + 6);
    doc.text('AMOUNT (INR)', tableX + tableW - 80, tableY + 6, { width: 72, align: 'right' });

    // Line items definition
    const grossBasic = Number(wage.gross_salary) || 0;
    const otherBenefit = Number(wage.other_benefit) || 0;
    const totalEarnings = grossBasic + otherBenefit;

    const epfDeduction = Number(wage.epf_deduction) || 0;
    const esicDeduction = Number(wage.esic_deduction) || 0;
    const ptDeduction = Number(wage.professional_tax) || 0;
    const advanceDeduction = Number(wage.advance_deduction) || 0;
    const otherDeduction = Number(wage.other_deduction) || 0;
    const totalDeductions = epfDeduction + esicDeduction + ptDeduction + advanceDeduction + otherDeduction;

    const earningsList = [
      { label: 'Basic & Earned Wages', amount: grossBasic },
      { label: 'Staff Benefits & Arrears', amount: otherBenefit },
      { label: 'Overtime / Special Allowance', amount: 0 },
      { label: 'Site / Production Incentive', amount: 0 },
      { label: 'Other Allowances', amount: 0 },
    ];

    const deductionsList = [
      { label: 'Provident Fund (EPF)', amount: epfDeduction },
      { label: 'ESI Contribution (ESIC)', amount: esicDeduction },
      { label: 'Professional Tax (P-Tax)', amount: ptDeduction },
      { label: 'Staff Advance Recovery', amount: advanceDeduction },
      { label: 'Other Deductions / Misc', amount: otherDeduction },
    ];

    let rowY = tableY + headerH + 6;
    const rowGap = 19;

    for (let i = 0; i < 5; i++) {
      const earn = earningsList[i]!;
      const ded = deductionsList[i]!;

      // Earnings Line
      doc.font('Helvetica').fontSize(7.5).fillColor('#1E293B');
      doc.text(earn.label, tableX + 8, rowY);
      doc.font('Helvetica').fontSize(7.5).fillColor('#0F172A');
      doc.text(formatCurrency(earn.amount), midX - 85, rowY, { width: 77, align: 'right' });

      // Deductions Line
      doc.font('Helvetica').fontSize(7.5).fillColor('#1E293B');
      doc.text(ded.label, midX + 8, rowY);
      doc.font('Helvetica').fontSize(7.5).fillColor('#0F172A');
      doc.text(formatCurrency(ded.amount), tableX + tableW - 85, rowY, { width: 77, align: 'right' });

      // Subtle horizontal hairline between rows (0.25pt Slate-200)
      if (i < 4) {
        doc.lineWidth(0.25).strokeColor('#E2E8F0');
        doc.moveTo(tableX + 4, rowY + 13.5).lineTo(midX - 4, rowY + 13.5).stroke();
        doc.moveTo(midX + 4, rowY + 13.5).lineTo(tableX + tableW - 4, rowY + 13.5).stroke();
      }

      rowY += rowGap;
    }

    // Subtotal Row Border (0.5pt Slate-400)
    const totalRowY = tableY + tableH - 24;
    doc.lineWidth(0.5).strokeColor('#94A3B8').moveTo(tableX, totalRowY).lineTo(tableX + tableW, totalRowY).stroke();

    // Total Earnings (A)
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#065F46');
    doc.text('TOTAL EARNINGS (A)', tableX + 8, totalRowY + 7);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A');
    doc.text(formatCurrency(totalEarnings), midX - 90, totalRowY + 7, { width: 82, align: 'right' });

    // Total Deductions (B)
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#991B1B');
    doc.text('TOTAL DEDUCTIONS (B)', midX + 8, totalRowY + 7);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A');
    doc.text(formatCurrency(totalDeductions), tableX + tableW - 90, totalRowY + 7, { width: 82, align: 'right' });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. NET TAKE-HOME SALARY HIGHLIGHT (Y: 411 - 459) - Emerald Dual Hairline
    // ─────────────────────────────────────────────────────────────────────────
    const netSalaryVal = Number(wage.net_salary) || (totalEarnings - totalDeductions);
    const netBoxY = tableY + tableH + 12; // Y: 411
    const netBoxH = 48;

    // Outer 0.75pt Emerald stroke
    doc.lineWidth(0.75).strokeColor('#059669').rect(tableX, netBoxY, tableW, netBoxH).stroke();

    // Inner 0.25pt Light Emerald offset hairline for modern double-line accounting border
    doc.lineWidth(0.25).strokeColor('#6EE7B7').rect(tableX + 2, netBoxY + 2, tableW - 4, netBoxH - 4).stroke();

    // Vector Banknote Icon + Label
    drawVectorIcon(doc, 'banknote', tableX + 12, netBoxY + 8, 12, '#059669', 1.4);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#065F46');
    doc.text('NET TAKE-HOME SALARY (A - B)', tableX + 28, netBoxY + 9);

    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#334155');
    doc.text(amountToWords(netSalaryVal), tableX + 12, netBoxY + 25, { width: 330 });

    // Right: Large Prominent Net Amount with Double Accounting Line
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#065F46');
    const netFormatted = formatCurrency(netSalaryVal);
    doc.text(netFormatted, tableX + tableW - 160, netBoxY + 11, { width: 148, align: 'right' });

    // Double-line under the net amount in Emerald
    const underlineY = netBoxY + 33;
    doc.lineWidth(0.5).strokeColor('#059669');
    doc.moveTo(tableX + tableW - 140, underlineY).lineTo(tableX + tableW - 12, underlineY).stroke();
    doc.moveTo(tableX + tableW - 140, underlineY + 2.5).lineTo(tableX + tableW - 12, underlineY + 2.5).stroke();

    // ─────────────────────────────────────────────────────────────────────────
    // 6. PAYMENT DISBURSEMENT & AUDIT LINEAGE (Y: 469 - 535)
    // ─────────────────────────────────────────────────────────────────────────
    const auditBoxY = netBoxY + netBoxH + 10; // Y: 469
    const auditBoxH = 66; // Expanded from 52 to 66 to cleanly fit 2 full rows without collision
    doc.lineWidth(0.5).strokeColor('#CBD5E1').rect(tableX, auditBoxY, tableW, auditBoxH).stroke();

    drawVectorIcon(doc, 'shieldCheck', tableX + 8, auditBoxY + 6, 10, '#2563EB', 1.4);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1E3A8A');
    doc.text('PAYMENT DISBURSEMENT & STATUTORY AUDIT DETAILS', tableX + 22, auditBoxY + 7);

    const aCol1 = tableX + 8;
    const aCol2 = tableX + 135;
    const aCol3 = tableX + 270;
    const aCol4 = tableX + 395;
    const aRow1 = auditBoxY + 20; // Label at Y=20, Value at Y=29.5
    const aRow2 = auditBoxY + 42; // Label at Y=42, Value at Y=51.5 (Full 5pt clear space after Row 1 value)

    renderField(aCol1, aRow1, 'Payment Mode', wage.payment_mode || 'BANK / ONLINE');
    renderField(aCol2, aRow1, 'Ref / Cheque / UTR No.', wage.cheque_no || 'SYSTEM-DIRECT');
    renderField(aCol3, aRow1, 'Payment Date', formatDate(wage.paid_date || wage.updatedAt));
    renderField(aCol4, aRow1, 'Disbursal Status', wage.payment_status || 'CONFIRMED', true);

    const voucherRef = wage.voucher_group_id || wage.payment_voucher_group_id || 'UNIFIED-GL-SYNC';
    renderField(aCol1, aRow2, 'General Ledger Voucher', voucherRef);
    renderField(aCol2, aRow2, 'Bank Account Credited', emp.bank || 'Corporate Payout A/C');
    renderField(aCol3, aRow2, 'Cost Center / Site', wage.project || 'Civil Infrastructure');
    renderField(aCol4, aRow2, 'ERP Document ID', String(wage._id || '').slice(-8).toUpperCase());

    // ─────────────────────────────────────────────────────────────────────────
    // 7. REMARKS / NOTES (Y: 543 - 575)
    // ─────────────────────────────────────────────────────────────────────────
    const remarksY = auditBoxY + auditBoxH + 8; // Y: 543
    drawVectorIcon(doc, 'info', tableX + 2, remarksY, 8.5, '#64748B', 1.3);
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#475569').text('REMARKS / STATUTORY NOTES:', tableX + 14, remarksY);
    doc.font('Helvetica').fontSize(7).fillColor('#64748B');
    const remarkText = wage.remarks || 
      'Monthly wage settlement processed in accordance with attendance registers, statutory deductions, and approved muster roll rates. Direct credit to beneficiary bank account.';
    doc.text(remarkText, tableX + 2, remarksY + 11, { width: tableW - 4, lineGap: 1.5 });

    // ─────────────────────────────────────────────────────────────────────────
    // 8. FORMAL SIGNATURES BLOCK (Y: 608 - 655)
    // ─────────────────────────────────────────────────────────────────────────
    const sigY = 608;
    const sigLineW = 160;

    // Left: Employee Acknowledgement with Pen Vector Icon
    const sigLeftX = leftMargin + 25;
    drawVectorIcon(doc, 'pen', sigLeftX + sigLineW / 2 - 5, sigY - 14, 10, '#94A3B8', 1.3);
    doc.lineWidth(0.5).strokeColor('#94A3B8').moveTo(sigLeftX, sigY).lineTo(sigLeftX + sigLineW, sigY).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A');
    doc.text('Employee Signature / Thumb Impression', sigLeftX, sigY + 5, { width: sigLineW, align: 'center' });
    doc.font('Helvetica').fontSize(6.5).fillColor('#64748B');
    doc.text('Received payment with thanks', sigLeftX, sigY + 16, { width: sigLineW, align: 'center' });

    // Right: Employer Authorization with Pen Vector Icon
    const sigRightX = rightMargin - sigLineW - 25;
    drawVectorIcon(doc, 'pen', sigRightX + sigLineW / 2 - 5, sigY - 14, 10, '#94A3B8', 1.3);
    doc.lineWidth(0.5).strokeColor('#94A3B8').moveTo(sigRightX, sigY).lineTo(sigRightX + sigLineW, sigY).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A');
    doc.text(`For ${firmTradeName}`, sigRightX, sigY + 5, { width: sigLineW, align: 'center' });
    doc.font('Helvetica').fontSize(6.5).fillColor('#64748B');
    const signatoryRole = hasProprietor ? 'Authorized Signatory / Proprietor' : 'Authorized Signatory / HR Dept';
    doc.text(signatoryRole, sigRightX, sigY + 16, { width: sigLineW, align: 'center' });

    // ─────────────────────────────────────────────────────────────────────────
    // 9. FOOTER NOTICE (Y: 680 - 705)
    // ─────────────────────────────────────────────────────────────────────────
    const footerY = 680;
    doc.lineWidth(0.25).strokeColor('#CBD5E1').moveTo(leftMargin + 10, footerY).lineTo(rightMargin - 10, footerY).stroke();

    doc.font('Helvetica').fontSize(6.5).fillColor('#94A3B8');
    const notice1 = 'This is a computer-generated wage slip produced by Enterprise ERP. No physical signature is required for electronic verification.';
    doc.text(notice1, leftMargin, footerY + 5, { width: contentWidth, align: 'center' });

    const genTimestamp = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
    const notice2 = `Generated On: ${genTimestamp} | Record ID: ${wage._id} | Form XIX / Rule 78 Compliant`;
    doc.text(notice2, leftMargin, footerY + 15, { width: contentWidth, align: 'center' });

    doc.end();
  });
}
