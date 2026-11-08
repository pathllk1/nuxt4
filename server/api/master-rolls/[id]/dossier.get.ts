import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import MasterRoll, { getEmployeeTenures } from '../../../models/MasterRoll';
import Firm from '../../../models/Firm';
import EmployeeSiteTransfer from '../../../models/EmployeeSiteTransfer';
import { requireAuthSession } from '../../../utils/auth';
import { dejavuVfs } from '../../../utils/accounting/vfs-dejavu-fonts';

/**
 * Enterprise Form A Statutory Register & Comprehensive Employee Dossier
 * 
 * Complies with:
 * 1. Rule 24(1) of the Ease of Compliance to Maintain Registers Central Rules, 2017 (Form A Register of Workers)
 * 2. Section 78 of the Contract Labour (Regulation and Abolition) Act, 1970
 * 3. Modern Enterprise Design: 100% ink-friendly, zero heavy solid color fills, vector SVG icons,
 *    and Trade Name vs Proprietor entity resolution.
 */

const SVG_ICONS: Record<string, string> = {
  building: 'M3 21h18 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  shieldCheck: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  landmark: 'M3 21h18 M3 10h18 M5 10v8 M9 10v8 M13 10v8 M17 10v8 M12 3L2 10h20L12 3z',
  compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
  fileText: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
  pen: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'
};

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

function formatDate(dateVal: any): string {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function calculateAge(dobStr: any): string {
  if (!dobStr) return 'N/A';
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return 'N/A';
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs);
  const years = Math.abs(ageDate.getUTCFullYear() - 1970);
  return `${years} Years`;
}

function formatCurrency(amount: any): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return (
    '\u20B9\u00A0' +
    new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num)
  );
}

