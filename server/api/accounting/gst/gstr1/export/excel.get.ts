import { defineEventHandler, getQuery, setHeader, createError } from 'h3';
import ExcelJS from 'exceljs';
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

    const workbook = new ExcelJS.Workbook();
    const sheetB2B = workbook.addWorksheet('B2B Invoices');

    sheetB2B.columns = [
      { header: 'GSTIN/UIN of Recipient', key: 'gstin', width: 20 },
      { header: 'Receiver Name', key: 'name', width: 25 },
      { header: 'Invoice Number', key: 'bno', width: 18 },
      { header: 'Invoice Date', key: 'bdate', width: 14 },
      { header: 'Invoice Value', key: 'net', width: 15 },
      { header: 'Place Of Supply', key: 'pos', width: 15 },
      { header: 'Taxable Value', key: 'gross', width: 15 },
      { header: 'CGST Amount', key: 'cgst', width: 14 },
      { header: 'SGST Amount', key: 'sgst', width: 14 },
      { header: 'IGST Amount', key: 'igst', width: 14 }
    ];

    bills.forEach(b => {
      sheetB2B.addRow({
        gstin: b.partyGstin || 'UNREGISTERED',
        name: b.partyName || 'Cash',
        bno: b.bno,
        bdate: b.bdate,
        net: b.netTotal || 0,
        pos: b.partyStateCode || '00',
        gross: b.grossTotal || 0,
        cgst: b.cgst || 0,
        sgst: b.sgst || 0,
        igst: b.igst || 0
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setHeader(event, 'Content-Disposition', `attachment; filename="GSTR1_${firmGstin}_${startDate}.xlsx"`);

    return buffer;
  } catch (error: any) {
    console.error('Export GSTR1 Excel error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting GSTR1 Excel'
    });
  }
});
