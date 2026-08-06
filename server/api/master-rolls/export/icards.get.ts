import { defineEventHandler, createError, getQuery, getHeader, setResponseHeader } from 'h3';
import MasterRoll from '../../../models/MasterRoll';
import Firm from '../../../models/Firm';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

/**
 * Export I-Cards endpoint
 * GET /api/master-rolls/export/icards
 * Query params: project, site, category, format (pdf|xlsx), employeeId, selectedIds
 */
export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const query = getQuery(event);
    const { project, site, category, format = 'pdf', employeeId, selectedIds } = query;

    // Build filter
    const filter: Record<string, any> = { firm_id: new mongoose.Types.ObjectId(firmId as string) };
    
    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId as string)) {
      filter._id = new mongoose.Types.ObjectId(employeeId as string);
    } else if (selectedIds) {
      const ids = (selectedIds as string).split(',')
        .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
        .map((id: string) => new mongoose.Types.ObjectId(id));
      filter._id = { $in: ids };
    } else {
      filter.status = 'Active';
      if (project) filter.project = project;
      if (site) filter.site = site;
      if (category) filter.category = category;
    }

    const employees = await MasterRoll.find(filter).sort({ employee_name: 1 }).lean();
    const firm = await Firm.findById(firmId).lean();
    const firmName = firm?.name ?? 'Your Company';

    if (!employees.length) {
      throw createError({ statusCode: 404, statusMessage: 'No employees found for I-Card generation' });
    }

    // Helper function to format date
    const formatDate = (dateStr: string | null | undefined): string => {
      if (!dateStr) return 'N/A';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    // Generate filename
    const cleanEmpName = employees.length === 1 && employees[0]
      ? employees[0].employee_name.replace(/[^a-zA-Z0-9]/g, '_') 
      : '';
    const extension = format === 'xlsx' ? 'xlsx' : 'pdf';
    const filename = cleanEmpName ? `ICard_${cleanEmpName}.${extension}` : `icards.${extension}`;

    /* ═══════════════════════════════════════════════════════════════════
       XLSX FORMAT - Card layout with merged cells
    ═══════════════════════════════════════════════════════════════════ */
    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('I-Cards', {
        pageSetup: {
          paperSize: 9, // A4
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 },
        },
        views: [{ showGridLines: false }],
      });

      const C = {
        RED: 'FFDC2626',
        RED_L: 'FFFEF2F2',
        RED_M: 'FFFECACA',
        WHITE: 'FFFFFFFF',
        DARK: 'FF111827',
        GRAY: 'FF6B7280',
        GRAY_L: 'FFF9FAFB',
        AMBER: 'FFFEF3C7',
        AMBER_D: 'FF92400E',
      };

      const CARD_COLS = 10;
      const CARD_ROWS = 22;
      const GAP_ROWS = 1;

      const widths = [7, 7, 7, 5, 8, 5, 7, 7, 7, 7, 2, 7, 7, 7, 5, 8, 5, 7, 7, 7, 7];
      widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      const setRowHeights = (sr: number) => {
        const h = [22, 12, 11, 3, 14, 12, 12, 12, 12, 12, 12, 12, 3, 13, 13, 12, 12, 3, 18, 10, 10, 0];
        h.forEach((v, i) => { ws.getRow(sr + i).height = v; });
      };

      const mc = (r1: number, c1: number, r2: number, c2: number, opts: any = {}) => {
        ws.mergeCells(r1, c1, r2, c2);
        const cell = ws.getCell(r1, c1);
        if (opts.value !== undefined) cell.value = opts.value;
        if (opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
        if (opts.font) cell.font = { name: 'Arial', ...opts.font };
        if (opts.align) cell.alignment = { wrapText: true, ...opts.align };
        if (opts.border) cell.border = opts.border;
        return cell;
      };

      const thick = (argb: string) => ({ 
        top: { style: 'medium', color: { argb } }, 
        left: { style: 'medium', color: { argb } }, 
        bottom: { style: 'medium', color: { argb } }, 
        right: { style: 'medium', color: { argb } } 
      });
      
      const thin = (argb: string) => ({ 
        top: { style: 'thin', color: { argb } }, 
        left: { style: 'thin', color: { argb } }, 
        bottom: { style: 'thin', color: { argb } }, 
        right: { style: 'thin', color: { argb } } 
      });

      const drawCard = (emp: any, sr: number, sc: number) => {
        const ec = sc + CARD_COLS - 1;
        const iNo = emp._id.toString().slice(-8).toUpperCase();
        setRowHeights(sr);

        // Header
        mc(sr + 0, sc, sr + 0, ec, { 
          value: firmName.toUpperCase(), 
          fill: C.RED, 
          border: thick(C.RED), 
          font: { bold: true, color: { argb: C.WHITE }, size: 12 }, 
          align: { horizontal: 'center', vertical: 'middle' } 
        });
        
        mc(sr + 1, sc, sr + 1, ec, { 
          value: 'IDENTITY CARD', 
          fill: C.RED_L, 
          border: thick(C.RED), 
          font: { bold: true, color: { argb: C.RED }, size: 7.5 }, 
          align: { horizontal: 'center', vertical: 'middle' } 
        });
        
        mc(sr + 2, sc, sr + 2, ec, { 
          value: `CARD NO: ${iNo}`, 
          fill: C.RED_M, 
          border: thick(C.RED), 
          font: { bold: true, color: { argb: C.RED }, size: 7 }, 
          align: { horizontal: 'right', vertical: 'middle' } 
        });
        
        mc(sr + 3, sc, sr + 3, ec, { fill: C.RED_L, border: thin(C.RED) });
        
        // Photo placeholder
        mc(sr + 4, sc, sr + 11, sc + 2, { 
          value: '[ PHOTO ]', 
          fill: C.GRAY_L, 
          border: thin('FFD1D5DB'), 
          font: { italic: true, color: { argb: C.GRAY }, size: 8 }, 
          align: { horizontal: 'center', vertical: 'middle' } 
        });

        const dojFormatted = formatDate(emp.date_of_joining);
        const validUntil = formatDate(emp.card_valid_until);

        const fields = [
          { label: 'Name', value: (emp.employee_name || '').toUpperCase(), bold: true, size: 10 },
          { label: "Father's", value: (emp.father_husband_name || '').toUpperCase(), bold: false, size: 9 },
          { label: 'Category', value: emp.category || 'N/A', bold: false, size: 9 },
          { label: 'Phone', value: emp.phone_no || 'N/A', bold: false, size: 9 },
          { label: 'Project', value: emp.project || 'N/A', bold: false, size: 9 },
          { label: 'Site', value: emp.site || 'N/A', bold: false, size: 9 },
          { label: 'D.O.J.', value: `${dojFormatted}  |  Valid Upto: ${validUntil}`, bold: false, size: 9 },
        ];

        fields.forEach(({ label, value, bold, size }, idx) => {
          const r = sr + 4 + idx;
          mc(r, sc + 3, r, sc + 4, { 
            value: label, 
            fill: C.RED_L, 
            border: thin(C.RED), 
            font: { bold: true, color: { argb: C.RED }, size: 7 }, 
            align: { horizontal: 'left', vertical: 'middle' } 
          });
          mc(r, sc + 5, r, ec, { 
            value: value || '—', 
            fill: C.WHITE, 
            border: thin(C.RED), 
            font: { bold, color: { argb: C.DARK }, size }, 
            align: { horizontal: 'left', vertical: 'middle' } 
          });
        });

        mc(sr + 11, sc + 3, sr + 11, ec, { fill: C.WHITE, border: thin(C.RED) });
        mc(sr + 12, sc, sr + 12, ec, { fill: C.WHITE, border: thin(C.RED) });
        
        // Address
        mc(sr + 13, sc, sr + 14, ec, { 
          value: `Address: ${emp.address || 'N/A'}`, 
          fill: C.RED_L, 
          border: thick(C.RED), 
          font: { color: { argb: C.DARK }, size: 8 }, 
          align: { horizontal: 'left', vertical: 'middle', wrapText: true } 
        });
        
        // Aadhar
        mc(sr + 15, sc, sr + 15, ec, { 
          value: `Aadhar No: ${emp.aadhar || '—'}`, 
          fill: C.AMBER, 
          border: thin(C.RED), 
          font: { bold: true, color: { argb: C.AMBER_D }, size: 8 }, 
          align: { horizontal: 'center', vertical: 'middle' } 
        });
        
        // UAN & ESIC
        mc(sr + 16, sc, sr + 16, ec, { 
          value: `UAN: ${emp.uan || '—'}        ESIC No: ${emp.esic_no || '—'}`, 
          fill: C.AMBER, 
          border: thin(C.RED), 
          font: { bold: true, color: { argb: C.AMBER_D }, size: 8 }, 
          align: { horizontal: 'center', vertical: 'middle' } 
        });
        
        mc(sr + 17, sc, sr + 17, ec, { fill: C.WHITE, border: thin(C.RED) });

        // Signature blocks
        const sigs = [
          { c1: sc, c2: sc + 2, label: 'Employee Signature' },
          { c1: sc + 3, c2: sc + 6, label: 'Authorized Signatory' },
          { c1: sc + 7, c2: ec, label: 'Official Seal' },
        ];
        sigs.forEach(({ c1, c2, label }) => {
          mc(sr + 18, c1, sr + 18, c2, { fill: C.WHITE, border: thin(C.RED) });
          mc(sr + 19, c1, sr + 19, c2, { 
            value: label, 
            fill: C.GRAY_L, 
            border: thin(C.RED), 
            font: { color: { argb: C.GRAY }, size: 6.5 }, 
            align: { horizontal: 'center', vertical: 'middle' } 
          });
        });

        // Footer
        mc(sr + 20, sc, sr + 20, ec, { 
          value: 'If found, please return to the issuing authority.', 
          fill: C.RED, 
          border: thick(C.RED), 
          font: { italic: true, color: { argb: C.WHITE }, size: 6.5 }, 
          align: { horizontal: 'center', vertical: 'middle' } 
        });
      };

      const TOTAL_CARD_ROWS = CARD_ROWS + GAP_ROWS;
      const CARD2_COL = 1 + CARD_COLS + 1 + 1;

      employees.forEach((emp, i) => {
        const pairRow = Math.floor(i / 2);
        const isRight = (i % 2 === 1);
        const startRow = 1 + pairRow * TOTAL_CARD_ROWS;
        const startCol = isRight ? CARD2_COL : 1;
        drawCard(emp, startRow, startCol);
      });

      const buffer = await wb.xlsx.writeBuffer();
      
      setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
      
      return buffer;
    }

    /* ═══════════════════════════════════════════════════════════════════
       PDF FORMAT - 6 cards per A4 page (2 cols × 3 rows)
    ═══════════════════════════════════════════════════════════════════ */
    const doc = new PDFDocument({ size: 'A4', margin: 14 });
    
    setResponseHeader(event, 'Content-Type', 'application/pdf');
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const PW = 595.28;
    const PH = 841.89;
    const PAGE_M = 14;
    const COL_GAP = 8;
    const ROW_GAP = 8;
    const COLS = 2;
    const ROWS = 3;
    const CARDS_PP = COLS * ROWS;
    const CARD_W = (PW - 2 * PAGE_M - (COLS - 1) * COL_GAP) / COLS;
    const CARD_H = (PH - 2 * PAGE_M - (ROWS - 1) * ROW_GAP) / ROWS;

    const RED = '#DC2626';
    const RED_L = '#FEF2F2';
    const RED_M = '#FECACA';
    const WHITE = '#FFFFFF';
    const DARK = '#111827';
    const GRAY = '#6B7280';
    const GRAY_L = '#F3F4F6';
    const AMBER = '#FEF3C7';
    const AMB_D = '#92400E';

    const HDR_H = 22;
    const SUB_H = 11;
    const CNUM_H = 10;
    const SEP_H = 4;
    const BODY_TOP = HDR_H + SUB_H + CNUM_H + SEP_H;

    const ADDR_H = 22;
    const AADH_H = 11;
    const UANE_H = 11;
    const SIG_H = 22;
    const SIGL_H = 9;
    const FOOT_H = 10;
    const BOT_H = ADDR_H + AADH_H + UANE_H + SIG_H + SIGL_H + FOOT_H;

    const BODY_H = CARD_H - BODY_TOP - BOT_H;
    const PHOTO_W = 50;
    const PHOTO_H = Math.floor(BODY_H * 0.49);
    const QR_W = 50;
    const QR_H = Math.floor(BODY_H * 0.47);
    const LEFT_W = PHOTO_W + 5;
    const FX_OFF = LEFT_W + 4;
    const FIELD_W = CARD_W - FX_OFF - 4;
    const FIELD_N = 7;
    const FIELD_H = Math.floor(BODY_H / FIELD_N);

    const drawCard = async (emp: any, cx: number, cy: number) => {
      const iNo = emp._id.toString().slice(-8).toUpperCase();

      doc.rect(cx, cy, CARD_W, CARD_H).lineWidth(1.2).strokeColor(RED).stroke();
      doc.rect(cx, cy, CARD_W, HDR_H).fillColor(RED).fill();
      doc.fillColor(WHITE).fontSize(10).font('Helvetica-Bold').text(firmName.toUpperCase(), cx + 4, cy + 6, { width: CARD_W - 8, align: 'center', lineBreak: false });

      doc.rect(cx, cy + HDR_H, CARD_W, SUB_H).fillColor(RED_L).fill();
      doc.fillColor(RED).fontSize(7).font('Helvetica-Bold').text('IDENTITY CARD', cx + 4, cy + HDR_H + 2, { width: CARD_W / 2, align: 'center', lineBreak: false });
      doc.fillColor(GRAY).fontSize(6).font('Helvetica').text(`#${iNo}`, cx + CARD_W / 2, cy + HDR_H + 2, { width: CARD_W / 2 - 4, align: 'right', lineBreak: false });

      doc.rect(cx, cy + HDR_H + SUB_H, CARD_W, CNUM_H).fillColor(RED_M).fill();
      doc.fillColor(RED).fontSize(5.5).font('Helvetica-Bold').text(`${firmName.toUpperCase()}  •  EMPLOYEE IDENTITY CARD  •  CARD NO: ${iNo}`, cx + 4, cy + HDR_H + SUB_H + 2, { width: CARD_W - 8, align: 'center', lineBreak: false });

      const bodyY = cy + BODY_TOP;
      doc.rect(cx + 4, bodyY + 2, PHOTO_W, PHOTO_H).fillColor(GRAY_L).fill().strokeColor('#D1D5DB').lineWidth(0.5).stroke();
      doc.fillColor(GRAY).fontSize(7).font('Helvetica').text('PHOTO', cx + 4, bodyY + 2 + PHOTO_H / 2 - 4, { width: PHOTO_W, align: 'center', lineBreak: false });

      const empDojFmt = formatDate(emp.date_of_joining);
      const empValidUntil = formatDate(emp.card_valid_until);
      const qrText = [
        `${firmName.toUpperCase()}`,
        `Card No : ${iNo}`,
        `Name    : ${emp.employee_name}`,
        `Category: ${emp.category || 'N/A'}`,
        `Project : ${emp.project || 'N/A'}`,
        `Site    : ${emp.site || 'N/A'}`,
        `D.O.J.  : ${empDojFmt}`,
        `Valid   : ${empValidUntil}`,
        `Aadhar  : ${emp.aadhar || 'N/A'}`
      ].join('\n');
      
      const qrBuf = await QRCode.toBuffer(qrText, { margin: 0, scale: 3, errorCorrectionLevel: 'M' });
      const qrY = bodyY + 2 + PHOTO_H + 3;
      doc.image(qrBuf, cx + 4, qrY, { width: QR_W, height: QR_H });

      const fX = cx + FX_OFF;
      const fields = [
        { label: 'NAME', value: (emp.employee_name || '').toUpperCase(), bold: true, sz: 9.5 },
        { label: "FATHER'S", value: (emp.father_husband_name || '').toUpperCase(), bold: false, sz: 8 },
        { label: 'CATEGORY', value: emp.category || 'N/A', bold: false, sz: 8 },
        { label: 'PHONE', value: emp.phone_no || 'N/A', bold: false, sz: 8 },
        { label: 'PROJECT', value: emp.project || 'N/A', bold: false, sz: 8 },
        { label: 'SITE', value: emp.site || 'N/A', bold: false, sz: 8 },
        { label: 'D.O.J.', value: `${empDojFmt}  |  Valid Upto: ${empValidUntil}`, bold: false, sz: 8 },
      ];

      fields.forEach(({ label, value, bold, sz }, idx) => {
        const rY = bodyY + 2 + idx * FIELD_H;
        if (idx % 2 === 0) doc.rect(fX, rY, FIELD_W, FIELD_H - 1).fillColor(RED_L).fill();
        doc.fillColor(RED).fontSize(5.5).font('Helvetica-Bold').text(label, fX + 2, rY + 2, { width: 38, lineBreak: false });
        doc.fillColor(bold ? DARK : '#374151').fontSize(sz).font(bold ? 'Helvetica-Bold' : 'Helvetica').text(value || '—', fX + 42, rY + 2, { width: FIELD_W - 44, lineBreak: false, ellipsis: true });
      });

      const botY = cy + CARD_H - BOT_H;
      doc.rect(cx, botY, CARD_W, ADDR_H).fillColor(RED_L).fill();
      doc.fillColor(RED).fontSize(6).font('Helvetica-Bold').text('ADDRESS:', cx + 4, botY + 3, { lineBreak: false });
      doc.fillColor(DARK).fontSize(7).font('Helvetica').text(emp.address || 'N/A', cx + 44, botY + 3, { width: CARD_W - 48, height: ADDR_H - 5, lineBreak: true, ellipsis: true });

      const aadY = botY + ADDR_H;
      doc.rect(cx, aadY, CARD_W, AADH_H).fillColor(AMBER).fill();
      doc.fillColor(AMB_D).fontSize(6.5).font('Helvetica-Bold').text(`Aadhar No: ${emp.aadhar || '—'}`, cx + 4, aadY + 2, { width: CARD_W - 8, align: 'center', lineBreak: false });

      const uanY = aadY + AADH_H;
      doc.rect(cx, uanY, CARD_W, UANE_H).fillColor('#FEF9C3').fill();
      doc.fillColor(AMB_D).fontSize(6.5).font('Helvetica-Bold').text(`UAN: ${emp.uan || '—'}      ESIC No: ${emp.esic_no || '—'}`, cx + 4, uanY + 2, { width: CARD_W - 8, align: 'center', lineBreak: false });

      const sigY = uanY + UANE_H;
      const sigW = (CARD_W - 10) / 3;
      const lbls = ['EMPLOYEE SIGN', 'AUTHORIZED SIGN', 'OFFICIAL SEAL'];
      lbls.forEach((lbl, k) => {
        const sx = cx + 3 + k * (sigW + 2);
        doc.rect(sx, sigY, sigW, SIG_H).lineWidth(0.5).strokeColor(RED).stroke();
        doc.rect(sx, sigY + SIG_H, sigW, SIGL_H).fillColor(GRAY_L).fill().strokeColor('#D1D5DB').lineWidth(0.3).stroke();
        doc.fillColor(GRAY).fontSize(5.5).font('Helvetica').text(lbl, sx, sigY + SIG_H + 2, { width: sigW, align: 'center', lineBreak: false });
      });

      const footY = sigY + SIG_H + SIGL_H;
      doc.rect(cx, footY, CARD_W, FOOT_H).fillColor(RED).fill();
      doc.fillColor(WHITE).fontSize(5.5).font('Helvetica-Oblique').text('If found, please return to the issuing authority.', cx + 4, footY + 2, { width: CARD_W - 8, align: 'center', lineBreak: false });
    };

    for (let i = 0; i < employees.length; i++) {
      if (i > 0 && i % CARDS_PP === 0) doc.addPage();
      const pos = i % CARDS_PP;
      const col = pos % COLS;
      const row = Math.floor(pos / COLS);
      const cx = PAGE_M + col * (CARD_W + COL_GAP);
      const cy = PAGE_M + row * (CARD_H + ROW_GAP);
      await drawCard(employees[i], cx, cy);
    }

    doc.end();
    
    return await pdfPromise;
  } catch (error: any) {
    console.error('Export I-Cards error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting I-Cards'
    });
  }
});
