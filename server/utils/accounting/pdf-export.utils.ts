// @ts-ignore - pdfmake server-side entry point (uses filesystem fonts, not VFS)
import pdfMake from 'pdfmake';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import StockReg from '../../models/StockReg';
import Bill from '../../models/Bill';
import BankAccount from '../../models/BankAccount';
import FirmSettings from '../../models/FirmSettings';

const getFontPath = (fileName: string): string =>
  path.join(process.cwd(), 'fonts', fileName);

// Pre-flight check – warn at startup if fonts are missing
['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSans-Oblique.ttf', 'DejaVuSans-BoldOblique.ttf'].forEach(f => {
  const p = getFontPath(f);
  if (!fs.existsSync(p)) console.warn(`[PDF] Warning: Font file missing: ${p}`);
});

const fonts = {
  DejaVuSans: {
    normal: getFontPath('DejaVuSans.ttf'),
    bold: getFontPath('DejaVuSans-Bold.ttf'),
    italics: getFontPath('DejaVuSans-Oblique.ttf'),
    bolditalics: getFontPath('DejaVuSans-BoldOblique.ttf'),
  },
};

(pdfMake as any).setFonts(fonts);

// Silence pdfMake security warnings by setting explicit access policies
if (typeof (pdfMake as any).setUrlAccessPolicy === 'function') {
  (pdfMake as any).setUrlAccessPolicy(() => false);
}
if (typeof (pdfMake as any).setLocalAccessPolicy === 'function') {
  (pdfMake as any).setLocalAccessPolicy(() => true);
}

const C = {
  primary: '#0F172A',      // Crisp deep charcoal/black for titles & headers
  border: '#CBD5E1',       // Clean, crisp hairline border (0.5pt/1pt)
  borderDark: '#334155',   // Crisp solid outer boundary
  tableHdrBg: '#F8FAFC',   // Ultra-light 3-4% neutral background (100% ink-efficient)
  tableHdrText: '#0F172A', // Crisp bold dark text
  textDark: '#0F172A',     // Primary body text
  textMid: '#334155',      // Secondary meta labels
  textLight: '#64748B',    // Footnotes / small hints
  red: '#991B1B',
  green: '#059669',
};

const formatCurrency = (amount: number | undefined | null): string =>
  '\u20B9\u00A0' +
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(amount) || 0,
  );

const formatQuantity = (qty: number | undefined | null): string =>
  parseFloat(String(qty || 0)).toFixed(2);

const formatPercentage = (pct: number | undefined | null): string =>
  parseFloat(String(pct || 0)).toFixed(2) + '%';

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

export async function createPdfBufferFromDocDef(docDefinition: any): Promise<Buffer> {
  if (!docDefinition.defaultStyle) docDefinition.defaultStyle = {};
  if (!docDefinition.defaultStyle.font) docDefinition.defaultStyle.font = 'DejaVuSans';

  const doc = (pdfMake as any).createPdf(docDefinition);
  const stream = await doc.getStream();
  
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err: any) => reject(err));
    stream.end();
  });
}

