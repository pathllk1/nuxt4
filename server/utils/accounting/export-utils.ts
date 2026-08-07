import ExcelJS from 'exceljs';
import Bill from '../../models/Bill';
import StockReg from '../../models/StockReg';
import Firm from '../../models/Firm';
import BankAccount from '../../models/BankAccount';
import FirmSettings from '../../models/FirmSettings';

// ── Colors & Styles Palette (matching excel-export.utils.ts) ─────────────────
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

const isServiceItem = (item: any): boolean => (item?.itemType || 'GOODS') === 'SERVICE';
const getEffectiveQty = (item: any): number => {
  const qty = parseFloat(item?.qty);
  if (Number.isFinite(qty) && qty > 0) return qty;
  return isServiceItem(item) ? 1 : 0;
};
const shouldShowQty = (item: any): boolean => !isServiceItem(item) || item?.showQty !== false;

const numberToWords = (num: number | undefined | null): string => {
  if (!num || isNaN(num)) return 'Rupees Zero Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertTens = (n: number): string => {
    const v = Math.floor(n);
    if (v < 10) return ones[v] || '';
    if (v < 20) return teens[v - 10] || '';
    let s = tens[Math.floor(v / 10)] || '';
    if (v % 10 > 0) s += ' ' + (ones[v % 10] || '');
    return s;
  };

  const convertHundreds = (n: number): string => {
    const v = Math.floor(n);
    if (v > 99) return ones[Math.floor(v / 100)] + ' Hundred ' + convertTens(v % 100);
    return convertTens(v);
  };

  const absNum = Math.abs(Number(num));
  const wholePart = Math.floor(absNum);
  const decimalPart = Math.round((absNum - wholePart) * 100);

  if (wholePart === 0 && decimalPart === 0) return 'Rupees Zero Only';

  let result = 'Rupees ';
  let tmp = wholePart;

  if (tmp >= 10000000) { result += convertHundreds(Math.floor(tmp / 10000000)) + ' Crore '; tmp %= 10000000; }
  if (tmp >= 100000) { result += convertHundreds(Math.floor(tmp / 100000)) + ' Lakh '; tmp %= 100000; }
  if (tmp >= 1000) { result += convertHundreds(Math.floor(tmp / 1000)) + ' Thousand '; tmp %= 1000; }
  if (tmp > 0) result += convertHundreds(tmp);
  if (decimalPart > 0) result += ' and ' + convertTens(decimalPart) + ' Paise ';

  return result.trim() + ' Only';
};

const getInvoiceTypeLabel = (btype: string): string => {
  switch ((btype || 'SALES').toUpperCase()) {
    case 'SALES': return 'TAX INVOICE';
    case 'PURCHASE': return 'PURCHASE INVOICE';
    case 'CREDIT_NOTE': return 'CREDIT NOTE';
    case 'DEBIT_NOTE': return 'DEBIT NOTE';
    default: return btype.toUpperCase();
  }
};

const getBillType = (bill: any): 'intra-state' | 'inter-state' => {
  const src = (bill.billSubtype || '').toLowerCase();
  if (src.includes('intra')) return 'intra-state';
  if (src.includes('inter')) return 'inter-state';
  return (Number(bill.cgst) > 0 || Number(bill.sgst) > 0) ? 'intra-state' : 'inter-state';
};

