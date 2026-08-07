import { defineEventHandler, getQuery, setHeader, createError } from 'h3';
import ExcelJS from 'exceljs';
import Stock from '../../../models/Stock';
import Firm from '../../../models/Firm';
import { requireAuthSession } from '../../../utils/auth';
import { createPdfBufferFromDocDef } from '../../../utils/accounting/pdf-export.utils';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const query = getQuery(event);
    const format = String(query.format || 'excel').toLowerCase();

    const stocks = await Stock.find({
      $or: [{ firmId: session.firm_id }, { firm_id: session.firm_id as any }]
    }).sort({ item: 1 }).lean();

    const firm = await Firm.findById(session.firm_id).lean();
    const firmName = (firm as any)?.name || 'Company';

    if (format === 'pdf') {
      const docDefinition: any = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [30, 30, 30, 30],
        defaultStyle: { font: 'DejaVuSans', fontSize: 8.5 },
        content: [
          { text: firmName.toUpperCase(), fontSize: 13, bold: true, alignment: 'center' },
          { text: 'INVENTORY VALUATION & STOCK REGISTER', fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 10] },
          {
            table: {
              headerRows: 1,
              widths: [20, '*', 70, 70, 50, 60, 50, 75],
              body: [
                [
                  { text: '#', bold: true },
                  { text: 'Item Description', bold: true },
                  { text: 'Part No', bold: true },
                  { text: 'HSN/SAC', bold: true, alignment: 'center' },
                  { text: 'Qty', bold: true, alignment: 'right' },
                  { text: 'UOM', bold: true, alignment: 'center' },
                  { text: 'Rate (₹)', bold: true, alignment: 'right' },
                  { text: 'Total Value (₹)', bold: true, alignment: 'right' }
                ],
                ...stocks.map((st: any, idx: number) => [
                  idx + 1,
                  st.item || '',
                  st.pno || '-',
                  { text: st.hsn || '', alignment: 'center' },
                  { text: (st.qty || 0).toFixed(2), alignment: 'right' },
                  { text: st.uom || 'PCS', alignment: 'center' },
                  { text: (st.rate || 0).toFixed(2), alignment: 'right' },
                  { text: ((st.qty || 0) * (st.rate || 0)).toFixed(2), alignment: 'right', bold: true }
                ]),
                [
                  { text: 'TOTAL VALUATION', colSpan: 7, bold: true, alignment: 'right' },
                  {}, {}, {}, {}, {}, {},
                  { text: stocks.reduce((sum, s: any) => sum + ((s.qty || 0) * (s.rate || 0)), 0).toFixed(2), bold: true, alignment: 'right' }
                ]
              ]
            }
          }
        ]
      };

      const pdfBuffer = await createPdfBufferFromDocDef(docDefinition);
      setHeader(event, 'Content-Type', 'application/pdf');
      setHeader(event, 'Content-Disposition', 'attachment; filename="Stock_Valuation.pdf"');
      return pdfBuffer;
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Stock Register');

    ws.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: 'Item Description', key: 'item', width: 30 },
      { header: 'Part No', key: 'pno', width: 15 },
      { header: 'OEM', key: 'oem', width: 15 },
      { header: 'HSN/SAC', key: 'hsn', width: 12 },
      { header: 'Quantity', key: 'qty', width: 12 },
      { header: 'UOM', key: 'uom', width: 10 },
      { header: 'Rate (₹)', key: 'rate', width: 14 },
      { header: 'GST %', key: 'grate', width: 10 },
      { header: 'Valuation Amount (₹)', key: 'total', width: 20 },
    ];

    stocks.forEach((st: any, idx: number) => {
      ws.addRow({
        idx: idx + 1,
        item: st.item || '',
        pno: st.pno || '',
        oem: st.oem || '',
        hsn: st.hsn || '',
        qty: st.qty || 0,
        uom: st.uom || 'PCS',
        rate: st.rate || 0,
        grate: st.grate || 0,
        total: (st.qty || 0) * (st.rate || 0)
      });
    });

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

    const buffer = await workbook.xlsx.writeBuffer();
    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setHeader(event, 'Content-Disposition', 'attachment; filename="Stock_Valuation.xlsx"');
    return Buffer.from(buffer);
  } catch (error: any) {
    console.error('Stock export error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting stock register'
    });
  }
});