export async function exportSingleBillToPdfBuffer(bill: any, firm: any, printConfig?: any): Promise<Buffer> {
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

  let gstEnabled = true;
  try {
    const firmSetting = await FirmSettings.findOne({ firmId, settingKey: 'gst_enabled' }).lean();
    if (firmSetting) gstEnabled = (firmSetting as any).settingValue === 'true';
  } catch {
    gstEnabled = true;
  }

  // Column flags from printConfig
  const showHsn = printConfig?.showHsn !== false && printConfig?.showHsn !== 'false';
  const showQty = printConfig?.showQty !== false && printConfig?.showQty !== 'false';
  const showUom = printConfig?.showUom !== false && printConfig?.showUom !== 'false';
  const showRate = printConfig?.showRate !== false && printConfig?.showRate !== 'false';
  const showDisc = printConfig?.showDisc !== false && printConfig?.showDisc !== 'false';
  const showGst = printConfig?.showGst !== false && printConfig?.showGst !== 'false';
  const showBatch = printConfig?.showBatch !== false && printConfig?.showBatch !== 'false';
  const showNarration = printConfig?.showNarration !== false && printConfig?.showNarration !== 'false';
  const showBank = printConfig?.showBank !== false && printConfig?.showBank !== 'false';
  const copyType = printConfig?.copyType || '';

  let bankDetails: any = null;
  if (showBank) {
    try {
      if (printConfig?.bankAccountId && mongoose.Types.ObjectId.isValid(printConfig.bankAccountId)) {
        bankDetails = await BankAccount.findById(printConfig.bankAccountId)
          .select('account_name account_holder_name bank_name branch_name account_number ifsc_code upi_id').lean();
      }

      if (!bankDetails) {
        bankDetails = await BankAccount.findOne({
          $or: [{ firmId }, { firm_id: firmId }],
          is_default: true,
          status: 'ACTIVE',
        }).select('account_name account_holder_name bank_name branch_name account_number ifsc_code upi_id').lean();
      }

      if (!bankDetails && (firm?.bank_account_number || firm?.bank_name || firm?.ifsc_code || firm?.bank_branch)) {
        bankDetails = {
          account_name: firm.bank_name || 'Default Bank Account',
          account_holder_name: firm.name || '',
          bank_name: firm.bank_name || '',
          branch_name: firm.bank_branch || '',
          account_number: firm.bank_account_number || '',
          ifsc_code: firm.ifsc_code || '',
          upi_id: null,
        };
      }
    } catch {
      bankDetails = null;
    }
  }

  const firmGstin = billObj.firmGstin || firm?.gst_number || '';
  const seller = {
    name: firm?.name || 'Company Name',
    address: firm?.address || '',
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

  // Build items table columns & widths dynamically
  const tableWidths: any[] = [15, '*'];
  const headerRow: any[] = [
    { text: '#', style: 'tblHdr', alignment: 'center' },
    { text: 'Description of Goods / Services', style: 'tblHdr' },
  ];

  if (showHsn) {
    tableWidths.push(52);
    headerRow.push({ text: 'HSN/SAC', style: 'tblHdr', alignment: 'center' });
  }
  if (showQty) {
    tableWidths.push(33);
    headerRow.push({ text: 'Qty', style: 'tblHdr', alignment: 'center' });
  }
  if (showUom) {
    tableWidths.push(26);
    headerRow.push({ text: 'UOM', style: 'tblHdr', alignment: 'center' });
  }
  if (showRate) {
    tableWidths.push(65);
    headerRow.push({ text: 'Rate (₹)', style: 'tblHdr', alignment: 'right' });
  }
  if (showDisc) {
    tableWidths.push(38);
    headerRow.push({ text: 'Disc%', style: 'tblHdr', alignment: 'right' });
  }
  if (showGst) {
    tableWidths.push(40);
    headerRow.push({ text: 'GST%', style: 'tblHdr', alignment: 'right' });
  }
  tableWidths.push(80);
  headerRow.push({ text: 'Amount (₹)', style: 'tblHdr', alignment: 'right' });

  const tableBody: any[] = [headerRow];

  items.forEach((it: any, idx: number) => {
    const rowCells: any[] = [
      { text: idx + 1, alignment: 'center', style: 'tblCell' },
      {
        stack: [
          { text: it.item || '', bold: true, fontSize: 8.5 },
          ...(showBatch && !isServiceItem(it) && it.batch ? [{ text: `Batch: ${it.batch}`, fontSize: 7.5, color: C.textLight }] : []),
          ...(showNarration && (it.narration || it.itemNarration) ? [{ text: it.narration || it.itemNarration, fontSize: 7.5, color: C.textLight }] : []),
        ],
        style: 'tblCell',
      }
    ];

    if (showHsn) rowCells.push({ text: it.hsn || '', alignment: 'center', style: 'tblCell' });
    if (showQty) rowCells.push({ text: shouldShowQty(it) ? formatQuantity(it.qty) : '', alignment: 'center', style: 'tblCell' });
    if (showUom) rowCells.push({ text: shouldShowQty(it) ? (it.uom || '') : '', alignment: 'center', style: 'tblCell' });
    if (showRate) rowCells.push({ text: formatCurrency(it.rate), alignment: 'right', noWrap: true, style: 'tblCell' });
    if (showDisc) rowCells.push({ text: formatPercentage(it.disc), alignment: 'right', style: 'tblCell' });
    if (showGst) rowCells.push({ text: gstEnabled ? formatPercentage(it.grate) : '-', alignment: 'right', style: 'tblCell' });
    rowCells.push({ text: formatCurrency(it.total), alignment: 'right', bold: true, noWrap: true, style: 'tblCell' });

    tableBody.push(rowCells);
  });

  otherCharges.forEach((ch: any, idx: number) => {
    const rowCells: any[] = [
      { text: items.length + idx + 1, alignment: 'center', style: 'tblCell' },
      {
        stack: [
          { text: ch.name || ch.type || 'Other Charge', bold: true, fontSize: 8.5 },
          ...(showHsn ? [{ text: `HSN/SAC: ${ch.hsnSac || ''}`, fontSize: 7.5, color: C.textLight }] : []),
        ],
        style: 'tblCell',
      }
    ];

    if (showHsn) rowCells.push({ text: ch.hsnSac || '', alignment: 'center', style: 'tblCell' });
    if (showQty) rowCells.push({ text: '1', alignment: 'center', style: 'tblCell' });
    if (showUom) rowCells.push({ text: 'NOS', alignment: 'center', style: 'tblCell' });
    if (showRate) rowCells.push({ text: formatCurrency(ch.amount), alignment: 'right', noWrap: true, style: 'tblCell' });
    if (showDisc) rowCells.push({ text: '0.00%', alignment: 'right', style: 'tblCell' });
    if (showGst) rowCells.push({ text: gstEnabled ? formatPercentage(ch.grate || ch.gstRate) : '-', alignment: 'right', style: 'tblCell' });
    rowCells.push({ text: formatCurrency(ch.amount), alignment: 'right', bold: true, noWrap: true, style: 'tblCell' });

    tableBody.push(rowCells);
  });

  // Terms and jurisdiction
  const customJurisdiction = printConfig?.jurisdiction || (firm?.city ? `Subject to ${firm.city} Jurisdiction only.` : 'Subject to local jurisdiction only.');
  let customTerms: any = null;
  if (printConfig?.terms) {
    try {
      customTerms = Array.isArray(printConfig.terms) ? printConfig.terms : JSON.parse(printConfig.terms);
    } catch {
      customTerms = [String(printConfig.terms)];
    }
  }

  const termsList = customTerms && customTerms.length > 0 ? customTerms : [
    isPurchase ? '1. Subject to mutually agreed payment terms.' : '1. Goods once sold will not be taken back.',
    `2. ${customJurisdiction}`,
    '3. E. & O.E.'
  ];

  const signatoryLabel = printConfig?.signatoryTitle || `For ${seller.name}`;

  const docDefinition: any = {
    defaultStyle: { font: 'DejaVuSans', fontSize: 8.5, color: C.textDark, lineHeight: 1.1 },
    pageMargins: [30, 38, 30, 32],
    header: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) return null;
      return {
        margin: [30, 10, 30, 0],
        stack: [
          {
            columns: [
              { text: `${(seller.name || '').toUpperCase()} — ${getInvoiceTypeLabel(btype)}`, bold: true, fontSize: 8, color: C.textDark },
              { text: `${isPurchase ? 'Bill No:' : 'Invoice No:'} ${billObj.bno || '-'}  |  Date: ${formatDate(billObj.bdate)}`, alignment: 'center', bold: true, fontSize: 8, color: C.textDark },
              { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 8, color: C.textMid },
            ]
          },
          {
            columns: [
              { text: `${isPurchase ? 'Supplier' : 'Buyer'}: ${billObj.partyName || ''}${billObj.partyGstin ? ' (GSTIN: ' + billObj.partyGstin + ')' : ''}`, fontSize: 7.5, color: C.textLight, margin: [0, 2, 0, 0] },
              { text: `(Continuation from Page ${currentPage - 1})`, alignment: 'right', fontSize: 7.5, italic: true, color: C.textLight, margin: [0, 2, 0, 0] }
            ]
          },
          { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 535, y2: 4, lineWidth: 0.75, lineColor: C.borderDark }] }
        ]
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [30, 8, 30, 0],
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 535, y2: 0, lineWidth: 0.5, lineColor: C.border }] },
          {
            columns: [
              { text: `${isPurchase ? 'Bill No:' : 'Invoice No:'} ${billObj.bno || ''}`, fontSize: 7.5, color: C.textLight, margin: [0, 3, 0, 0] },
              { text: `Generated via BusinessPro Suite  •  E. & O.E.`, alignment: 'center', fontSize: 7.5, color: C.textLight, margin: [0, 3, 0, 0] },
              { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 7.5, bold: true, color: C.textDark, margin: [0, 3, 0, 0] }
            ]
          }
        ]
      };
    },
    content: [
      ...(copyType ? [{
        text: copyType.toUpperCase(),
        bold: true,
        fontSize: 8,
        color: C.textMid,
        alignment: 'right',
        margin: [0, 0, 0, 4]
      }] : []),
      {
        table: {
          widths: ['*', 185],
          body: [[
            {
              stack: [
                { text: getInvoiceTypeLabel(btype), style: 'invoiceTypeLabel' },
                { text: btype === 'PROFORMA' ? 'PROFORMA INVOICE / ESTIMATE' : (btype === 'DELIVERY_NOTE' ? 'DELIVERY CHALLAN / TRANSPORT NOTE' : (gstEnabled ? 'TAX INVOICE UNDER GST' : 'INVOICE (GST DISABLED)')), style: 'invoiceSubTag' },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 330, y2: 0, lineWidth: 1, lineColor: C.borderDark }], margin: [0, 6, 0, 6] },
                { text: seller.name, style: 'companyName' },
                { text: seller.address, style: 'companyMeta' },
                { text: seller.gstin ? `GSTIN: ${seller.gstin}` : '', style: 'companyMeta' },
              ],
              margin: [0, 0, 8, 0],
            },
            {
              stack: [{
                table: {
                  widths: ['auto', '*'],
                  body: [
                    [{ text: isPurchase ? 'Purchase No' : 'Invoice No', style: 'metaLabel' }, { text: billObj.bno || '', style: 'metaValue' }],
                    ...(refBill ? [
                      [{ text: 'Orig Bill No', style: 'metaLabel' }, { text: refBill.bno || '', style: 'metaValue' }],
                      [{ text: 'Orig Date', style: 'metaLabel' }, { text: formatDate(refBill.bdate), style: 'metaValue' }],
                    ] : []),
                    ...(isPurchase && billObj.supplierBillNo ? [[{ text: 'Supplier Bill No', style: 'metaLabel' }, { text: billObj.supplierBillNo, style: 'metaValue' }]] : []),
                    [{ text: 'Date', style: 'metaLabel' }, { text: formatDate(billObj.bdate), style: 'metaValue' }],
                    ...(billObj.orderNo ? [[{ text: isPurchase ? 'Reference / PO No' : 'PO No', style: 'metaLabel' }, { text: billObj.orderNo, style: 'metaValue' }]] : []),
                    ...(billObj.vehicleNo ? [[{ text: 'Vehicle No', style: 'metaLabel' }, { text: billObj.vehicleNo, style: 'metaValue' }]] : []),
                    ...(billObj.dispatchThrough ? [[{ text: 'Dispatch Via', style: 'metaLabel' }, { text: billObj.dispatchThrough, style: 'metaValue' }]] : []),
                  ],
                },
                layout: {
                  hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
                  vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
                  hLineColor: () => C.border,
                  vLineColor: () => C.border,
                  paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3, paddingBottom: () => 3,
                },
              }],
              margin: [0, 0, 0, 0],
            },
          ]],
        },
        layout: {
          hLineWidth: (i: number, node: any) => i === node.table.body.length ? 2 : 0,
          vLineWidth: () => 0,
          hLineColor: () => C.borderDark,
          paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 10,
        },
        margin: [0, 0, 0, 0],
      },

      {
        table: {
          widths: ['*', '*'],
          body: [[
            {
              stack: [
                { text: isPurchase ? 'BILL FROM (SUPPLIER)' : 'BILL TO (BUYER)', style: 'partyBoxTitle' },
                { text: billObj.partyName || '', style: 'partyName', margin: [0, 3, 0, 1] },
                { text: formattedBuyerAddress, style: 'partyMeta' },
                { text: billObj.partyState ? `State: ${billObj.partyState}` : '', style: 'partyMeta' },
                { text: billObj.partyGstin ? `GSTIN: ${billObj.partyGstin}` : '', style: 'partyGstin' },
              ],
              margin: [8, 7, 8, 7],
            },
            {
              stack: [
                { text: isPurchase ? 'BILL TO (RECEIVER)' : 'SHIP TO (CONSIGNEE)', style: 'partyBoxTitle' },
                { text: rightBoxName, style: 'partyName', margin: [0, 3, 0, 1] },
                { text: rightBoxAddr, style: 'partyMeta' },
                { text: rightBoxState ? `State: ${rightBoxState}` : '', style: 'partyMeta' },
                { text: rightBoxGstin ? `GSTIN: ${rightBoxGstin}` : '', style: 'partyGstin' },
              ],
              margin: [8, 7, 8, 7],
            },
          ]],
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1.5 : 0,
          vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1.5 : 1,
          hLineColor: () => C.borderDark,
          vLineColor: (i: number) => i === 1 ? C.border : C.borderDark,
          paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
        },
        margin: [0, 8, 0, 8],
      },

      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: tableWidths,
          body: tableBody,
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5,
          vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1.5 : 0.5,
          hLineColor: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? C.borderDark : C.border,
          vLineColor: () => C.border,
          paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 2, paddingBottom: () => 2,
        },
      },

      ...(hsnSummary.length > 0 && gstEnabled
        ? [{
            stack: [{
              table: {
                headerRows: 1,
                widths: [60, '*', 78, 78, 78, 90],
                body: [
                  [
                    { text: 'HSN/SAC', style: 'hsnHdr', alignment: 'center' },
                    { text: 'Taxable Value', style: 'hsnHdr', alignment: 'right' },
                    { text: 'CGST (₹)', style: 'hsnHdr', alignment: 'right' },
                    { text: 'SGST (₹)', style: 'hsnHdr', alignment: 'right' },
                    { text: 'IGST (₹)', style: 'hsnHdr', alignment: 'right' },
                    { text: 'Total Tax (₹)', style: 'hsnHdr', alignment: 'right' },
                  ],
                  ...hsnSummary.map((row: any) => [
                    { text: row.hsn, alignment: 'center', style: 'hsnCell' },
                    { text: formatCurrency(row.taxableValue), alignment: 'right', noWrap: true, style: 'hsnCell' },
                    { text: billType === 'intra-state' ? formatCurrency(row.cgst) : '—', alignment: 'right', noWrap: true, style: 'hsnCell' },
                    { text: billType === 'intra-state' ? formatCurrency(row.sgst) : '—', alignment: 'right', noWrap: true, style: 'hsnCell' },
                    { text: billType === 'inter-state' ? formatCurrency(row.igst) : '—', alignment: 'right', noWrap: true, style: 'hsnCell' },
                    { text: formatCurrency(row.totalTax), alignment: 'right', noWrap: true, style: 'hsnCell', bold: true },
                  ]),
                ],
              },
              layout: {
                hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1.5 : 0.5,
                vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1.5 : 0.5,
                hLineColor: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? C.borderDark : C.border,
                vLineColor: () => C.border,
                paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 2, paddingBottom: () => 2,
              },
            }],
            margin: [0, 8, 0, 0] as [number, number, number, number],
          }]
        : []),

      {
        table: {
          widths: ['*', 200],
          body: [[
            {
              stack: [
                { text: 'AMOUNT IN WORDS', style: 'footerSectionTitle' },
                { text: numberToWords(roundedGrandTotal), bold: true, fontSize: 9, margin: [0, 3, 0, 0] },
                ...(billObj.narration ? [
                  { text: 'NARRATION', style: 'footerSectionTitle', margin: [0, 8, 0, 2] },
                  { text: billObj.narration, fontSize: 8.5, color: C.textMid },
                ] : []),
                ...(bankDetails ? [
                  { text: 'BANK DETAILS', style: 'footerSectionTitle', margin: [0, 8, 0, 2] },
                  { text: `A/C Name: ${bankDetails.account_holder_name || bankDetails.account_name || '-'}`, fontSize: 7.5, color: C.textLight },
                  { text: `A/C No: ${bankDetails.account_number || '-'}`, fontSize: 7.5, color: C.textDark, bold: true },
                  { text: `Bank: ${bankDetails.bank_name || '-'}`, fontSize: 7.5, color: C.textLight },
                  { text: `Branch: ${bankDetails.branch_name || '-'}`, fontSize: 7.5, color: C.textLight },
                  { text: `IFSC: ${bankDetails.ifsc_code || '-'}`, fontSize: 7.5, color: C.textDark, bold: true },
                  ...(bankDetails.upi_id ? [{ text: `UPI: ${bankDetails.upi_id}`, fontSize: 7.5, color: C.textLight }] : []),
                ] : []),
              ],
              margin: [8, 8, 8, 8],
            },
            {
              stack: [{
                table: {
                  widths: ['*', 95],
                  body: [
                    [{ text: 'Taxable Value', style: 'totLabel' }, { text: formatCurrency(taxableValue), alignment: 'right', noWrap: true, style: 'totValue' }],
                    ...(gstEnabled
                      ? (billType === 'intra-state'
                        ? [
                          [{ text: 'Add: CGST', style: 'totLabel' }, { text: formatCurrency(billObj.cgst), alignment: 'right', noWrap: true, style: 'totValue' }],
                          [{ text: 'Add: SGST', style: 'totLabel' }, { text: formatCurrency(billObj.sgst), alignment: 'right', noWrap: true, style: 'totValue' }],
                        ]
                        : [[{ text: 'Add: IGST', style: 'totLabel' }, { text: formatCurrency(billObj.igst), alignment: 'right', noWrap: true, style: 'totValue' }]])
                      : []),
                    [{ text: 'Total Tax', style: 'totLabel' }, { text: formatCurrency(totalTax), alignment: 'right', noWrap: true, style: 'totValue' }],
                    [{ text: 'Round Off', style: 'totLabel' }, { text: formatCurrency(roundOff), alignment: 'right', noWrap: true, style: 'totValue' }],
                    [{ text: 'GRAND TOTAL', style: 'grandTotLabel' }, { text: formatCurrency(roundedGrandTotal), alignment: 'right', noWrap: true, style: 'grandTotValue' }],
                  ],
                },
                layout: {
                  hLineWidth: (i: number, node: any) => {
                    if (i === 0 || i === node.table.body.length) return 1.5;
                    if (i === node.table.body.length - 1) return 1.5;
                    return 0.5;
                  },
                  vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
                  hLineColor: (i: number, node: any) => {
                    if (i === 0 || i === node.table.body.length || i === node.table.body.length - 1) return C.borderDark;
                    return C.border;
                  },
                  vLineColor: () => C.border,
                  paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 3, paddingBottom: () => 3,
                },
              }],
              margin: [0, 0, 0, 0],
            },
          ]],
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1.5 : 0,
          vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1.5 : 1,
          hLineColor: () => C.borderDark,
          vLineColor: (i: number) => i === 1 ? C.border : C.borderDark,
          paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
        },
        margin: [0, 8, 0, 8],
      },

      {
        table: {
          widths: ['*', 180],
          body: [[
            {
              stack: [
                { text: 'TERMS & CONDITIONS', style: 'footerSectionTitle' },
                ...termsList.map((t: string) => ({ text: t, fontSize: 7.5, color: C.textLight })),
              ],
              margin: [8, 6, 8, 6],
            },
            {
              stack: [
                { text: signatoryLabel, alignment: 'right', bold: true, fontSize: 8.5, color: C.textDark },
                { text: '', margin: [0, 15, 0, 0] },
                { text: 'Authorised Signatory', alignment: 'right', fontSize: 7.5, color: C.textLight },
              ],
              margin: [8, 6, 8, 6],
            },
          ]],
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 1.5 : 0,
          vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length) ? 1.5 : 1,
          hLineColor: () => C.borderDark,
          vLineColor: (i: number) => i === 1 ? C.border : C.borderDark,
          paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
        },
        margin: [0, 0, 0, 0],
      },
    ],
    styles: {
      invoiceTypeLabel: { fontSize: 14, bold: true, color: C.primary },
      invoiceSubTag: { fontSize: 8, bold: true, color: C.textMid, margin: [0, 1, 0, 0] },
      companyName: { fontSize: 13, bold: true, color: C.primary },
      companyMeta: { fontSize: 8, color: C.textMid },
      metaLabel: { fontSize: 8, bold: true, color: C.textMid },
      metaValue: { fontSize: 8.5, bold: true, color: C.textDark },
      partyBoxTitle: { fontSize: 7.5, bold: true, color: C.primary },
      partyName: { fontSize: 10, bold: true, color: C.textDark },
      partyMeta: { fontSize: 8, color: C.textMid },
      partyGstin: { fontSize: 8, bold: true, color: C.textDark },
      tblHdr: { fontSize: 8, bold: true, color: C.tableHdrText, fillColor: C.tableHdrBg, margin: [2, 3, 2, 3] },
      tblCell: { fontSize: 8 },
      hsnHdr: { fontSize: 7.5, bold: true, color: C.tableHdrText, fillColor: C.tableHdrBg, margin: [2, 2, 2, 2] },
      hsnCell: { fontSize: 7.5 },
      footerSectionTitle: { fontSize: 7.5, bold: true, color: C.textMid },
      totLabel: { fontSize: 8, color: C.textMid },
      totValue: { fontSize: 8, color: C.textDark },
      grandTotLabel: { fontSize: 9.5, bold: true, color: C.primary },
      grandTotValue: { fontSize: 10, bold: true, color: C.primary },
    },
  };

  return await createPdfBufferFromDocDef(docDefinition);
}