const buildHsnSummary = (bill: any, items: any[], otherCharges: any[], gstEnabled: boolean) => {
  const hsnMap = new Map<string, any>();
  const billType = getBillType(bill);

  items.forEach((item: any) => {
    const hsn = item.hsn || 'NA';
    const taxableValue = getEffectiveQty(item) * (item.rate || 0) * (1 - (item.disc || 0) / 100);
    const taxAmount = taxableValue * (item.grate || 0) / 100;

    if (!hsnMap.has(hsn)) hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
    const row = hsnMap.get(hsn)!;
    row.taxableValue += taxableValue;
    if (gstEnabled) {
      row.totalTax += taxAmount;
      if (billType === 'intra-state') { row.cgst += taxAmount / 2; row.sgst += taxAmount / 2; }
      else { row.igst += taxAmount; }
    }
  });

  otherCharges.forEach((charge: any) => {
    const hsn = charge.hsnSac || '9999';
    const taxableValue = charge.amount || 0;
    const taxAmount = charge.gstAmount || ((charge.grate || charge.gstRate || 0) * taxableValue / 100);

    if (!hsnMap.has(hsn)) hsnMap.set(hsn, { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });
    const row = hsnMap.get(hsn)!;
    row.taxableValue += taxableValue;
    if (gstEnabled) {
      row.totalTax += taxAmount;
      if (billType === 'intra-state') { row.cgst += taxAmount / 2; row.sgst += taxAmount / 2; }
      else { row.igst += taxAmount; }
    }
  });

  return Array.from(hsnMap.values()).sort((a, b) => a.hsn.localeCompare(b.hsn));
};

const isGstEnabled = async (firmId: string): Promise<boolean> => {
  try {
    const firmSetting = await FirmSettings.findOne({ firmId, settingKey: 'gst_enabled' }).lean();
    if (firmSetting) return (firmSetting as any).settingValue === 'true';
    return true;
  } catch {
    return true;
  }
};

const resolveDefaultBankDetails = async (firmId: string, firm: any) => {
  try {
    const defaultBank = await BankAccount.findOne({
      $or: [{ firmId }, { firm_id: firmId }],
      is_default: true,
      status: 'ACTIVE',
    }).select('account_name account_holder_name bank_name branch_name account_number ifsc_code upi_id').lean();

    if (defaultBank) return defaultBank;

    if (firm?.bank_account_number || firm?.bank_name || firm?.ifsc_code || firm?.bank_branch) {
      return {
        account_name: firm.bank_name || 'Default Bank Account',
        account_holder_name: firm.name || '',
        bank_name: firm.bank_name || '',
        branch_name: firm.bank_branch || '',
        account_number: firm.bank_account_number || '',
        ifsc_code: firm.ifsc_code || '',
        upi_id: null,
      };
    }
    return null;
  } catch {
    return null;
  }
};

function formatCurrencyCell(cell: ExcelJS.Cell) {
  cell.numFmt = '₹#,##0.00;[Red](₹#,##0.00);"—"';
}

function borderRange(ws: ExcelJS.Worksheet, startRow: number, startCol: number, endRow: number, endCol: number) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c);
      const cellBorder: any = {};
      if (r === startRow) cellBorder.top = { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } };
      if (r === endRow) cellBorder.bottom = { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } };
      if (c === startCol) cellBorder.left = { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } };
      if (c === endCol) cellBorder.right = { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } };
      cell.border = cellBorder;
    }
  }
}

// ── Single Bill Exporter ──────────────────────────────────────────────────────

