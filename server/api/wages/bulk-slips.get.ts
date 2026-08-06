import Wage from '../../models/Wage';
import Firm from '../../models/Firm';
import PDFDocument from 'pdfkit';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

function formatDate(date: any) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
}

function formatCurrency(amount: number) {
  return 'Rs. ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

// Bug #11: strip anything that isn't safe for a filename / header value,
// used both for the ZIP entry names and (in [id].get.ts) Content-Disposition.
function safeFilenamePart(value: string | undefined | null, fallback: string) {
  return (value || fallback).replace(/[^a-zA-Z0-9-]/g, '_');
}

async function generateWageSlipPDF(wage: any, firm: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: any[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).fillColor('#1F4E78').text(firm?.name || 'Company Name', { align: 'left' });
    doc.fontSize(12).fillColor('#4472C4').text('WAGE SLIP', { align: 'right' });
    doc.moveDown();
    doc.strokeColor('#CCCCCC').moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown();

    // Employee Info
    doc.fontSize(11).fillColor('#1F4E78').text('EMPLOYEE INFORMATION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('black');

    const startY = doc.y;
    doc.text(`Employee Name: ${wage.master_roll_id?.employee_name || 'N/A'}`, 40, startY);
    doc.text(`Aadhar: ${wage.master_roll_id?.aadhar || 'N/A'}`, 300, startY);
    doc.text(`Bank: ${wage.master_roll_id?.bank || 'N/A'}`, 40, startY + 15);
    doc.text(`Account No: ${wage.master_roll_id?.account_no || 'N/A'}`, 300, startY + 15);
    doc.text(`Salary Month: ${wage.salary_month || 'N/A'}`, 40, startY + 30);
    doc.text(`Paid Date: ${formatDate(wage.paid_date) || 'N/A'}`, 300, startY + 30);
    doc.text(`Payment Mode: ${wage.payment_mode || 'N/A'}`, 40, startY + 45);
    doc.text(`Ref/Chq No: ${wage.cheque_no || 'N/A'}`, 300, startY + 45);

    doc.moveDown(4);
    doc.strokeColor('#CCCCCC').moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown();

    // Salary Details
    doc.fontSize(11).fillColor('#1F4E78').text('SALARY DETAILS', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.fontSize(10).fillColor('white');
    doc.rect(40, tableTop, 515, 20).fill('#4472C4');
    doc.text('Particulars', 50, tableTop + 5);
    doc.text('Amount', 450, tableTop + 5, { width: 90, align: 'right' });

    doc.fillColor('black');
    let currentY = tableTop + 25;

    const earnings = [
      { label: 'Gross Salary', value: wage.gross_salary },
      { label: 'Other Benefits', value: wage.other_benefit },
    ];

    earnings.forEach(item => {
      doc.text(item.label, 50, currentY);
      doc.text(formatCurrency(item.value), 450, currentY, { width: 90, align: 'right' });
      currentY += 15;
    });

    currentY += 5;
    doc.fontSize(10).fillColor('#1F4E78').text('DEDUCTIONS', 50, currentY);
    currentY += 15;
    doc.fillColor('black');

    const deductions = [
      { label: 'EPF Deduction', value: wage.epf_deduction },
      { label: 'ESIC Deduction', value: wage.esic_deduction },
      { label: 'Other Deduction', value: wage.other_deduction },
      { label: 'Advance Deduction', value: wage.advance_deduction },
    ];

    deductions.forEach(item => {
      doc.text(item.label, 50, currentY);
      doc.text(formatCurrency(item.value), 450, currentY, { width: 90, align: 'right' });
      currentY += 15;
    });

    currentY += 10;
    doc.rect(40, currentY, 515, 20).fill('#70AD47');
    doc.fillColor('white').text('NET SALARY', 50, currentY + 5);
    doc.text(formatCurrency(wage.net_salary), 450, currentY + 5, { width: 90, align: 'right' });

    // Footer
    const footerTop = doc.page.height - 100;
    doc.fontSize(7).fillColor('gray');
    const footerText = `This is a computer-generated wage slip. No signature is required.\nGenerated on: ${new Date().toLocaleString('en-IN')}\nWage ID: ${wage._id}`;
    doc.text(footerText, 40, footerTop, { align: 'center', width: 515, lineGap: 2 });

    doc.end();
  });
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const query = getQuery(event);
  const month = query.month as string;

  if (!month) {
    throw createError({
      statusCode: 400,
      message: 'Month is required'
    });
  }

  const wages = await Wage.find({ firm_id: user.firm_id, salary_month: month })
    .populate('master_roll_id', 'employee_name aadhar bank account_no project site')
    .lean();

  if (wages.length === 0) {
    throw createError({
      statusCode: 404,
      message: `No wages found for ${month}`
    });
  }

  const firm = await Firm.findById(user.firm_id).lean();

  // Dynamic import of archiver to prevent bundling issue
  const archiverModule = (await import('archiver')) as any;
  const archiver = archiverModule.default || archiverModule;

  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];

  archive.on('data', (chunk: Buffer) => chunks.push(chunk));

  const safeMonth = safeFilenamePart(month, 'month');
  for (const wage of wages) {
    const empName = (wage as any).master_roll_id?.employee_name || 'employee';
    const safeName = safeFilenamePart(empName, 'employee');
    const pdfBuffer = await generateWageSlipPDF(wage, firm);
    archive.append(pdfBuffer, { name: `WageSlip_${safeName}_${safeMonth}.pdf` });
  }

  await archive.finalize();
  const zipBuffer = Buffer.concat(chunks);

  setResponseHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="WageSlips_${safeMonth}.zip"`
  });

  return zipBuffer;
});