export async function exportBillsToPdfBuffer(bills: any[], firm: any): Promise<Buffer> {
  if (bills.length === 1) {
    return await exportSingleBillToPdfBuffer(bills[0], firm);
  }

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 36, 30, 30],
    defaultStyle: { fontSize: 8.5, color: C.textDark },
    header: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) return null;
      return {
        margin: [30, 10, 30, 0],
        columns: [
          { text: `${(firm?.name || 'Company Name').toUpperCase()} — BILLS & INVOICES REGISTER`, bold: true, fontSize: 8, color: C.textDark },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 8, color: C.textMid }
        ]
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [30, 8, 30, 0],
        columns: [
          { text: 'Bills Register  •  BusinessPro Suite', fontSize: 7.5, color: C.textLight },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 7.5, color: C.textDark }
        ]
      };
    },
    content: [
      { text: (firm?.name || 'Company Name').toUpperCase(), fontSize: 14, bold: true, color: C.primary, alignment: 'center' },
      { text: 'BILLS & INVOICES REGISTER', fontSize: 12, bold: true, alignment: 'center', margin: [0, 2, 0, 15] },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [60, 60, 55, '*', 65, 60, 60, 65, 45],
          body: [
            [
              { text: 'Bill No', style: 'tblHdr' },
              { text: 'Supp Bill No', style: 'tblHdr' },
              { text: 'Date', style: 'tblHdr', alignment: 'center' },
              { text: 'Party Name', style: 'tblHdr' },
              { text: 'Type', style: 'tblHdr', alignment: 'center' },
              { text: 'Taxable (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'Tax (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'Total (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'Status', style: 'tblHdr', alignment: 'center' },
            ],
            ...bills.map((b) => {
              const tax = (b.cgst || 0) + (b.sgst || 0) + (b.igst || 0);
              return [
                { text: b.bno || '', fontSize: 8 },
                { text: b.supplierBillNo || '', fontSize: 8 },
                { text: formatDate(b.bdate), alignment: 'center', fontSize: 8 },
                { text: b.partyName || b.supply || '', fontSize: 8 },
                { text: b.btype || 'SALES', alignment: 'center', fontSize: 8 },
                { text: formatCurrency(b.grossTotal), alignment: 'right', fontSize: 8 },
                { text: formatCurrency(tax), alignment: 'right', fontSize: 8 },
                { text: formatCurrency(b.netTotal), alignment: 'right', bold: true, fontSize: 8 },
                { text: b.status || 'ACTIVE', alignment: 'center', fontSize: 8 },
              ];
            }),
          ]
        }
      }
    ],
    styles: {
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.tableHdrBg, color: C.tableHdrText, margin: [2, 3, 2, 3] }
    }
  };
  return createPdfBufferFromDocDef(docDefinition);
}