function safeFilenamePart(value: string | undefined | null, fallback: string): string {
  return (value || fallback).replace(/[^a-zA-Z0-9_-]/g, '_');
}

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const id = getRouterParam(event, 'id');

    if (!id || !mongoose.isValidObjectId(id)) {
      throw createError({ statusCode: 400, statusMessage: 'Valid employee ID required' });
    }

    const firmObjectId = new mongoose.Types.ObjectId(user.firm_id);
    const empObjectId = new mongoose.Types.ObjectId(id);

    const [employee, firm, recentTransfers] = await Promise.all([
      MasterRoll.findOne({ _id: empObjectId, firm_id: firmObjectId }).lean(),
      Firm.findById(firmObjectId).lean(),
      EmployeeSiteTransfer.find({ master_roll_id: empObjectId, firm_id: firmObjectId, status: 'COMPLETED' })
        .sort({ effective_date: -1 })
        .limit(3)
        .lean()
    ]);

    if (!employee) {
      throw createError({ statusCode: 404, statusMessage: 'Employee not found' });
    }

    // Entity Resolution: Prioritize Trade Name over Proprietor Name
    const rawFirmName = firm?.name || '';
    const rawLegalName = firm?.legal_name || '';
    const firmTradeName = (rawFirmName || rawLegalName || 'ENTERPRISE CONTRACTING SERVICES').toUpperCase();
    const hasProprietor = Boolean(
      rawLegalName &&
      rawFirmName &&
      rawLegalName.trim().toUpperCase() !== rawFirmName.trim().toUpperCase()
    );

    // Build QR verification text
    const qrPayload = [
      `VERIFIED STATUTORY EMPLOYEE DOSSIER`,
      `Firm: ${firmTradeName}`,
      hasProprietor ? `Proprietor: ${rawLegalName.trim()}` : '',
      `Name: ${employee.employee_name || 'N/A'}`,
      `Aadhaar: ${employee.aadhar ? 'XXXX-XXXX-' + String(employee.aadhar).slice(-4) : 'N/A'}`,
      `UAN: ${employee.uan || 'N/A'}`,
      `ESIC: ${employee.esic_no || 'N/A'}`,
      `Station: ${employee.site || 'N/A'} (${employee.project || 'General'})`,
      `Category: ${employee.category || 'Worker'}`,
      `Status: ${employee.status || 'Active'}`,
      `DOJ: ${formatDate(employee.date_of_joining)}`,
      `Ref: DOS/${new Date().getFullYear()}/${String(employee._id).slice(-6).toUpperCase()}`
    ].filter(Boolean).join('\n');

    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      margin: 1,
      scale: 3,
      errorCorrectionLevel: 'M'
    });

    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 0,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: `Statutory Dossier - ${employee.employee_name}`,
          Author: firmTradeName,
          Subject: 'Statutory Employee Profile & Form A Register Record',
          Keywords: 'Dossier, Master Roll, KYC, Form A, Labour Compliance'
        }
      });

      // Register DejaVu Sans fonts from in-memory VFS
      doc.registerFont('DejaVuSans', Buffer.from(dejavuVfs['DejaVuSans.ttf'] || '', 'base64'));
      doc.registerFont('DejaVuSans-Bold', Buffer.from(dejavuVfs['DejaVuSans-Bold.ttf'] || '', 'base64'));
      doc.registerFont('DejaVuSans-Oblique', Buffer.from(dejavuVfs['DejaVuSans-Oblique.ttf'] || '', 'base64'));

      const chunks: any[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PAGE_WIDTH = 595.28;
      const LEFT = 36;
      const RIGHT = PAGE_WIDTH - 36;
      const CONTENT_WIDTH = RIGHT - LEFT; // 523.28 pt

      // ─────────────────────────────────────────────────────────────────────────
      // 1. OUTER BORDER & TOP ACCENT BAR
      // ─────────────────────────────────────────────────────────────────────────
      // Crisp 0.75pt Slate-400 hairline perimeter (light, ink-friendly)
      doc.lineWidth(0.75).strokeColor('#94A3B8');
      doc.rect(LEFT, 28, CONTENT_WIDTH, 786).stroke();

      // Top Royal Blue 1.5pt highlight bar
      doc.lineWidth(1.5).strokeColor('#2563EB');
      doc.moveTo(LEFT, 28).lineTo(RIGHT, 28).stroke();

      // ─────────────────────────────────────────────────────────────────────────
      // 2. HEADER BLOCK (Y: 38 - 100)
      // ─────────────────────────────────────────────────────────────────────────
      drawVectorIcon(doc, 'building', LEFT + 12, 38, 16, '#2563EB', 1.5);

      // Firm Trade Name
      doc.font('DejaVuSans-Bold').fontSize(12).fillColor('#0F172A');
      doc.text(firmTradeName, LEFT + 34, 38, { width: 335 });

      let curY = doc.y;

      // Proprietor attribution
      if (hasProprietor) {
        doc.font('DejaVuSans-Oblique').fontSize(7.5).fillColor('#475569');
        doc.text(`(Proprietor: ${rawLegalName.trim().toUpperCase()})`, LEFT + 34, curY + 1, { width: 335 });
        curY = doc.y;
      }

      // Address & Statutory Line
      doc.font('DejaVuSans').fontSize(7).fillColor('#475569');
      const addrParts = [
        firm?.address,
        firm?.city,
        firm?.state ? `${firm.state}${firm.pincode ? ' - ' + firm.pincode : ''}` : ''
      ].filter(Boolean).join(', ');

      if (addrParts) {
        doc.text(addrParts, LEFT + 34, curY + 2, { width: 335, lineGap: 1 });
        curY = doc.y;
      }

      const statutoryLine = [
        firm?.gst_number ? `GSTIN: ${firm.gst_number}` : '',
        firm?.pan_number ? `PAN: ${firm.pan_number}` : '',
        firm?.cin_number ? `CIN: ${firm.cin_number}` : '',
        firm?.phone_number ? `Phone: ${firm.phone_number}` : ''
      ].filter(Boolean).join(' | ');

      if (statutoryLine) {
        doc.text(statutoryLine, LEFT + 34, curY + 2, { width: 335 });
      }

      // Right Header Badge (Ink-friendly outline box)
      const badgeX = 396;
      const badgeY = 36;
      const badgeW = 151;
      const badgeH = 56;
      doc.lineWidth(0.5).strokeColor('#3B82F6').rect(badgeX, badgeY, badgeW, badgeH).stroke();

      drawVectorIcon(doc, 'fileText', badgeX + 8, badgeY + 8, 11, '#2563EB', 1.3);
      doc.font('DejaVuSans-Bold').fontSize(8.5).fillColor('#1E3A8A');
      doc.text('FORM A STATUTORY REGISTER', badgeX + 22, badgeY + 8, { width: badgeW - 26 });

      doc.font('DejaVuSans').fontSize(6.5).fillColor('#64748B');
      doc.text('[See Rule 24(1) Central Labour Rules]', badgeX, badgeY + 22, { width: badgeW, align: 'center' });

      const refNumber = `REF: DOS/${new Date().getFullYear()}/${String(employee._id).slice(-6).toUpperCase()}`;
      doc.font('DejaVuSans-Bold').fontSize(7).fillColor('#0F172A');
      doc.text(refNumber, badgeX, badgeY + 34, { width: badgeW, align: 'center' });

      // Status Pill
      const isStatusActive = (employee.status || 'Active').toUpperCase() === 'ACTIVE';
      const pillW = 80;
      const pillH = 11;
      const pillX = badgeX + (badgeW - pillW) / 2;
      const pillY = badgeY + 44;
      doc.lineWidth(0.5).strokeColor(isStatusActive ? '#10B981' : '#F43F5E').rect(pillX, pillY, pillW, pillH).stroke();
      doc.font('DejaVuSans-Bold').fontSize(6).fillColor(isStatusActive ? '#065F46' : '#991B1B');
      doc.text(isStatusActive ? 'STATUS: ACTIVE' : 'STATUS: INACTIVE', pillX, pillY + 2, { width: pillW, align: 'center' });

      // Header Divider Line
      const divider1Y = 98;
      doc.lineWidth(0.5).strokeColor('#CBD5E1').moveTo(LEFT, divider1Y).lineTo(RIGHT, divider1Y).stroke();

      // ─────────────────────────────────────────────────────────────────────────
      // 3. EMPLOYEE SNAPSHOT CARD (Highlights | QR Verification | Photo Frame)
      // ─────────────────────────────────────────────────────────────────────────
      curY = 104;
      const cardHeight = 84;
      doc.lineWidth(0.5).strokeColor('#CBD5E1').rect(LEFT + 8, curY, CONTENT_WIDTH - 16, cardHeight).stroke();

      const snapLeft = LEFT + 16;
      let snapY = curY + 8;

      // Employee Name
      drawVectorIcon(doc, 'user', snapLeft, snapY + 1, 12, '#2563EB', 1.4);
      doc.font('DejaVuSans-Bold').fontSize(11).fillColor('#0F172A');
      doc.text(employee.employee_name || 'N/A', snapLeft + 16, snapY, { width: 220, ellipsis: true });

      snapY += 16;

      const renderSnapLine = (label: string, val: string, isBoldVal = false) => {
        doc.font('DejaVuSans-Bold').fontSize(7).fillColor('#64748B').text(label, snapLeft, snapY, { continued: true });
        doc.font(isBoldVal ? 'DejaVuSans-Bold' : 'DejaVuSans').fontSize(7.5).fillColor('#0F172A').text(`  ${val}`);
        snapY += 12;
      };

      renderSnapLine('Designation / Trade:', employee.category || 'Worker');
      renderSnapLine('Current Deployment:', `${employee.site || 'Site A'} (${employee.project || 'General'})`);
      renderSnapLine('Date of Joining:', `${formatDate(employee.date_of_joining)}  •  Card Valid: ${formatDate(employee.card_valid_until)}`);
      renderSnapLine('Base Wage Rate:', `${formatCurrency(employee.p_day_wage)} / day`, true);

      // Right Section: QR Code & Photo Placeholder
      const qrSize = 58;
      const photoWidth = 58;
      const photoHeight = 70;
      const photoX = RIGHT - photoWidth - 14;
      const qrX = photoX - qrSize - 12;

      doc.image(qrBuffer, qrX, curY + 6, { width: qrSize, height: qrSize });
      doc.font('DejaVuSans').fontSize(5.5).fillColor('#64748B').text('Scan to Verify On-Site', qrX, curY + 67, { width: qrSize, align: 'center' });

      doc.rect(photoX, curY + 6, photoWidth, photoHeight).dash(3, { space: 3 }).strokeColor('#94A3B8').lineWidth(0.6).stroke();
      doc.undash();
      doc.font('DejaVuSans')
        .fontSize(5.5)
        .fillColor('#94A3B8')
        .text('AFFIX RECENT\nPASSPORT PHOTO\n(CROSS-SIGNED)', photoX, curY + 24, { width: photoWidth, align: 'center' });

      curY += cardHeight + 8;

      // ─────────────────────────────────────────────────────────────────────────
      // HELPER: Section Header (Ink-safe, vector icon + 0.5pt Slate-300 border)
      // ─────────────────────────────────────────────────────────────────────────
      const drawSectionHeader = (title: string, icon: keyof typeof SVG_ICONS, yPos: number): number => {
        drawVectorIcon(doc, icon, LEFT + 10, yPos + 3, 10, '#2563EB', 1.4);
        doc.font('DejaVuSans-Bold').fontSize(8).fillColor('#1E293B');
        doc.text(title.toUpperCase(), LEFT + 24, yPos + 4);
        doc.lineWidth(0.5).strokeColor('#CBD5E1').moveTo(LEFT + 8, yPos + 16).lineTo(RIGHT - 8, yPos + 16).stroke();
        return yPos + 20;
      };

      // ─────────────────────────────────────────────────────────────────────────
      // HELPER: 2-Column Key-Value Row with Generous Spacing
      // ─────────────────────────────────────────────────────────────────────────
      const drawKeyValueRow = (
        yPos: number,
        col1Label: string, col1Val: any,
        col2Label: string, col2Val: any,
        isAltBg = false
      ): number => {
        const rowHeight = 18;
        const colWidth = (CONTENT_WIDTH - 16) / 2;
        const boxX = LEFT + 8;

        if (isAltBg) {
          doc.save();
          doc.rect(boxX, yPos, CONTENT_WIDTH - 16, rowHeight).fill('#F8FAFC');
          doc.restore();
        }
        doc.lineWidth(0.5).strokeColor('#E2E8F0').rect(boxX, yPos, CONTENT_WIDTH - 16, rowHeight).stroke();

        const v1 = col1Val !== null && col1Val !== undefined && String(col1Val).trim() ? String(col1Val).trim() : '—';
        const v2 = col2Val !== null && col2Val !== undefined && String(col2Val).trim() ? String(col2Val).trim() : '—';

        // Col 1
        doc.font('DejaVuSans-Bold').fontSize(6.8).fillColor('#64748B').text(col1Label, boxX + 6, yPos + 5, { width: 95 });
        doc.font('DejaVuSans').fontSize(7.5).fillColor('#0F172A').text(v1, boxX + 102, yPos + 5, { width: colWidth - 108, ellipsis: true });

        // Divider
        doc.lineWidth(0.5).strokeColor('#E2E8F0').moveTo(boxX + colWidth, yPos).lineTo(boxX + colWidth, yPos + rowHeight).stroke();

        // Col 2
        doc.font('DejaVuSans-Bold').fontSize(6.8).fillColor('#64748B').text(col2Label, boxX + colWidth + 6, yPos + 5, { width: 95 });
        doc.font('DejaVuSans').fontSize(7.5).fillColor('#0F172A').text(v2, boxX + colWidth + 102, yPos + 5, { width: colWidth - 108, ellipsis: true });

        return yPos + rowHeight;
      };

      // ─────────────────────────────────────────────────────────────────────────
      // 4. SECTION 1: PERSONAL & IDENTIFICATION PARTICULARS
      // ─────────────────────────────────────────────────────────────────────────
      curY = drawSectionHeader('1. Personal & Identity Particulars', 'user', curY);
      curY = drawKeyValueRow(curY, "Full Legal Name:", employee.employee_name, "Father / Spouse:", employee.father_husband_name, true);
      curY = drawKeyValueRow(curY, "Date of Birth:", formatDate(employee.date_of_birth), "Calculated Age:", calculateAge(employee.date_of_birth));
      curY = drawKeyValueRow(curY, "Aadhaar Card No:", employee.aadhar ? String(employee.aadhar) : '—', "PAN Number:", employee.pan || '—', true);
      curY = drawKeyValueRow(curY, "Mobile Phone:", employee.phone_no ? String(employee.phone_no) : '—', "Gender / Category:", employee.category || 'Worker');

      // Permanent Address row
      const addrH = 20;
      doc.lineWidth(0.5).strokeColor('#E2E8F0').rect(LEFT + 8, curY, CONTENT_WIDTH - 16, addrH).stroke();
      doc.font('DejaVuSans-Bold').fontSize(6.8).fillColor('#64748B').text("Permanent Address:", LEFT + 14, curY + 5, { width: 95 });
      doc.font('DejaVuSans').fontSize(7.5).fillColor('#0F172A').text(employee.address || '—', LEFT + 110, curY + 5, { width: CONTENT_WIDTH - 128, ellipsis: true });
      curY += addrH + 8;

      // ─────────────────────────────────────────────────────────────────────────
      // 5. SECTION 2: STATUTORY & SOCIAL SECURITY REGISTRATIONS
      // ─────────────────────────────────────────────────────────────────────────
      curY = drawSectionHeader('2. Statutory & Social Security Registrations', 'shieldCheck', curY);
      curY = drawKeyValueRow(curY, "EPFO UAN:", employee.uan ? String(employee.uan) : '—', "ESIC Insurance No:", employee.esic_no ? String(employee.esic_no) : '—', true);
      curY = drawKeyValueRow(curY, "Shram Kalyan No:", employee.s_kalyan_no || '—', "Notice Period:", `${employee.resignation_notice_period ?? 30} Days`);
      curY += 8;

      // ─────────────────────────────────────────────────────────────────────────
      // 6. SECTION 3: BANKING & DIRECT WAGE DISBURSEMENT DETAILS
      // ─────────────────────────────────────────────────────────────────────────
      curY = drawSectionHeader('3. Banking & Direct Wage Disbursement Details', 'landmark', curY);
      curY = drawKeyValueRow(curY, "Bank Name:", employee.bank, "Account Number:", employee.account_no ? String(employee.account_no) : '—', true);
      curY = drawKeyValueRow(curY, "IFSC Code:", employee.ifsc, "Bank Branch:", employee.branch);
      curY += 8;

      // ─────────────────────────────────────────────────────────────────────────
      // 7. SECTION 4: SITE DEPLOYMENT & INTER-SITE MOVEMENT HISTORY
      // ─────────────────────────────────────────────────────────────────────────
      curY = drawSectionHeader('4. Site Deployment & Movement History', 'compass', curY);
      const allTenures = getEmployeeTenures(employee);
      if (allTenures.length > 1) {
        allTenures.slice(0, -1).forEach((t: any) => {
          const tPeriod = `${formatDate(t.date_of_joining)} to ${formatDate(t.date_of_exit)}`;
          const tDeploy = `${t.project || 'General'} / ${t.site || 'Base'} • ${t.category} (₹${t.p_day_wage}/day)`;
          curY = drawKeyValueRow(curY, `Tenure #${t.tenure_no} (Past):`, tPeriod, "Assignment:", tDeploy, true);
        });
      }
      if (recentTransfers && recentTransfers.length > 0) {
        recentTransfers.forEach((tr: any, idx: number) => {
          const moveRoute = `${tr.from_site || 'Initial'} -> ${tr.to_site} (${tr.transfer_type || 'Permanent'})`;
          const moveMeta = `Effective: ${formatDate(tr.effective_date)} | Ref: ${tr.transfer_order_no || 'Standard'}`;
          curY = drawKeyValueRow(curY, `Transfer #${idx + 1}:`, moveRoute, "Effective / Ref:", moveMeta, idx % 2 === 0);
        });
      } else {
        curY = drawKeyValueRow(curY, "Deployment Status:", `Stationed at ${employee.site || 'Site A'} since ${formatDate(employee.date_of_joining)}`, "Movement Records:", "No inter-site movements on record", true);
      }
      curY += 8;

      // Exit details if left
      if (employee.date_of_exit) {
        curY = drawSectionHeader('5. Separation & Exit Details', 'fileText', curY);
        curY = drawKeyValueRow(curY, "Date of Exit:", formatDate(employee.date_of_exit), "Reason for Leaving:", employee.doe_rem || 'Resigned', true);
        curY += 8;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // 8. STATUTORY DECLARATION & ATTESTATION
      // ─────────────────────────────────────────────────────────────────────────
      curY = drawSectionHeader('5. Statutory Declaration & Attestation', 'fileText', curY);

      const declH = 22;
      doc.lineWidth(0.5).strokeColor('#CBD5E1').rect(LEFT + 8, curY, CONTENT_WIDTH - 16, declH).stroke();
      doc.font('DejaVuSans-Oblique')
        .fontSize(6.5)
        .fillColor('#475569')
        .text(
          'I hereby declare that all particulars furnished above are true and correct to the best of my knowledge and belief. I agree to abide by all safety, site discipline, and labour welfare rules established under the Contract Labour (R&A) Act, 1970 and Code on Wages.',
          LEFT + 14,
          curY + 4,
          { width: CONTENT_WIDTH - 28, lineGap: 1.5 }
        );
      curY += declH + 8;

      // ─────────────────────────────────────────────────────────────────────────
      // 9. FORMAL THREE-TIER SIGNATURE & INSPECTION BLOCK
      // ─────────────────────────────────────────────────────────────────────────
      const sigBoxW = (CONTENT_WIDTH - 24) / 3;
      const sigBoxH = 50;

      // Box 1: Employee Signature
      const b1X = LEFT + 8;
      doc.lineWidth(0.5).strokeColor('#CBD5E1').rect(b1X, curY, sigBoxW, sigBoxH).stroke();
      drawVectorIcon(doc, 'pen', b1X + sigBoxW / 2 - 5, curY + 6, 9, '#94A3B8', 1.3);
      doc.lineWidth(0.5).strokeColor('#CBD5E1').moveTo(b1X + 10, curY + 34).lineTo(b1X + sigBoxW - 10, curY + 34).stroke();
      doc.font('DejaVuSans-Bold').fontSize(6.5).fillColor('#0F172A').text("Employee Signature / Thumb", b1X + 4, curY + 38, { width: sigBoxW - 8, align: 'center' });

      // Box 2: Employer Authorized Signatory
      const b2X = b1X + sigBoxW + 4;
      doc.lineWidth(0.5).strokeColor('#CBD5E1').rect(b2X, curY, sigBoxW, sigBoxH).stroke();
      drawVectorIcon(doc, 'pen', b2X + sigBoxW / 2 - 5, curY + 6, 9, '#94A3B8', 1.3);
      doc.lineWidth(0.5).strokeColor('#CBD5E1').moveTo(b2X + 10, curY + 34).lineTo(b2X + sigBoxW - 10, curY + 34).stroke();
      const signatoryRole = hasProprietor ? 'Authorized Signatory / Proprietor' : 'Authorized Signatory / HR Dept';
      doc.font('DejaVuSans-Bold').fontSize(6.5).fillColor('#0F172A').text(`For ${firmTradeName}`, b2X + 4, curY + 36, { width: sigBoxW - 8, align: 'center', ellipsis: true });
      doc.font('DejaVuSans').fontSize(5.5).fillColor('#64748B').text(signatoryRole, b2X + 4, curY + 43, { width: sigBoxW - 8, align: 'center' });

      // Box 3: Statutory Labour Inspector Verification Box
      const b3X = b2X + sigBoxW + 4;
      doc.lineWidth(0.5).strokeColor('#CBD5E1').rect(b3X, curY, sigBoxW, sigBoxH).stroke();
      drawVectorIcon(doc, 'shieldCheck', b3X + sigBoxW / 2 - 5, curY + 6, 9, '#2563EB', 1.3);
      doc.lineWidth(0.5).strokeColor('#CBD5E1').moveTo(b3X + 10, curY + 34).lineTo(b3X + sigBoxW - 10, curY + 34).stroke();
      doc.font('DejaVuSans-Bold').fontSize(6.5).fillColor('#0F172A').text("Labour Inspector / Auditor", b3X + 4, curY + 36, { width: sigBoxW - 8, align: 'center' });
      doc.font('DejaVuSans').fontSize(5.5).fillColor('#64748B').text("Official Inspection Stamp", b3X + 4, curY + 43, { width: sigBoxW - 8, align: 'center' });

      // ─────────────────────────────────────────────────────────────────────────
      // 10. BOTTOM FOOTER - Strictly anchored on Single Page 1
      // ─────────────────────────────────────────────────────────────────────────
      const footerY = 792;
      doc.lineWidth(0.5).strokeColor('#CBD5E1').moveTo(LEFT, footerY).lineTo(RIGHT, footerY).stroke();

      const genTime = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      doc.font('DejaVuSans')
        .fontSize(6)
        .fillColor('#94A3B8')
        .text(`Confidential Master Roll Dossier  •  Generated: ${genTime}  •  Form A Register Rule 24(1) Compliant`, LEFT + 8, footerY + 5, {
          lineBreak: false
        });

      doc.font('DejaVuSans')
        .fontSize(6)
        .fillColor('#94A3B8')
        .text(`Page 1 of 1`, LEFT, footerY + 5, {
          width: CONTENT_WIDTH - 8,
          align: 'right',
          lineBreak: false
        });

      doc.end();
    });

    const cleanName = safeFilenamePart(employee.employee_name, 'Employee');
    const filename = `Employee_Dossier_${cleanName}.pdf`;

    setResponseHeader(event, 'Content-Type', 'application/pdf');
    setResponseHeader(event, 'Content-Disposition', `inline; filename="${filename}"`);

    return pdfBuffer;
  } catch (error: any) {
    console.error('Generate employee dossier error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error generating employee dossier'
    });
  }
});
