import { defineEventHandler, getQuery, setHeader, createError } from 'h3';
import PDFDocument from 'pdfkit';
import { requireAuthSession } from '../../../../../utils/auth';
import Bill from '../../../../../models/Bill';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const firmIdObj = user.firm_id;
    const firmIdStr = String(firmIdObj);

    const query = getQuery(event);
    const startDate = query.startDate ? String(query.startDate) : '';
    const endDate = query.endDate ? String(query.endDate) : '';
    const firmGstin = query.firmGstin ? String(query.firmGstin) : '';

    const filter: any = {
      $or: [
        { firmId: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdObj },
        { firm_id: firmIdStr }
      ],
      btype: 'SALES',
      status: { $ne: 'CANCELLED' }
    };
    if (startDate && endDate) filter.bdate = { $gte: startDate, $lte: endDate };
    if (firmGstin) filter.firmGstin = firmGstin;

    const bills = await Bill.find(filter).lean();

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Title
    doc.fontSize(16).text('GSTR-1 SUMMARY REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`GSTIN: ${firmGstin || 'N/A'}`);
    doc.text(`Period: ${startDate} to ${endDate}`);
    doc.text(`Total Invoices: ${bills.length}`);
    doc.moveDown();

    const totalGross = bills.reduce((acc, b) => acc + (b.grossTotal || 0), 0);
    const totalTax = bills.reduce((acc, b) => acc + (b.cgst || 0) + (b.sgst || 0) + (b.igst || 0), 0);
    const totalNet = bills.reduce((acc, b) => acc + (b.netTotal || 0), 0);

    doc.fontSize(12).text(`Total Taxable Amount: Rs. ${totalGross.toFixed(2)}`);
    doc.text(`Total Tax Amount: Rs. ${totalTax.toFixed(2)}`);
    doc.text(`Total Invoice Value: Rs. ${totalNet.toFixed(2)}`);

    doc.end();

    await new Promise(resolve => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `attachment; filename="GSTR1_${firmGstin}_${startDate}.pdf"`);

    return pdfBuffer;
  } catch (error: any) {
    console.error('Export GSTR1 PDF error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting GSTR1 PDF'
    });
  }
});