export async function exportLedgerToPdfBuffer(data: {
  firmName: string;
  periodText: string;
  accountHead: string;
  startingBal: any;
  mappedEntries: any[];
  totalDebits: number;
  totalCredits: number;
  finalBalance: number;
  finalBalanceType: string;
}): Promise<Buffer> {
  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [30, 36, 30, 30],
    defaultStyle: { fontSize: 8.5, color: C.textDark },
    header: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) return null;
      return {
        margin: [30, 10, 30, 0],
        columns: [
          { text: `${(data.firmName || '').toUpperCase()} — LEDGER: ${data.accountHead.toUpperCase()}`, bold: true, fontSize: 8, color: C.textDark },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 8, color: C.textMid }
        ]
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [30, 8, 30, 0],
        columns: [
          { text: `Account Ledger  •  ${data.periodText}`, fontSize: 7.5, color: C.textLight },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 7.5, color: C.textDark }
        ]
      };
    },
    content: [
      { text: (data.firmName || '').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
      { text: `ACCOUNT LEDGER: ${data.accountHead.toUpperCase()}`, fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
      { text: data.periodText, fontSize: 8.5, italic: true, alignment: 'center', margin: [0, 0, 0, 10] },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [55, 80, '*', 65, 65, 75],
          body: [
            [
              { text: 'Date', style: 'tblHdr', alignment: 'center' },
              { text: 'Voucher Ref', style: 'tblHdr' },
              { text: 'Narration', style: 'tblHdr' },
              { text: 'Debit (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'Credit (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'Running Bal', style: 'tblHdr', alignment: 'right' },
            ],
            ...(data.startingBal.balance > 0 || data.periodText !== 'All Time' ? [[
              { text: '—', alignment: 'center', fontSize: 8 },
              { text: 'OPENING BAL', bold: true, fontSize: 8 },
              { text: 'Brought forward balance', fontSize: 8 },
              { text: data.startingBal.balanceType === 'DR' && data.startingBal.balance > 0 ? formatCurrency(data.startingBal.balance) : '', alignment: 'right', fontSize: 8 },
              { text: data.startingBal.balanceType === 'CR' && data.startingBal.balance > 0 ? formatCurrency(data.startingBal.balance) : '', alignment: 'right', fontSize: 8 },
              { text: `${formatCurrency(data.startingBal.balance)} ${data.startingBal.balanceType}`, alignment: 'right', bold: true, fontSize: 8 },
            ]] : []),
            ...data.mappedEntries.map((e) => [
              { text: formatDate(e.transactionDate), alignment: 'center', fontSize: 8 },
              { text: e.voucherNo || e.refType || '', fontSize: 8 },
              { text: e.narration || '', fontSize: 8 },
              { text: e.debitAmount > 0 ? formatCurrency(e.debitAmount) : '', alignment: 'right', fontSize: 8 },
              { text: e.creditAmount > 0 ? formatCurrency(e.creditAmount) : '', alignment: 'right', fontSize: 8 },
              { text: `${formatCurrency(e.runningBalance)} ${e.runningBalanceType}`, alignment: 'right', bold: true, fontSize: 8 },
            ]),
            [
              { text: 'TOTALS', colSpan: 3, bold: true, alignment: 'center', fontSize: 8 },
              {}, {},
              { text: formatCurrency(data.totalDebits), alignment: 'right', bold: true, fontSize: 8 },
              { text: formatCurrency(data.totalCredits), alignment: 'right', bold: true, fontSize: 8 },
              { text: `${formatCurrency(data.finalBalance)} ${data.finalBalanceType}`, alignment: 'right', bold: true, fontSize: 8 },
            ]
          ]
        }
      }
    ],
    styles: {
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.tableHdrBg, color: C.tableHdrText, margin: [2, 3, 2, 3] }
    }
  };
  return createPdfBufferFromDocDef(docDefinition);
}

