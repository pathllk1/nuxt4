import ExcelJS from 'exceljs';

// ── Colors & Styles Palette ───────────────────────────────────────────────────
const COLORS = {
  navy: '1E3A8A',       // Primary Header
  slateDark: '0F172A',  // Title / Dark Text
  slateBorder: 'CBD5E1',// Borders
  slateLight: 'F8FAFC', // Alternating row bg
  grayBg: 'F1F5F9',     // Group / Sub-total bg
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (dateString: string | Date | undefined | null): string => {
  if (!dateString) return '';
  try {
    const s = String(dateString);
    const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  } catch {
    return String(dateString);
  }
};

const formatCurrencyCell = (cell: ExcelJS.Cell) => {
  cell.numFmt = '₹#,##0.00;[Red](₹#,##0.00);"—"';
};

export async function exportBillsToExcel(bills: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Bills');

  worksheet.addRow(['Bill No', 'Supplier Bill No', 'Date', 'Party', 'Type', 'Taxable Amount', 'Tax Amount', 'Total Amount', 'Status']);

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.navy } };
  headerRow.eachCell(cell => {
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  bills.forEach((bill, idx) => {
    const totalTax = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0);
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;
    
    const row = worksheet.addRow([
      bill.bno || '',
      bill.supplierBillNo || '',
      formatDate(bill.bdate),
      bill.partyName || bill.supply || '',
      bill.btype || 'SALES',
      bill.grossTotal || 0,
      totalTax,
      bill.netTotal || 0,
      bill.status || 'ACTIVE',
    ]);
    row.eachCell((cell, colIndex) => {
      cell.border = { top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } }, left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } }, bottom: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } }, right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF' + COLORS.slateDark } };
      
      if (colIndex === 3) {
        cell.alignment = { horizontal: 'center' };
      } else if (colIndex === 6 || colIndex === 7 || colIndex === 8) {
        cell.alignment = { horizontal: 'right' };
        formatCurrencyCell(cell);
      }
    });
  });

  worksheet.columns.forEach(col => { col.width = 16; });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportStockMovementsToExcel(movements: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Stock Movements');

  wsColumns(worksheet);

  movements.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;
    
    const wsRow = worksheet.addRow({
      date: formatDate(row.bdate),
      type: row.type || '',
      billNo: row.bno || '',
      item: row.item || '',
      batch: row.batch || '',
      quantity: row.qty || 0,
      uom: row.uom || '',
      rate: row.rate || 0,
      total: row.total || 0,
      party: row.supply || ''
    });
    
    wsRow.eachCell((cell, colIndex) => {
      cell.border = { top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } }, left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } }, bottom: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } }, right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF' + COLORS.slateDark } };
      
      if (colIndex === 1 || colIndex === 3) {
        cell.alignment = { horizontal: 'center' };
      } else if (colIndex === 6 || colIndex === 8 || colIndex === 9) {
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  styleHeader(worksheet);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function wsColumns(ws: ExcelJS.Worksheet) {
  ws.columns = [
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Bill No', key: 'billNo', width: 15 },
    { header: 'Item', key: 'item', width: 30 },
    { header: 'Batch', key: 'batch', width: 15 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'UOM', key: 'uom', width: 10 },
    { header: 'Rate', key: 'rate', width: 12 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Party', key: 'party', width: 25 },
  ];
  ws.getColumn('quantity').numFmt = '0.00';
  ws.getColumn('rate').numFmt = '₹#,##0.00;[Red](₹#,##0.00);"—"';
  ws.getColumn('total').numFmt = '₹#,##0.00;[Red](₹#,##0.00);"—"';
}

function styleHeader(ws: ExcelJS.Worksheet) {
  ws.getRow(1).height = 24;
  ws.getRow(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).eachCell(cell => {
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'medium', color: { argb: COLORS.slateDark } }, right: { style: 'thin' } };
  });
  ws.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];
}
