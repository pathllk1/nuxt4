import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import MasterRoll, { getEmployeeTenures } from '../../../models/MasterRoll';
import Firm from '../../../models/Firm';
import EmployeeSiteTransfer from '../../../models/EmployeeSiteTransfer';
import { requireAuthSession } from '../../../utils/auth';
import { dejavuVfs } from '../../../utils/accounting/vfs-dejavu-fonts';

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

// Consistent with Bill PDF formatting in server/utils/accounting/pdf-export.utils.ts
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

    // Build QR verification text
    const qrPayload = [
      `VERIFIED EMPLOYEE DOSSIER`,
      `Firm: ${firm?.name || 'Company'}`,
      `Name: ${employee.employee_name || 'N/A'}`,
      `Aadhaar: ${employee.aadhar ? 'XXXX-XXXX-' + String(employee.aadhar).slice(-4) : 'N/A'}`,
      `UAN: ${employee.uan || 'N/A'}`,
      `ESIC: ${employee.esic_no || 'N/A'}`,
      `Station: ${employee.site || 'N/A'} (${employee.project || 'General'})`,
      `Category: ${employee.category || 'Worker'}`,
      `Status: ${employee.status || 'Active'}`,
      `DOJ: ${formatDate(employee.date_of_joining)}`,
      `Ref: DOS/${new Date().getFullYear()}/${String(employee._id).slice(-6).toUpperCase()}`
    ].join('\n');

    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      margin: 1,
      scale: 3,
      errorCorrectionLevel: 'M'
    });

    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      // Set margin: 0 to prevent automatic page break overflow on bottom footer
      const doc = new PDFDocument({
        margin: 0,
        size: 'A4',
        bufferPages: true,
        info: {
          Title: `Employee Dossier - ${employee.employee_name}`,
          Author: firm?.name || 'Enterprise ERP',
          Subject: 'Statutory Employee Profile & Form A Register Record',
          Keywords: 'Dossier, Master Roll, KYC, Labour Compliance'
        }
      });

      // Register DejaVu Sans fonts from in-memory VFS (matches Bill PDF for crisp INR symbol and Unicode fidelity)
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

      // 1. TOP HEADER & FIRM LETTERHEAD
      doc.save();
      doc.rect(LEFT, 30, CONTENT_WIDTH, 46).fill('#0F172A'); // Slate-900 banner

      doc.fillColor('#FFFFFF')
        .font('DejaVuSans-Bold')
        .fontSize(13)
        .text((firm?.name || 'ENTERPRISE CONTRACTING & SERVICES').toUpperCase(), LEFT + 12, 36, {
          width: CONTENT_WIDTH - 24,
          ellipsis: true
        });

      const firmMetaParts = [];
      if (firm?.legal_name && firm.legal_name !== firm.name) firmMetaParts.push(firm.legal_name);
      if (firm?.city && firm?.state) firmMetaParts.push(`${firm.city}, ${firm.state}`);
      if (firm?.gst_number) firmMetaParts.push(`GSTIN: ${firm.gst_number}`);
      if (firm?.pan_number) firmMetaParts.push(`PAN: ${firm.pan_number}`);
      const firmMetaStr = firmMetaParts.join('  •  ') || 'Statutory Labour Contractor & Project Management Services';

      doc.font('DejaVuSans')
        .fontSize(7.5)
        .fillColor('#CBD5E1')
        .text(firmMetaStr, LEFT + 12, 54, { width: CONTENT_WIDTH - 24, ellipsis: true });

      doc.restore();

      // Sub-Banner: Document Title
      let curY = 80;
      doc.save();
      doc.rect(LEFT, curY, CONTENT_WIDTH, 20).fill('#F1F5F9');
      doc.rect(LEFT, curY, CONTENT_WIDTH, 20).strokeColor('#CBD5E1').lineWidth(0.5).stroke();

      doc.font('DejaVuSans-Bold')
        .fontSize(8)
        .fillColor('#1E293B')
        .text('EMPLOYEE MASTER PROFILE & STATUTORY DOSSIER (FORM A REGISTER)', LEFT + 8, curY + 6);

      const refNumber = `REF: DOS/${new Date().getFullYear()}/${String(employee._id).slice(-6).toUpperCase()}`;
      doc.font('DejaVuSans-Bold')
        .fontSize(7.5)
        .fillColor('#475569')
        .text(refNumber, LEFT, curY + 6, { width: CONTENT_WIDTH - 8, align: 'right' });
      doc.restore();

      curY += 26;

      // 2. TOP SNAPSHOT CARD (Left: Highlights | Right: QR & Photo Frame)
      const cardHeight = 94;
      doc.save();
      doc.roundedRect(LEFT, curY, CONTENT_WIDTH, cardHeight, 4).fillAndStroke('#FAFAFA', '#E2E8F0');

      // Left Snapshot Details
      const snapLeft = LEFT + 12;
      let snapY = curY + 10;

      // Employee Name
      doc.font('DejaVuSans-Bold')
        .fontSize(13)
        .fillColor('#0F172A')
        .text(employee.employee_name || 'N/A', snapLeft, snapY);

      // Status Pill
      const statusStr = (employee.status || 'Active').toUpperCase();
      const isStatusActive = statusStr === 'ACTIVE';
      const statusPillColor = isStatusActive ? '#15803D' : '#B91C1C';
      const statusBgColor = isStatusActive ? '#DCFCE7' : '#FEE2E2';

      doc.save();
      doc.roundedRect(snapLeft + 220, snapY - 1, 55, 14, 3).fill(statusBgColor);
      doc.font('DejaVuSans-Bold')
        .fontSize(7.5)
        .fillColor(statusPillColor)
        .text(statusStr, snapLeft + 220, snapY + 2.5, { width: 55, align: 'center' });
      doc.restore();

      snapY += 18;

      // Category & Trade
      doc.font('DejaVuSans-Bold').fontSize(8.5).fillColor('#334155').text('Trade / Category: ', snapLeft, snapY, { continued: true });
      doc.font('DejaVuSans').fillColor('#0F172A').text(employee.category || 'Worker');

      snapY += 13;
      // Stationing
      doc.font('DejaVuSans-Bold').fontSize(8.5).fillColor('#334155').text('Current Station: ', snapLeft, snapY, { continued: true });
      doc.font('DejaVuSans').fillColor('#0F172A').text(`${employee.site || 'Site A'} (${employee.project || 'General Project'})`);

      snapY += 13;
      // Date of Joining
      doc.font('DejaVuSans-Bold').fontSize(8.5).fillColor('#334155').text('Date of Joining: ', snapLeft, snapY, { continued: true });
      doc.font('DejaVuSans').fillColor('#0F172A').text(`${formatDate(employee.date_of_joining)}  •  Card Valid Until: ${formatDate(employee.card_valid_until)}`);

      snapY += 14;
      // Base Wage (Formatted with live Indian Rupee Symbol)
      doc.font('DejaVuSans-Bold').fontSize(8.5).fillColor('#334155').text('Base Daily Wage: ', snapLeft, snapY, { continued: true });
      doc.font('DejaVuSans-Bold').fillColor('#1E3A8A').text(`${formatCurrency(employee.p_day_wage)} / day`);

      // Right Section: QR Code & Photo Placeholder
      const qrSize = 65;
      const photoWidth = 65;
      const photoHeight = 78;
      const photoX = RIGHT - photoWidth - 8;
      const qrX = photoX - qrSize - 10;

      // Draw QR Code
      doc.image(qrBuffer, qrX, curY + 8, { width: qrSize, height: qrSize });
      doc.font('DejaVuSans').fontSize(6).fillColor('#64748B').text('Scan to Verify On-Site', qrX, curY + 77, { width: qrSize, align: 'center' });

      // Photo Box
      doc.save();
      doc.rect(photoX, curY + 7, photoWidth, photoHeight).dash(3, { space: 3 }).strokeColor('#94A3B8').lineWidth(0.8).stroke();
      doc.font('DejaVuSans')
        .fontSize(6)
        .fillColor('#94A3B8')
        .text('AFFIX RECENT\nPASSPORT PHOTO\n(CROSS-SIGNED)', photoX, curY + 28, { width: photoWidth, align: 'center' });
      doc.restore();

      doc.restore();
      curY += cardHeight + 10;

      // HELPER: Section Header
      const drawSectionHeader = (title: string, yPos: number): number => {
        doc.save();
        doc.rect(LEFT, yPos, CONTENT_WIDTH, 17).fill('#1E293B'); // Slate-800
        doc.font('DejaVuSans-Bold')
          .fontSize(8)
          .fillColor('#FFFFFF')
          .text(title.toUpperCase(), LEFT + 8, yPos + 4.5);
        doc.restore();
        return yPos + 17;
      };

      // HELPER: 2-Column Key-Value Row
      const drawKeyValueRow = (
        yPos: number,
        col1Label: string, col1Val: any,
        col2Label: string, col2Val: any,
        bgColor = '#FFFFFF'
      ): number => {
        const rowHeight = 21;
        const colWidth = CONTENT_WIDTH / 2;

        doc.save();
        if (bgColor !== '#FFFFFF') {
          doc.rect(LEFT, yPos, CONTENT_WIDTH, rowHeight).fill(bgColor);
        }
        doc.rect(LEFT, yPos, CONTENT_WIDTH, rowHeight).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

        const v1 = col1Val !== null && col1Val !== undefined && String(col1Val).trim() ? String(col1Val).trim() : '—';
        const v2 = col2Val !== null && col2Val !== undefined && String(col2Val).trim() ? String(col2Val).trim() : '—';

        // Col 1
        doc.font('DejaVuSans-Bold').fontSize(7.5).fillColor('#475569').text(col1Label, LEFT + 6, yPos + 6, { width: 105 });
        doc.font('DejaVuSans').fontSize(8).fillColor('#0F172A').text(v1, LEFT + 112, yPos + 6, { width: colWidth - 118, ellipsis: true });

        // Divider
        doc.moveTo(LEFT + colWidth, yPos).lineTo(LEFT + colWidth, yPos + rowHeight).strokeColor('#E2E8F0').lineWidth(0.5).stroke();

        // Col 2
        doc.font('DejaVuSans-Bold').fontSize(7.5).fillColor('#475569').text(col2Label, LEFT + colWidth + 6, yPos + 6, { width: 105 });
        doc.font('DejaVuSans').fontSize(8).fillColor('#0F172A').text(v2, LEFT + colWidth + 112, yPos + 6, { width: colWidth - 118, ellipsis: true });

        doc.restore();
        return yPos + rowHeight;
      };

      // 3. SECTION 1: PERSONAL & IDENTIFICATION PARTICULARS
      curY = drawSectionHeader('1. Personal & Identity Particulars', curY);
      curY = drawKeyValueRow(curY, "Full Legal Name:", employee.employee_name, "Father / Spouse:", employee.father_husband_name, '#F8FAFC');
      curY = drawKeyValueRow(curY, "Date of Birth:", formatDate(employee.date_of_birth), "Calculated Age:", calculateAge(employee.date_of_birth));
      curY = drawKeyValueRow(curY, "Aadhaar Card No:", employee.aadhar ? String(employee.aadhar) : '—', "PAN Number:", employee.pan || '—', '#F8FAFC');
      curY = drawKeyValueRow(curY, "Mobile Phone:", employee.phone_no ? String(employee.phone_no) : '—', "Gender / Social Cat:", employee.category || 'Worker');

      // Address (Full width row with comfortable padding)
      const addrHeight = 24;
      doc.save();
      doc.rect(LEFT, curY, CONTENT_WIDTH, addrHeight).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      doc.font('DejaVuSans-Bold').fontSize(7.5).fillColor('#475569').text("Permanent Address:", LEFT + 6, curY + 7, { width: 105 });
      doc.font('DejaVuSans').fontSize(8).fillColor('#0F172A').text(employee.address || '—', LEFT + 112, curY + 7, { width: CONTENT_WIDTH - 120, ellipsis: true });
      doc.restore();
      curY += addrHeight + 10;

      // 4. SECTION 2: STATUTORY COMPLIANCE & SOCIAL SECURITY REGISTRATIONS
      curY = drawSectionHeader('2. Statutory & Social Security Registrations', curY);
      curY = drawKeyValueRow(curY, "EPFO UAN:", employee.uan ? String(employee.uan) : '—', "ESIC Insurance No:", employee.esic_no ? String(employee.esic_no) : '—', '#F8FAFC');
      curY = drawKeyValueRow(curY, "Shram Kalyan No:", employee.s_kalyan_no || '—', "Notice Period:", `${employee.resignation_notice_period ?? 30} Days`);
      curY += 10;

      // 5. SECTION 3: BANKING & DIRECT WAGE DISBURSEMENT DETAILS
      curY = drawSectionHeader('3. Banking & Direct Wage Disbursement Details', curY);
      curY = drawKeyValueRow(curY, "Bank Name:", employee.bank, "Account Number:", employee.account_no ? String(employee.account_no) : '—', '#F8FAFC');
      curY = drawKeyValueRow(curY, "IFSC Code:", employee.ifsc, "Bank Branch:", employee.branch);
      curY += 10;

      // 6. SECTION 4: SITE DEPLOYMENT & HISTORICAL INTER-SITE MOVEMENTS
      curY = drawSectionHeader('4. Site Deployment & Movement History', curY);
      const allTenures = getEmployeeTenures(employee);
      if (allTenures.length > 1) {
        allTenures.slice(0, -1).forEach((t: any) => {
          const tPeriod = `${formatDate(t.date_of_joining)} to ${formatDate(t.date_of_exit)}`;
          const tDeploy = `${t.project || 'General'} / ${t.site || 'Base'} • ${t.category} (₹${t.p_day_wage}/day)`;
          curY = drawKeyValueRow(curY, `Tenure #${t.tenure_no} (Past):`, tPeriod, "Assignment:", tDeploy, '#F8FAFC');
        });
      }
      if (recentTransfers && recentTransfers.length > 0) {
        recentTransfers.forEach((tr: any, idx: number) => {
          const moveRoute = `${tr.from_site || 'Initial'} -> ${tr.to_site} (${tr.transfer_type || 'Permanent'})`;
          const moveMeta = `Effective: ${formatDate(tr.effective_date)} | Ref: ${tr.transfer_order_no || 'Standard'}`;
          curY = drawKeyValueRow(curY, `Transfer #${idx + 1}:`, moveRoute, "Effective / Ref:", moveMeta, idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF');
        });
      } else {
        curY = drawKeyValueRow(curY, "Deployment Status:", `Stationed at ${employee.site || 'Site A'} since ${formatDate(employee.date_of_joining)}`, "Movement Records:", "No inter-site movements on record", '#F8FAFC');
      }
      curY += 10;

      // Exit details if left
      if (employee.date_of_exit) {
        curY = drawSectionHeader('5. Separation & Exit Details', curY);
        curY = drawKeyValueRow(curY, "Date of Exit:", formatDate(employee.date_of_exit), "Reason for Leaving:", employee.doe_rem || 'Resigned', '#FEF2F2');
        curY += 10;
      }

      // 7. SECTION: DECLARATION & SIGNATURE BLOCKS
      curY = drawSectionHeader('5. Statutory Declaration & Attestation', curY);

      const declHeight = 26;
      doc.save();
      doc.rect(LEFT, curY, CONTENT_WIDTH, declHeight).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      doc.font('DejaVuSans-Oblique')
        .fontSize(6.8)
        .fillColor('#475569')
        .text(
          'I hereby declare that all particulars furnished above are true and correct to the best of my knowledge and belief. I agree to abide by all safety, site discipline, and labour welfare rules established under the Contract Labour (R&A) Act and Code on Wages.',
          LEFT + 8,
          curY + 5,
          { width: CONTENT_WIDTH - 16, lineGap: 1.5 }
        );
      doc.restore();
      curY += declHeight + 10;

      // Two Signature Boxes
      const sigBoxWidth = (CONTENT_WIDTH - 16) / 2;
      const sigBoxHeight = 65;

      // Left Box: Employee
      doc.save();
      doc.rect(LEFT, curY, sigBoxWidth, sigBoxHeight).strokeColor('#CBD5E1').lineWidth(0.6).stroke();
      doc.font('DejaVuSans')
        .fontSize(7.5)
        .fillColor('#64748B')
        .text("Signature / Left Thumb Impression of Employee", LEFT + 6, curY + sigBoxHeight - 15, {
          width: sigBoxWidth - 12,
          align: 'center'
        });
      doc.restore();

      // Right Box: Employer
      doc.save();
      doc.rect(LEFT + sigBoxWidth + 16, curY, sigBoxWidth, sigBoxHeight).strokeColor('#CBD5E1').lineWidth(0.6).stroke();
      doc.font('DejaVuSans')
        .fontSize(7.5)
        .fillColor('#64748B')
        .text(`For ${firm?.name || 'Company Name'} (Authorized Signatory & Seal)`, LEFT + sigBoxWidth + 22, curY + sigBoxHeight - 15, {
          width: sigBoxWidth - 12,
          align: 'center'
        });
      doc.restore();

      // 8. BOTTOM FOOTER - Strictly anchored on Single Page 1 without any page-break overflow
      const footerY = 792;
      doc.save();
      doc.moveTo(LEFT, footerY).lineTo(RIGHT, footerY).strokeColor('#CBD5E1').lineWidth(0.5).stroke();

      const genTime = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      doc.font('DejaVuSans')
        .fontSize(6.5)
        .fillColor('#94A3B8')
        .text(`Confidential Master Roll Dossier  •  Generated on: ${genTime}  •  System Authenticated Record`, LEFT, footerY + 5, {
          lineBreak: false
        });

      doc.font('DejaVuSans')
        .fontSize(6.5)
        .fillColor('#94A3B8')
        .text(`Page 1 of 1`, LEFT, footerY + 5, {
          width: CONTENT_WIDTH,
          align: 'right',
          lineBreak: false
        });
      doc.restore();

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