export async function exportTrialBalanceToPdfBuffer(data: {
  firmName: string;
  periodText: string;
  tbData: any[];
  isBalanced: boolean;
  diff: number;
}): Promise<Buffer> {
  let totalDr = 0;
  let totalCr = 0;
  data.tbData.forEach((r) => {
    totalDr += r.totalDebit || 0;
    totalCr += r.totalCredit || 0;
  });

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { fontSize: 8.5, color: C.textDark },
    content: [
      { text: (data.firmName || '').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
      { text: 'TRIAL BALANCE', fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
      { text: data.periodText, fontSize: 8.5, italic: true, alignment: 'center', margin: [0, 0, 0, 10] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 100, 100, 100],
          body: [
            [
              { text: 'Account Head', style: 'tblHdr' },
              { text: 'Category', style: 'tblHdr' },
              { text: 'Debit (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'Credit (₹)', style: 'tblHdr', alignment: 'right' },
            ],
            ...data.tbData.map((row) => [
              { text: row.accountHead, fontSize: 8 },
              { text: row.accountType?.replace(/_/g, ' ') || 'GENERAL', fontSize: 8 },
              { text: row.totalDebit > 0 ? formatCurrency(row.totalDebit) : '', alignment: 'right', fontSize: 8 },
              { text: row.totalCredit > 0 ? formatCurrency(row.totalCredit) : '', alignment: 'right', fontSize: 8 },
            ]),
            [
              { text: 'GRAND TOTALS', colSpan: 2, bold: true, fontSize: 8.5 },
              {},
              { text: formatCurrency(totalDr), alignment: 'right', bold: true, fontSize: 8.5 },
              { text: formatCurrency(totalCr), alignment: 'right', bold: true, fontSize: 8.5 },
            ]
          ]
        }
      }
    ],
    styles: {
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.tableHdrBg, color: C.tableHdrText, margin: [2, 3, 2, 3] }
    }
  };
  return createPdfBufferFromDocDef(docDefinition);
}

