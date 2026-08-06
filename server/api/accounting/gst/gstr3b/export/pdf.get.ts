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
      status: { $ne: 'CANCELLED' }
    };
    if (startDate && endDate) filter.bdate = { $gte: startDate, $lte: endDate };
    if (firmGstin) filter.firmGstin = firmGstin;

    const bills = await Bill.find(filter).lean();
    const salesBills = bills.filter(b => b.btype === 'SALES');
    const purchaseBills = bills.filter(b => b.btype === 'PURCHASE');

    const salesTaxable = salesBills.reduce((acc, b) => acc + (b.grossTotal || 0), 0);
    const salesTax = salesBills.reduce((acc, b) => acc + (b.cgst || 0) + (b.sgst || 0) + (b.igst || 0), 0);

    const purchaseTaxable = purchaseBills.reduce((acc, b) => acc + (b.grossTotal || 0), 0);
    const purchaseTax = purchaseBills.reduce((acc, b) => acc + (b.cgst || 0) + (b.sgst || 0) + (b.igst || 0), 0);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));

    doc.fontSize(16).text('GSTR-3B SUMMARY REPORT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`GSTIN: ${firmGstin || 'N/A'}`);
    doc.text(`Period: ${startDate} to ${endDate}`);
    doc.moveDown();

    doc.fontSize(12).text('3.1 Outward Taxable Supplies (Sales)');
    doc.fontSize(10).text(`Taxable Amount: Rs. ${salesTaxable.toFixed(2)}`);
    doc.text(`Tax Liability: Rs. ${salesTax.toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(12).text('4. Eligible ITC (Purchases)');
    doc.fontSize(10).text(`Taxable Amount: Rs. ${purchaseTaxable.toFixed(2)}`);
    doc.text(`ITC Available: Rs. ${purchaseTax.toFixed(2)}`);
    doc.moveDown();

    const netPayable = Math.max(0, salesTax - purchaseTax);
    doc.fontSize(12).text(`Net Tax Payable: Rs. ${netPayable.toFixed(2)}`);

    doc.end();

    await new Promise(resolve => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `attachment; filename="GSTR3B_${firmGstin}_${startDate}.pdf"`);

    return pdfBuffer;
  } catch (error: any) {
    console.error('Export GSTR3B PDF error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting GSTR3B PDF'
    });
  }
});