export async function exportSingleBillToExcel(bill: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Invoice');
  ws.views = [{ showGridLines: true }];

  const billObj = typeof bill.toObject === 'function' ? bill.toObject() : bill;
  const firmId = billObj.firmId || billObj.firm_id;

  let refBill: any = null;
  if (billObj.refBillId) {
    refBill = await Bill.findById(billObj.refBillId).select('bno bdate').lean();
  }

  let items: any[] = billObj.items && billObj.items.length > 0
    ? billObj.items
    : await StockReg.find({ billId: billObj._id }).lean();

  const otherCharges: any[] = Array.isArray(billObj.otherCharges) ? billObj.otherCharges : [];

  const firm = await Firm.findById(firmId).lean();
  if (!firm) throw new Error('Firm not found');

  const gstEnabled = await isGstEnabled(String(firmId));
  const bankDetails = await resolveDefaultBankDetails(String(firmId), firm);

  const firmGstin = billObj.firmGstin || firm.gst_number || '';
  const seller = {
    name: firm.name || 'Company Name',
    address: firm.address || '',
    gstin: firmGstin,
  };

  const btype = billObj.btype || 'SALES';
  const billType = getBillType(billObj);
  const hsnSummary = buildHsnSummary(billObj, items, otherCharges, gstEnabled);
  const isPurchase = btype.toUpperCase() === 'PURCHASE';

  const formattedBuyerAddress = [billObj.partyAddress, billObj.partyPin ? `PIN: ${billObj.partyPin}` : '']
    .filter(Boolean).join(', ');

  const rightBoxName = isPurchase ? seller.name : (billObj.consigneeName || '');
  const rightBoxAddr = isPurchase
    ? seller.address
    : (billObj.consigneeAddress
      ? [billObj.consigneeAddress, billObj.consigneePin ? `PIN: ${billObj.consigneePin}` : ''].filter(Boolean).join(', ')
      : formattedBuyerAddress);
  const rightBoxState = isPurchase ? '' : (billObj.consigneeState || billObj.partyState || '');
  const rightBoxGstin = isPurchase ? seller.gstin : (billObj.consigneeGstin || billObj.partyGstin || '');

  const taxableValue = billObj.grossTotal || 0;
  const totalTax = gstEnabled ? ((billObj.cgst || 0) + (billObj.sgst || 0) + (billObj.igst || 0)) : 0;
  const roundedGrandTotal = billObj.netTotal || (gstEnabled ? Math.round(taxableValue + totalTax) : Math.round(taxableValue));
  const roundOff = billObj.roundOff || 0;

  ws.columns = [
    { key: 'colA', width: 6 },   // #
    { key: 'colB', width: 35 },  // Description
    { key: 'colC', width: 12 },  // HSN/SAC
    { key: 'colD', width: 10 },  // Qty
    { key: 'colE', width: 8 },   // UOM
    { key: 'colF', width: 12 },  // Rate
    { key: 'colG', width: 10 },  // Disc %
    { key: 'colH', width: 10 },  // GST %
    { key: 'colI', width: 16 },  // Amount
  ];

  const titleRow = ws.getRow(1);
  ws.mergeCells('A1:I1');
  const titleCell = titleRow.getCell(1);
  titleCell.value = getInvoiceTypeLabel(btype);
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.navy } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 36;

  const subTitleRow = ws.getRow(2);
  ws.mergeCells('A2:I2');
  const subTitleCell = subTitleRow.getCell(1);
  subTitleCell.value = gstEnabled ? 'TAX INVOICE UNDER GST' : 'INVOICE (GST DISABLED)';
  subTitleCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
  subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subTitleRow.height = 18;

  ws.getRow(3).height = 10;

  const secHdrRow = ws.getRow(4);
  ws.mergeCells('A4:D4');
  ws.mergeCells('F4:I4');
  secHdrRow.getCell(1).value = 'SELLER / ISSUER DETAILS';
  secHdrRow.getCell(6).value = 'DOCUMENT DETAILS';
  [1, 6].forEach(col => {
    const cell = secHdrRow.getCell(col);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.navy } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.grayBg } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  });
  secHdrRow.height = 20;

  const writeDetailRow = (rowNum: number, leftLabel: string, leftVal: string, rightLabel: string, rightVal: string) => {
    const row = ws.getRow(rowNum);
    ws.mergeCells(`A${rowNum}:D${rowNum}`);
    ws.mergeCells(`F${rowNum}:G${rowNum}`);
    ws.mergeCells(`H${rowNum}:I${rowNum}`);
    
    row.getCell(1).value = leftLabel + leftVal;
    row.getCell(1).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF' + COLORS.slateDark } };
    
    row.getCell(6).value = rightLabel;
    row.getCell(6).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + COLORS.slateDark } };
    
    row.getCell(8).value = rightVal;
    row.getCell(8).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF' + COLORS.slateDark } };
    row.height = 18;
  };

  writeDetailRow(5, 'Company: ', seller.name, 'Invoice No:', billObj.bno || '');
  writeDetailRow(6, 'Address: ', seller.address, 'Date:', formatDate(billObj.bdate));
  writeDetailRow(7, 'GSTIN: ', seller.gstin, isPurchase ? 'Purchase Ref No:' : 'PO / Reference No:', billObj.orderNo || 'N/A');
  writeDetailRow(8, '', '', 'Vehicle No:', billObj.vehicleNo || 'N/A');
  writeDetailRow(9, '', '', 'Dispatch Via:', billObj.dispatchThrough || 'N/A');

  let currentMetaOffset = 10;
  if (refBill) {
    writeDetailRow(currentMetaOffset, '', '', 'Original Bill No:', refBill.bno || 'N/A');
    currentMetaOffset++;
    writeDetailRow(currentMetaOffset, '', '', 'Original Date:', formatDate(refBill.bdate));
    currentMetaOffset++;
  }

  borderRange(ws, 4, 1, currentMetaOffset - 1, 4);
  borderRange(ws, 4, 6, currentMetaOffset - 1, 9);

  currentMetaOffset++;

  const partyHdrRow = ws.getRow(currentMetaOffset);
  ws.mergeCells(`A${currentMetaOffset}:D${currentMetaOffset}`);
  ws.mergeCells(`F${currentMetaOffset}:I${currentMetaOffset}`);
  partyHdrRow.getCell(1).value = isPurchase ? 'BILL FROM (SUPPLIER)' : 'BILL TO (BUYER)';
  partyHdrRow.getCell(6).value = isPurchase ? 'BILL TO (RECEIVER)' : 'SHIP TO (CONSIGNEE)';
  [1, 6].forEach(col => {
    const cell = partyHdrRow.getCell(col);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.navy } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.grayBg } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  });
  partyHdrRow.height = 20;

  const partyStartRow = currentMetaOffset;
  currentMetaOffset++;

  const writePartyRow = (rowNum: number, leftVal: string, rightVal: string, isBold: boolean = false) => {
    const row = ws.getRow(rowNum);
    ws.mergeCells(`A${rowNum}:D${rowNum}`);
    ws.mergeCells(`F${rowNum}:I${rowNum}`);
    row.getCell(1).value = leftVal;
    row.getCell(1).font = { name: 'Segoe UI', size: 9, bold: isBold, color: { argb: 'FF' + COLORS.slateDark } };
    row.getCell(6).value = rightVal;
    row.getCell(6).font = { name: 'Segoe UI', size: 9, bold: isBold, color: { argb: 'FF' + COLORS.slateDark } };
    row.height = 18;
  };

  writePartyRow(currentMetaOffset, billObj.partyName || '', rightBoxName, true);
  currentMetaOffset++;
  writePartyRow(currentMetaOffset, formattedBuyerAddress, rightBoxAddr);
  currentMetaOffset++;
  writePartyRow(currentMetaOffset, billObj.partyState ? `State: ${billObj.partyState}` : '', rightBoxState ? `State: ${rightBoxState}` : '');
  currentMetaOffset++;
  writePartyRow(currentMetaOffset, billObj.partyGstin ? `GSTIN: ${billObj.partyGstin}` : '', rightBoxGstin ? `GSTIN: ${rightBoxGstin}` : '');
  
  borderRange(ws, partyStartRow, 1, currentMetaOffset, 4);
  borderRange(ws, partyStartRow, 6, currentMetaOffset, 9);

  currentMetaOffset += 2;

  const itemsHeaderRow = ws.getRow(currentMetaOffset);
  itemsHeaderRow.values = [
    '#',
    'Description of Goods / Services',
    'HSN/SAC',
    'Qty',
    'UOM',
    'Rate (₹)',
    'Disc%',
    'GST%',
    'Amount (₹)'
  ];
  itemsHeaderRow.height = 24;
  itemsHeaderRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.navy } };
    cell.alignment = {
      horizontal: colIndex === 1 || colIndex === 3 || colIndex === 4 || colIndex === 5 ? 'center' : (colIndex === 2 ? 'left' : 'right'),
      vertical: 'middle'
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
      bottom: { style: 'medium', color: { argb: COLORS.slateDark } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
    };
  });
  
  let currentRowNum = currentMetaOffset + 1;

  items.forEach((it: any, idx: number) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;
    
    const itemRow = ws.getRow(currentRowNum);
    itemRow.getCell(1).value = idx + 1;
    itemRow.getCell(2).value = it.item || '';
    itemRow.getCell(3).value = it.hsn || '';
    itemRow.getCell(4).value = shouldShowQty(it) ? parseFloat(it.qty) : '';
    itemRow.getCell(5).value = shouldShowQty(it) ? (it.uom || '') : '';
    itemRow.getCell(6).value = it.rate || 0;
    itemRow.getCell(7).value = (it.disc || 0) / 100;
    itemRow.getCell(8).value = gstEnabled ? (it.grate || 0) / 100 : 0;
    itemRow.getCell(9).value = it.total || 0;
    
    itemRow.height = 20;
    itemRow.eachCell((cell, colIndex) => {
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF' + COLORS.slateDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      
      if (colIndex === 1 || colIndex === 3 || colIndex === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIndex === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (colIndex === 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.numFmt = '0.00';
      } else if (colIndex === 6 || colIndex === 9) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        formatCurrencyCell(cell);
      } else if (colIndex === 7 || colIndex === 8) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '0.00%';
      }
    });
    
    currentRowNum++;
    
    const extraDetails: string[] = [];
    if (!isServiceItem(it) && it.batch) extraDetails.push(`Batch: ${it.batch}`);
    if (it.narration || it.itemNarration) extraDetails.push(it.narration || it.itemNarration);
    
    if (extraDetails.length > 0) {
      const detailRow = ws.getRow(currentRowNum);
      ws.mergeCells(`B${currentRowNum}:I${currentRowNum}`);
      detailRow.getCell(2).value = extraDetails.join(' | ');
      detailRow.height = 16;
      detailRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 8, italic: true, color: { argb: 'FF64748B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
      currentRowNum++;
    }
  });

  otherCharges.forEach((ch: any, idx: number) => {
    const itemIdx = items.length + idx;
    const isEven = itemIdx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;
    
    const chRow = ws.getRow(currentRowNum);
    chRow.getCell(1).value = itemIdx + 1;
    chRow.getCell(2).value = ch.name || ch.type || 'Other Charge';
    chRow.getCell(3).value = ch.hsnSac || '';
    chRow.getCell(4).value = 1;
    chRow.getCell(5).value = 'NOS';
    chRow.getCell(6).value = ch.amount || 0;
    chRow.getCell(7).value = 0;
    chRow.getCell(8).value = gstEnabled ? (ch.grate || ch.gstRate || 0) / 100 : 0;
    chRow.getCell(9).value = ch.amount || 0;
    
    chRow.height = 20;
    chRow.eachCell((cell, colIndex) => {
      cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF' + COLORS.slateDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      
      if (colIndex === 1 || colIndex === 3 || colIndex === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIndex === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (colIndex === 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.numFmt = '0.00';
      } else if (colIndex === 6 || colIndex === 9) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        formatCurrencyCell(cell);
      } else if (colIndex === 7 || colIndex === 8) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '0.00%';
      }
    });
    
    currentRowNum++;
  });

  const tableEndRow = ws.getRow(currentRowNum - 1);
  for (let col = 1; col <= 9; col++) {
    const cell = tableEndRow.getCell(col);
    const curBorder = cell.border || {};
    cell.border = {
      ...curBorder,
      bottom: { style: 'medium', color: { argb: COLORS.navy } }
    };
  }

  currentRowNum++;

  if (gstEnabled && hsnSummary.length > 0) {
    const hsnHeaderRow = ws.getRow(currentRowNum);
    hsnHeaderRow.getCell(1).value = 'HSN/SAC TAX SUMMARY';
    hsnHeaderRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.navy } };
    ws.mergeCells(`A${currentRowNum}:I${currentRowNum}`);
    currentRowNum++;
    
    const hsnSubHeader = ws.getRow(currentRowNum);
    hsnSubHeader.values = [
      'HSN/SAC',
      'Taxable Value',
      'CGST Rate',
      'CGST Amount',
      'SGST Rate',
      'SGST Amount',
      'IGST Rate',
      'IGST Amount',
      'Total Tax'
    ];
    hsnSubHeader.height = 20;
    hsnSubHeader.eachCell((cell, colIndex) => {
      cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.navy } };
      cell.alignment = {
        horizontal: colIndex === 1 ? 'center' : 'right',
        vertical: 'middle'
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
        bottom: { style: 'thin', color: { argb: COLORS.slateDark } },
        left: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
        right: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
      };
    });
    currentRowNum++;
    
    hsnSummary.forEach((row: any, idx: number) => {
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;
      
      const r = ws.getRow(currentRowNum);
      const totalTaxRate = row.taxableValue > 0 ? (row.totalTax / row.taxableValue) * 100 : 0;
      const cgstRate = billType === 'intra-state' ? totalTaxRate / 2 : 0;
      const sgstRate = billType === 'intra-state' ? totalTaxRate / 2 : 0;
      const igstRate = billType === 'inter-state' ? totalTaxRate : 0;
      
      r.getCell(1).value = row.hsn;
      r.getCell(2).value = row.taxableValue;
      r.getCell(3).value = billType === 'intra-state' ? cgstRate / 100 : 0;
      r.getCell(4).value = billType === 'intra-state' ? row.cgst : 0;
      r.getCell(5).value = billType === 'intra-state' ? sgstRate / 100 : 0;
      r.getCell(6).value = billType === 'intra-state' ? row.sgst : 0;
      r.getCell(7).value = billType === 'inter-state' ? igstRate / 100 : 0;
      r.getCell(8).value = billType === 'inter-state' ? row.igst : 0;
      r.getCell(9).value = row.totalTax;
      
      r.height = 18;
      r.eachCell((cell, colIndex) => {
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF' + COLORS.slateDark } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        
        if (colIndex === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colIndex === 3 || colIndex === 5 || colIndex === 7) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '0.00%';
        } else {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          formatCurrencyCell(cell);
        }
      });
      
      currentRowNum++;
    });
    
    const hsnEndRow = ws.getRow(currentRowNum - 1);
    for (let col = 1; col <= 9; col++) {
      const cell = hsnEndRow.getCell(col);
      const curBorder = cell.border || {};
      cell.border = {
        ...curBorder,
        bottom: { style: 'medium', color: { argb: COLORS.navy } }
      };
    }
    
    currentRowNum++;
  }

  const startFooterRow = currentRowNum;
  const totals: { label: string; value: number; isBold?: boolean; isDoubleBottom?: boolean }[] = [
    { label: 'Taxable Value', value: taxableValue },
  ];
  if (gstEnabled) {
    if (billType === 'intra-state') {
      totals.push({ label: 'Add: CGST', value: billObj.cgst || 0 });
      totals.push({ label: 'Add: SGST', value: billObj.sgst || 0 });
    } else {
      totals.push({ label: 'Add: IGST', value: billObj.igst || 0 });
    }
    totals.push({ label: 'Total Tax', value: totalTax });
  }
  totals.push({ label: 'Round Off', value: roundOff });
  totals.push({ label: 'GRAND TOTAL', value: roundedGrandTotal, isBold: true, isDoubleBottom: true });

  totals.forEach((t, index) => {
    const rNum = startFooterRow + index;
    const r = ws.getRow(rNum);
    ws.mergeCells(`G${rNum}:H${rNum}`);
    
    r.getCell(7).value = t.label;
    r.getCell(7).font = { name: 'Segoe UI', size: 9.5, bold: t.isBold, color: { argb: t.isBold ? 'FF' + COLORS.navy : 'FF' + COLORS.slateDark } };
    r.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    
    r.getCell(9).value = t.value;
    r.getCell(9).font = { name: 'Segoe UI', size: 9.5, bold: t.isBold, color: { argb: t.isBold ? 'FF' + COLORS.navy : 'FF' + COLORS.slateDark } };
    r.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    formatCurrencyCell(r.getCell(9));
    
    const topStyle: ExcelJS.BorderStyle | undefined = t.isBold ? 'thin' : undefined;
    const bottomStyle: ExcelJS.BorderStyle | undefined = t.isDoubleBottom ? 'double' : (t.isBold ? 'thin' : undefined);
    
    r.getCell(7).border = {
      top: topStyle ? { style: topStyle, color: { argb: 'FF' + COLORS.slateBorder } } : undefined,
      bottom: bottomStyle ? { style: bottomStyle, color: { argb: bottomStyle === 'double' ? COLORS.navy : 'FF' + COLORS.slateBorder } } : undefined,
    };
    r.getCell(8).border = r.getCell(7).border;
    r.getCell(9).border = {
      top: topStyle ? { style: topStyle, color: { argb: 'FF' + COLORS.slateBorder } } : undefined,
      bottom: bottomStyle ? { style: bottomStyle, color: { argb: bottomStyle === 'double' ? COLORS.navy : 'FF' + COLORS.slateBorder } } : undefined,
    };
    
    r.height = 20;
  });

  const wRow1 = ws.getRow(startFooterRow);
  ws.mergeCells(`A${startFooterRow}:E${startFooterRow}`);
  wRow1.getCell(1).value = 'AMOUNT IN WORDS';
  wRow1.getCell(1).font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF' + COLORS.navy } };

  const wRow2 = ws.getRow(startFooterRow + 1);
  ws.mergeCells(`A${startFooterRow + 1}:E${startFooterRow + 2}`);
  wRow2.getCell(1).value = numberToWords(roundedGrandTotal);
  wRow2.getCell(1).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + COLORS.slateDark } };
  wRow2.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  wRow2.height = 18;
  ws.getRow(startFooterRow + 2).height = 18;

  let currentLeftOffset = 3;

  if (billObj.narration) {
    const nRowHdr = ws.getRow(startFooterRow + currentLeftOffset);
    ws.mergeCells(`A${startFooterRow + currentLeftOffset}:E${startFooterRow + currentLeftOffset}`);
    nRowHdr.getCell(1).value = 'NARRATION';
    nRowHdr.getCell(1).font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF' + COLORS.navy } };
    nRowHdr.height = 16;
    currentLeftOffset++;
    
    const nRowVal = ws.getRow(startFooterRow + currentLeftOffset);
    ws.mergeCells(`A${startFooterRow + currentLeftOffset}:E${startFooterRow + currentLeftOffset}`);
    nRowVal.getCell(1).value = billObj.narration;
    nRowVal.getCell(1).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF' + COLORS.slateDark } };
    nRowVal.height = 16;
    currentLeftOffset++;
  }

  if (bankDetails) {
    const bRowHdr = ws.getRow(startFooterRow + currentLeftOffset);
    ws.mergeCells(`A${startFooterRow + currentLeftOffset}:E${startFooterRow + currentLeftOffset}`);
    bRowHdr.getCell(1).value = 'BANK DETAILS';
    bRowHdr.getCell(1).font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF' + COLORS.navy } };
    bRowHdr.height = 16;
    currentLeftOffset++;
    
    const bRowVal1 = ws.getRow(startFooterRow + currentLeftOffset);
    ws.mergeCells(`A${startFooterRow + currentLeftOffset}:E${startFooterRow + currentLeftOffset}`);
    bRowVal1.getCell(1).value = `A/C Name: ${bankDetails.account_holder_name || bankDetails.account_name || '-'} | A/C No: ${bankDetails.account_number || '-'}`;
    bRowVal1.getCell(1).font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF' + COLORS.slateDark } };
    bRowVal1.height = 16;
    currentLeftOffset++;
    
    const bRowVal2 = ws.getRow(startFooterRow + currentLeftOffset);
    ws.mergeCells(`A${startFooterRow + currentLeftOffset}:E${startFooterRow + currentLeftOffset}`);
    bRowVal2.getCell(1).value = `Bank: ${bankDetails.bank_name || '-'} | Branch: ${bankDetails.branch_name || '-'} | IFSC: ${bankDetails.ifsc_code || '-'}`;
    bRowVal2.getCell(1).font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF' + COLORS.slateDark } };
    bRowVal2.height = 16;
    currentLeftOffset++;
  }

  const leftBlockEndRow = startFooterRow + currentLeftOffset - 1;
  borderRange(ws, startFooterRow, 1, leftBlockEndRow, 5);

  currentRowNum = Math.max(startFooterRow + totals.length, startFooterRow + currentLeftOffset) + 2;
  const sigStartRow = currentRowNum;

  const termsHdr = ws.getRow(sigStartRow);
  ws.mergeCells(`A${sigStartRow}:E${sigStartRow}`);
  termsHdr.getCell(1).value = 'TERMS & CONDITIONS';
  termsHdr.getCell(1).font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: 'FF' + COLORS.navy } };

  ws.mergeCells(`G${sigStartRow}:I${sigStartRow}`);
  termsHdr.getCell(7).value = `For ${seller.name}`;
  termsHdr.getCell(7).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + COLORS.slateDark } };
  termsHdr.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
  termsHdr.height = 18;

  const terms = [
    isPurchase ? '1. Subject to mutually agreed payment terms.' : '1. Goods once sold will not be taken back.',
    '2. Subject to local jurisdiction only.',
    '3. E. & O.E.'
  ];

  terms.forEach((term, index) => {
    const rNum = sigStartRow + 1 + index;
    const r = ws.getRow(rNum);
    ws.mergeCells(`A${rNum}:E${rNum}`);
    r.getCell(1).value = term;
    r.getCell(1).font = { name: 'Segoe UI', size: 8, color: { argb: 'FF' + COLORS.slateBorder } };
    r.height = 15;
  });

  const sigLineRow = sigStartRow + 6;
  ws.mergeCells(`A${sigLineRow}:E${sigLineRow}`);
  ws.mergeCells(`G${sigLineRow}:I${sigLineRow}`);

  const rSig = ws.getRow(sigLineRow);
  rSig.getCell(1).value = isPurchase ? 'Authorised Signatory' : "Receiver's Signature";
  rSig.getCell(1).font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF' + COLORS.slateDark } };
  rSig.getCell(1).alignment = { vertical: 'bottom' };

  rSig.getCell(7).value = 'Authorised Signatory';
  rSig.getCell(7).font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF' + COLORS.slateDark } };
  rSig.getCell(7).alignment = { horizontal: 'right', vertical: 'bottom' };
  rSig.height = 40;

  const dottedLineRow = sigStartRow + 5;
  const rDot = ws.getRow(dottedLineRow);
  ws.mergeCells(`A${dottedLineRow}:E${dottedLineRow}`);
  ws.mergeCells(`G${dottedLineRow}:I${dottedLineRow}`);
  rDot.getCell(1).value = '...................................................';
  rDot.getCell(1).font = { name: 'Segoe UI', size: 8, color: { argb: 'FF' + COLORS.slateBorder } };
  rDot.getCell(1).alignment = { vertical: 'bottom' };

  rDot.getCell(7).value = '...................................................';
  rDot.getCell(7).font = { name: 'Segoe UI', size: 8, color: { argb: 'FF' + COLORS.slateBorder } };
  rDot.getCell(7).alignment = { horizontal: 'right', vertical: 'bottom' };
  rDot.height = 15;

  borderRange(ws, sigStartRow, 1, sigLineRow, 5);
  borderRange(ws, sigStartRow, 6, sigLineRow, 9);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Multi-Bill List Exporter ─────────────────────────────────────────────────

export async function exportBillsToExcel(bills: any[]): Promise<Buffer> {
  if (bills.length === 1) {
    return await exportSingleBillToExcel(bills[0]);
  }

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

// ── Stock Movements Exporter ─────────────────────────────────────────────────

export async function exportStockMovementsToExcel(movements: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Stock Movements');

  wsColumns(worksheet);

  movements.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;
    
    const wsRow = worksheet.addRow({
      date: formatDate(row.bdate || row.createdAt),
      type: row.type || row.movementType || '',
      billNo: row.bno || row.billNo || '',
      item: row.item || row.itemName || '',
      batch: row.batch || row.batchNo || '',
      quantity: row.qty || row.quantity || 0,
      uom: row.uom || '',
      rate: row.rate || 0,
      total: row.total || row.amount || 0,
      party: row.supply || row.partyName || ''
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