export async function exportProfitLossToPdfBuffer(data: {
  firmName: string;
  periodText: string;
  plModel: any;
}): Promise<Buffer> {
  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { fontSize: 8.5, color: C.textDark },
    content: [
      { text: (data.firmName || '').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
      { text: 'TRADING AND PROFIT & LOSS STATEMENT', fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
      { text: data.periodText, fontSize: 8.5, italic: true, alignment: 'center', margin: [0, 0, 0, 10] },
      {
        table: {
          widths: ['*', 90, '*', 90],
          body: [
            [
              { text: 'EXPENSES (DEBIT)', style: 'tblHdr' },
              { text: 'AMOUNT (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'INCOMES (CREDIT)', style: 'tblHdr' },
              { text: 'AMOUNT (₹)', style: 'tblHdr', alignment: 'right' },
            ],
            [
              { text: 'Cost of Goods Sold', bold: true },
              { text: formatCurrency(data.plModel.totalCOGS), alignment: 'right', bold: true },
              { text: 'Revenue / Sales', bold: true },
              { text: formatCurrency(data.plModel.totalRevenueCr), alignment: 'right', bold: true },
            ],
            [
              { text: 'Operating Expenses', bold: true },
              { text: formatCurrency(data.plModel.totalOpex), alignment: 'right', bold: true },
              { text: 'Other Incomes', bold: true },
              { text: formatCurrency(data.plModel.crGeneral?.reduce((s:number,a:any)=>s+a.netCr,0) || 0), alignment: 'right', bold: true },
            ],
            [
              { text: 'Net Profit', bold: true },
              { text: formatCurrency(data.plModel.netProfit >= 0 ? data.plModel.netProfit : 0), alignment: 'right', bold: true },
              { text: 'Net Loss', bold: true },
              { text: formatCurrency(data.plModel.netProfit < 0 ? Math.abs(data.plModel.netProfit) : 0), alignment: 'right', bold: true },
            ],
            [
              { text: 'GRAND TOTAL', bold: true },
              { text: formatCurrency(data.plModel.drGrand), alignment: 'right', bold: true },
              { text: 'GRAND TOTAL', bold: true },
              { text: formatCurrency(data.plModel.crGrand), alignment: 'right', bold: true },
            ]
          ]
        }
      }
    ],
    styles: {
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.tableHdrBg, color: C.tableHdrText, margin: [2, 3, 2, 3] }
    }
  };
  return createPdfBufferFromDocDef(docDefinition);
}

export async function exportBalanceSheetToPdfBuffer(data: {
  firmName: string;
  periodText: string;
  bsModel: any;
}): Promise<Buffer> {
  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { fontSize: 8.5, color: C.textDark },
    content: [
      { text: (data.firmName || '').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
      { text: 'BALANCE SHEET STATEMENT', fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
      { text: data.periodText, fontSize: 8.5, italic: true, alignment: 'center', margin: [0, 0, 0, 10] },
      {
        table: {
          widths: ['*', 90, '*', 90],
          body: [
            [
              { text: 'LIABILITIES & CAPITAL', style: 'tblHdr' },
              { text: 'AMOUNT (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'ASSETS', style: 'tblHdr' },
              { text: 'AMOUNT (₹)', style: 'tblHdr', alignment: 'right' },
            ],
            [
              { text: 'Capital Pool (Equity + P&L)', bold: true },
              { text: formatCurrency((data.bsModel.capital || 0) + (data.bsModel.netProfit || 0)), alignment: 'right', bold: true },
              { text: 'Fixed & Other Assets', bold: true },
              { text: formatCurrency(data.bsModel.totalOtherA), alignment: 'right', bold: true },
            ],
            [
              { text: 'Loans & External Liabilities', bold: true },
              { text: formatCurrency(data.bsModel.totalLiab), alignment: 'right', bold: true },
              { text: 'Stock & Inventory', bold: true },
              { text: formatCurrency(data.bsModel.totalStock), alignment: 'right', bold: true },
            ],
            [
              { text: 'Sundry Creditors', bold: true },
              { text: formatCurrency(data.bsModel.totalCred), alignment: 'right', bold: true },
              { text: 'Sundry Debtors', bold: true },
              { text: formatCurrency(data.bsModel.totalDebtors), alignment: 'right', bold: true },
            ],
            [
              { text: 'Other Credit Balances', bold: true },
              { text: formatCurrency((data.bsModel.totalDebtorCreditBalances || 0) + (data.bsModel.totalCashBankCreditBalances || 0)), alignment: 'right', bold: true },
              { text: 'Cash & Bank Balances', bold: true },
              { text: formatCurrency(data.bsModel.totalCashBank), alignment: 'right', bold: true },
            ],
            [
              { text: 'TOTAL LIABILITIES & CAPITAL', bold: true },
              { text: formatCurrency(data.bsModel.totalLiabSide), alignment: 'right', bold: true },
              { text: 'TOTAL ASSETS', bold: true },
              { text: formatCurrency(data.bsModel.totalAssets), alignment: 'right', bold: true },
            ]
          ]
        }
      }
    ],
    styles: {
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.tableHdrBg, color: C.tableHdrText, margin: [2, 3, 2, 3] }
    }
  };
  return createPdfBufferFromDocDef(docDefinition);
}

export async function exportDrillDownToPdfBuffer(data: {
  firmName: string;
  periodText: string;
  categoryTitle: string;
  accounts: Array<{ accountHead: string; totalDebit: number; totalCredit: number; balance: number; balanceType: string }>;
  grandTotalDebit: number;
  grandTotalCredit: number;
}): Promise<Buffer> {
  const tableBody: any[] = [
    [
      { text: '#', style: 'tblHdr' },
      { text: 'ACCOUNT HEAD', style: 'tblHdr' },
      { text: 'DEBITS (₹)', style: 'tblHdr', alignment: 'right' },
      { text: 'CREDITS (₹)', style: 'tblHdr', alignment: 'right' },
      { text: 'NET BALANCE (₹)', style: 'tblHdr', alignment: 'right' },
    ]
  ];

  data.accounts.forEach((acc, idx) => {
    tableBody.push([
      { text: String(idx + 1), alignment: 'center' },
      { text: acc.accountHead, bold: true },
      { text: formatCurrency(acc.totalDebit), alignment: 'right', color: acc.totalDebit > 0 ? C.green : C.textDark },
      { text: formatCurrency(acc.totalCredit), alignment: 'right', color: acc.totalCredit > 0 ? C.red : C.textDark },
      { text: `${formatCurrency(acc.balance)} ${acc.balanceType}`, alignment: 'right', bold: true }
    ]);
  });

  tableBody.push([
    { text: 'GRAND TOTAL', colSpan: 2, bold: true, alignment: 'right' },
    {},
    { text: formatCurrency(data.grandTotalDebit), alignment: 'right', bold: true, color: C.green },
    { text: formatCurrency(data.grandTotalCredit), alignment: 'right', bold: true, color: C.red },
    { text: `${formatCurrency(Math.abs(data.grandTotalDebit - data.grandTotalCredit))} ${data.grandTotalDebit >= data.grandTotalCredit ? 'DR' : 'CR'}`, alignment: 'right', bold: true }
  ]);

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { fontSize: 8.5, color: C.textDark },
    content: [
      { text: (data.firmName || '').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
      { text: `DRILL-DOWN STATEMENT: ${data.categoryTitle.toUpperCase()}`, fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
      { text: data.periodText, fontSize: 8.5, italic: true, alignment: 'center', margin: [0, 0, 0, 10] },
      {
        table: {
          headerRows: 1,
          widths: [25, '*', 100, 100, 110],
          body: tableBody
        }
      }
    ],
    styles: {
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.tableHdrBg, color: C.tableHdrText, margin: [2, 3, 2, 3] }
    }
  };
  return createPdfBufferFromDocDef(docDefinition);
}
