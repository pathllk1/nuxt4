// @ts-ignore - pdfmake server-side entry point
import pdfMake from 'pdfmake';
import mongoose from 'mongoose';
import StockReg from '../../models/StockReg';
import Bill from '../../models/Bill';
import BankAccount from '../../models/BankAccount';
import FirmSettings from '../../models/FirmSettings';
import { dejavuVfs } from './vfs-dejavu-fonts';

// Register in-memory VFS fonts for serverless (Vercel) & local environments
if ((pdfMake as any).virtualfs) {
  for (const [fontFile, base64Data] of Object.entries(dejavuVfs)) {
    (pdfMake as any).virtualfs.writeFileSync(fontFile, base64Data, 'base64');
  }
}

const fonts = {
  DejaVuSans: {
    normal: 'DejaVuSans.ttf',
    bold: 'DejaVuSans-Bold.ttf',
    italics: 'DejaVuSans-Oblique.ttf',
    bolditalics: 'DejaVuSans-BoldOblique.ttf',
  },
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  }
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

  // Ensure VFS is populated on every invocation (fail-safe for serverless warmup / cold starts)
  if ((pdfMake as any).virtualfs) {
    for (const [fontFile, base64Data] of Object.entries(dejavuVfs)) {
      if (!(pdfMake as any).virtualfs.existsSync(fontFile)) {
        (pdfMake as any).virtualfs.writeFileSync(fontFile, base64Data, 'base64');
      }
    }
  }

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

  // 1. Fetch saved print settings from FirmSettings
  let settingsMap: Record<string, string> = {};
  try {
    const firmIdObj = new mongoose.Types.ObjectId(String(firmId));
    const settingDocs = await FirmSettings.find({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj as any }, { firmId: String(firmId) as any }],
      settingKey: { $regex: '^print_' }
    }).lean();
    settingDocs.forEach(s => {
      settingsMap[s.settingKey.replace('print_', '')] = s.settingValue;
    });
  } catch (err) {
    console.error('Error loading print settings in pdf-export:', err);
  }

  // Column flags and layout settings with precedence: query/printConfig > FirmSettings DB > defaults
  const showHsn = printConfig?.showHsn !== undefined ? (printConfig.showHsn === true || printConfig.showHsn === 'true') : (settingsMap.showHsn !== 'false');
  const showQty = printConfig?.showQty !== undefined ? (printConfig.showQty === true || printConfig.showQty === 'true') : (settingsMap.showQty !== 'false');
  const showUom = printConfig?.showUom !== undefined ? (printConfig.showUom === true || printConfig.showUom === 'true') : (settingsMap.showUom !== 'false');
  const showRate = printConfig?.showRate !== undefined ? (printConfig.showRate === true || printConfig.showRate === 'true') : (settingsMap.showRate !== 'false');
  const showDisc = printConfig?.showDisc !== undefined ? (printConfig.showDisc === true || printConfig.showDisc === 'true') : (settingsMap.showDisc !== 'false');
  const showGst = printConfig?.showGst !== undefined ? (printConfig.showGst === true || printConfig.showGst === 'true') : (settingsMap.showGst !== 'false');
  const showBatch = printConfig?.showBatch !== undefined ? (printConfig.showBatch === true || printConfig.showBatch === 'true') : (settingsMap.showBatch !== 'false');
  const showNarration = printConfig?.showNarration !== undefined ? (printConfig.showNarration === true || printConfig.showNarration === 'true') : (settingsMap.showNarration !== 'false');
  const showBank = printConfig?.showBank !== undefined ? (printConfig.showBank === true || printConfig.showBank === 'true') : (settingsMap.showBank !== 'false');
  
  const copyType = printConfig?.copyType || printConfig?.defaultCopyType || settingsMap.defaultCopyType || '';

  // Determine target bank account ID
  const targetBankId = printConfig?.bankAccountId || printConfig?.defaultBankAccountId || settingsMap.defaultBankAccountId || '';

  let bankDetails: any = null;
  if (showBank) {
    try {
      if (targetBankId && mongoose.Types.ObjectId.isValid(String(targetBankId))) {
        bankDetails = await BankAccount.findById(new mongoose.Types.ObjectId(String(targetBankId)))
          .select('account_name account_holder_name bank_name branch_name account_number ifsc_code upi_id').lean();

        if (!bankDetails) {
          bankDetails = await BankAccount.findOne({
            _id: String(targetBankId)
          }).select('account_name account_holder_name bank_name branch_name account_number ifsc_code upi_id').lean();
        }
      }

      if (!bankDetails) {
        bankDetails = await BankAccount.findOne({
          $or: [{ firmId }, { firm_id: firmId }],
          is_default: true,
          status: 'ACTIVE',
        }).select('account_name account_holder_name bank_name branch_name account_number ifsc_code upi_id').lean();
      }

      if (!bankDetails) {
        bankDetails = await BankAccount.findOne({
          $or: [{ firmId }, { firm_id: firmId }],
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

  // Terms, Declaration, and Jurisdiction
  const customJurisdiction = (printConfig?.jurisdiction || settingsMap.jurisdiction || (firm?.city ? `Subject to ${firm.city} Jurisdiction only.` : 'Subject to local jurisdiction only.')).trim();
  const declarationText = (printConfig?.declaration || settingsMap.declaration || 'Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged.').trim();
  const rawSignatory = (printConfig?.signatoryTitle || settingsMap.signatoryTitle || 'Authorised Signatory').trim();

  // Normalize signatory designation so company name is never printed twice
  let signatoryTitle = rawSignatory;
  if (
    signatoryTitle.toLowerCase() === `for ${seller.name.toLowerCase()}` || 
    signatoryTitle.toLowerCase() === seller.name.toLowerCase() ||
    !signatoryTitle
  ) {
    signatoryTitle = 'Authorised Signatory';
  } else if (signatoryTitle.toLowerCase().startsWith('for ')) {
    signatoryTitle = signatoryTitle.replace(/^for\s+.*?[-—:\s]+/i, '').trim() || 'Authorised Signatory';
  }

  // Build authoritative Terms list with dynamic jurisdiction
  const termsList = [
    isPurchase ? '1. Subject to mutually agreed payment terms.' : '1. Goods once sold will not be taken back.',
    customJurisdiction.startsWith('2.') ? customJurisdiction : `2. ${customJurisdiction}`,
    '3. E. & O.E.'
  ];

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
          widths: ['*', 190],
          body: [[
            {
              stack: [
                ...(declarationText ? [
                  { text: 'DECLARATION', style: 'footerSectionTitle' },
                  { text: declarationText, fontSize: 7, color: C.textLight, margin: [0, 1, 0, 4] },
                ] : []),
                { text: 'TERMS & CONDITIONS', style: 'footerSectionTitle' },
                ...termsList.map((t: string) => ({ text: t, fontSize: 7, color: C.textLight })),
              ],
              margin: [8, 6, 8, 6],
            },
            {
              stack: [
                { text: `For ${seller.name}`, alignment: 'right', bold: true, fontSize: 8.5, color: C.textDark },
                { text: '', margin: [0, 22, 0, 0] },
                { canvas: [{ type: 'line', x1: 50, y1: 0, x2: 180, y2: 0, lineWidth: 0.5, lineColor: C.borderDark }], margin: [0, 0, 0, 2] },
                { text: signatoryTitle, alignment: 'right', fontSize: 7.5, color: C.textDark, bold: true },
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

  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTaxSum = 0;
  let totalNet = 0;

  const rows = bills.map((b) => {
    const cgst = Number(b.cgst) || 0;
    const sgst = Number(b.sgst) || 0;
    const igst = Number(b.igst) || 0;
    const tax = cgst + sgst + igst;
    const taxable = Number(b.grossTotal) || 0;
    const net = Number(b.netTotal) || 0;

    totalTaxable += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    totalTaxSum += tax;
    totalNet += net;

    return [
      { text: b.bno || '', fontSize: 7.5, bold: true },
      { text: formatDate(b.bdate || b.createdAt), alignment: 'center', fontSize: 7.5 },
      { text: b.partyName || b.supply || '', fontSize: 7.5 },
      { text: b.partyGstin || '-', fontSize: 7, color: C.textMid },
      { text: b.btype || 'SALES', alignment: 'center', fontSize: 7 },
      { text: formatCurrency(taxable), alignment: 'right', fontSize: 7.5 },
      { text: cgst > 0 ? formatCurrency(cgst) : '-', alignment: 'right', fontSize: 7.5, color: cgst > 0 ? C.textDark : C.textLight },
      { text: sgst > 0 ? formatCurrency(sgst) : '-', alignment: 'right', fontSize: 7.5, color: sgst > 0 ? C.textDark : C.textLight },
      { text: igst > 0 ? formatCurrency(igst) : '-', alignment: 'right', fontSize: 7.5, color: igst > 0 ? C.textDark : C.textLight },
      { text: formatCurrency(tax), alignment: 'right', fontSize: 7.5 },
      { text: formatCurrency(net), alignment: 'right', bold: true, fontSize: 7.5 },
      { text: b.status || 'ACTIVE', alignment: 'center', fontSize: 7 },
    ];
  });

  // Grand Total Summary Row
  const totalRow = [
    { text: 'TOTAL', bold: true, alignment: 'center', fontSize: 8, fillColor: C.tableHdrBg },
    { text: '', fillColor: C.tableHdrBg },
    { text: `${bills.length} Bills`, bold: true, fontSize: 8, fillColor: C.tableHdrBg },
    { text: '', fillColor: C.tableHdrBg },
    { text: '', fillColor: C.tableHdrBg },
    { text: formatCurrency(totalTaxable), alignment: 'right', bold: true, fontSize: 8, fillColor: C.tableHdrBg },
    { text: formatCurrency(totalCgst), alignment: 'right', bold: true, fontSize: 8, fillColor: C.tableHdrBg },
    { text: formatCurrency(totalSgst), alignment: 'right', bold: true, fontSize: 8, fillColor: C.tableHdrBg },
    { text: formatCurrency(totalIgst), alignment: 'right', bold: true, fontSize: 8, fillColor: C.tableHdrBg },
    { text: formatCurrency(totalTaxSum), alignment: 'right', bold: true, fontSize: 8, fillColor: C.tableHdrBg },
    { text: formatCurrency(totalNet), alignment: 'right', bold: true, fontSize: 8.5, fillColor: C.tableHdrBg, color: C.primary },
    { text: '', fillColor: C.tableHdrBg },
  ];

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [24, 30, 24, 26],
    defaultStyle: { fontSize: 8, color: C.textDark },
    header: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) return null;
      return {
        margin: [24, 10, 24, 0],
        columns: [
          { text: `${(firm?.name || 'Company Name').toUpperCase()} — BILLS & GST REGISTER`, bold: true, fontSize: 8, color: C.textDark },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 8, color: C.textMid }
        ]
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [24, 6, 24, 0],
        columns: [
          { text: 'Bills & GST Register  •  BusinessPro Suite', fontSize: 7.5, color: C.textLight },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', bold: true, fontSize: 7.5, color: C.textDark }
        ]
      };
    },
    content: [
      { text: (firm?.name || 'Company Name').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
      { text: 'BILLS & GST REGISTER', fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 10] },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [55, 48, '*', 72, 42, 58, 48, 48, 48, 54, 62, 40],
          body: [
            [
              { text: 'Bill No', style: 'tblHdr' },
              { text: 'Date', style: 'tblHdr', alignment: 'center' },
              { text: 'Party Name', style: 'tblHdr' },
              { text: 'GSTIN', style: 'tblHdr' },
              { text: 'Type', style: 'tblHdr', alignment: 'center' },
              { text: 'Taxable (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'CGST (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'SGST (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'IGST (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'Total Tax', style: 'tblHdr', alignment: 'right' },
              { text: 'Net (₹)', style: 'tblHdr', alignment: 'right' },
              { text: 'Status', style: 'tblHdr', alignment: 'center' },
            ],
            ...rows,
            totalRow
          ]
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length - 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: (i: number, node: any) => (i === node.table.body.length - 1 || i === node.table.body.length) ? C.primary : C.border,
          vLineColor: () => C.border,
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 2.5,
          paddingBottom: () => 2.5,
        }
      }
    ],
    styles: {
      tblHdr: { bold: true, fontSize: 8, fillColor: C.tableHdrBg, color: C.tableHdrText, margin: [1, 2, 1, 2] }
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
  const { firmName, periodText, plModel } = data;

  type RowItemType = 'HEADER' | 'ITEM' | 'SUBTOTAL' | 'NET_PROFIT' | 'NET_LOSS' | 'EMPTY';
  interface PlStatementRow {
    label: string;
    amount: string;
    type: RowItemType;
    subtotalColor?: string;
  }

  // 1. Build Debit Side rows (Expenses & Losses)
  const drRows: PlStatementRow[] = [];

  // COGS
  drRows.push({ label: 'TO COST OF GOODS SOLD', amount: '', type: 'HEADER' });
  const drCOGS = plModel.drCOGS || [];
  if (drCOGS.length > 0) {
    drCOGS.forEach((a: any) => {
      drRows.push({ label: `    ${a.head}`, amount: formatCurrency(Math.abs(a.netCr)), type: 'ITEM' });
    });
  } else {
    drRows.push({ label: '    (No COGS accounts)', amount: formatCurrency(0), type: 'ITEM' });
  }
  drRows.push({ label: 'TOTAL COST OF SALES', amount: formatCurrency(plModel.sumDrCOGS), type: 'SUBTOTAL', subtotalColor: '#FEF3C7' });

  // Contra Income (if any)
  const drContraIncome = plModel.drContraIncome || [];
  if (drContraIncome.length > 0) {
    drRows.push({ label: 'TO RETURNS / CONTRA INCOME', amount: '', type: 'HEADER' });
    drContraIncome.forEach((a: any) => {
      drRows.push({ label: `    ${a.head}`, amount: formatCurrency(Math.abs(a.netCr)), type: 'ITEM' });
    });
    drRows.push({ label: 'TOTAL CONTRA INCOME', amount: formatCurrency(plModel.totalContraInc), type: 'SUBTOTAL', subtotalColor: '#FFEDD5' });
  }

  // Operating Expenses
  drRows.push({ label: 'TO OPERATING EXPENSES', amount: '', type: 'HEADER' });
  const drOpex = plModel.drOpex || [];
  if (drOpex.length > 0) {
    drOpex.forEach((a: any) => {
      drRows.push({ label: `    ${a.head}`, amount: formatCurrency(Math.abs(a.netCr)), type: 'ITEM' });
    });
  } else {
    drRows.push({ label: '    (No operating expenses)', amount: formatCurrency(0), type: 'ITEM' });
  }
  drRows.push({ label: 'TOTAL OPERATING EXPENSES', amount: formatCurrency(plModel.sumDrOpex), type: 'SUBTOTAL', subtotalColor: '#FFE4E6' });

  // Misc Expenses (if any)
  const drGeneral = plModel.drGeneral || [];
  if (drGeneral.length > 0) {
    drRows.push({ label: 'TO MISCELLANEOUS EXPENSES', amount: '', type: 'HEADER' });
    drGeneral.forEach((a: any) => {
      drRows.push({ label: `    ${a.head}`, amount: formatCurrency(Math.abs(a.netCr)), type: 'ITEM' });
    });
    drRows.push({ label: 'TOTAL MISC EXPENSES', amount: formatCurrency(plModel.sumDrGeneral), type: 'SUBTOTAL', subtotalColor: '#F1F5F9' });
  }

  // 2. Build Credit Side rows (Incomes & Revenues)
  const crRows: PlStatementRow[] = [];

  // Revenue / Sales
  crRows.push({ label: 'BY REVENUE / SALES', amount: '', type: 'HEADER' });
  const crIncome = plModel.crIncome || [];
  if (crIncome.length > 0) {
    crIncome.forEach((a: any) => {
      crRows.push({ label: `    ${a.head}`, amount: formatCurrency(a.netCr), type: 'ITEM' });
    });
  } else {
    crRows.push({ label: '    (No sales accounts)', amount: formatCurrency(0), type: 'ITEM' });
  }
  crRows.push({ label: 'TOTAL REVENUE', amount: formatCurrency(plModel.totalRevenueCr), type: 'SUBTOTAL', subtotalColor: '#D1FAE5' });

  // Misc Income (if any)
  const crGeneral = plModel.crGeneral || [];
  if (crGeneral.length > 0) {
    crRows.push({ label: 'BY MISCELLANEOUS INCOME', amount: '', type: 'HEADER' });
    crGeneral.forEach((a: any) => {
      crRows.push({ label: `    ${a.head}`, amount: formatCurrency(a.netCr), type: 'ITEM' });
    });
    crRows.push({ label: 'TOTAL MISC INCOME', amount: formatCurrency(plModel.sumCrGeneral), type: 'SUBTOTAL', subtotalColor: '#CCFBF1' });
  }

  // Contra Expense (Fare, Round Off, etc.)
  const contraExpenses = [...(plModel.crCOGS || []), ...(plModel.crOpex || [])];
  if (contraExpenses.length > 0) {
    crRows.push({ label: 'BY CONTRA EXPENSE', amount: '', type: 'HEADER' });
    contraExpenses.forEach((a: any) => {
      crRows.push({ label: `    ${a.head}`, amount: formatCurrency(a.netCr), type: 'ITEM' });
    });
    crRows.push({ label: 'TOTAL CONTRA EXPENSE', amount: formatCurrency(plModel.sumContraExpense), type: 'SUBTOTAL', subtotalColor: '#E0F2FE' });
  }

  // 3. Align rows before adding Net Profit / Loss
  const maxLen = Math.max(drRows.length, crRows.length);
  while (drRows.length < maxLen) {
    drRows.push({ label: '', amount: '', type: 'EMPTY' });
  }
  while (crRows.length < maxLen) {
    crRows.push({ label: '', amount: '', type: 'EMPTY' });
  }

  // 4. Net Profit / Net Loss balancing row
  if (plModel.netProfit >= 0) {
    drRows.push({ label: 'TO NET PROFIT (Transferred to Capital)', amount: formatCurrency(plModel.netProfit), type: 'NET_PROFIT' });
    crRows.push({ label: '', amount: '', type: 'EMPTY' });
  } else {
    drRows.push({ label: '', amount: '', type: 'EMPTY' });
    crRows.push({ label: 'BY NET LOSS (Transferred to Capital)', amount: formatCurrency(Math.abs(plModel.netProfit)), type: 'NET_LOSS' });
  }

  // 5. Construct Table Body
  const tableBody: any[] = [
    [
      { text: 'DEBIT SIDE (DR)', style: 'tblHdrDr' },
      { text: 'AMOUNT (₹)', style: 'tblHdrDr', alignment: 'right' },
      { text: 'CREDIT SIDE (CR)', style: 'tblHdrCr' },
      { text: 'AMOUNT (₹)', style: 'tblHdrCr', alignment: 'right' },
    ]
  ];

  for (let i = 0; i < drRows.length; i++) {
    const dr = drRows[i]!;
    const cr = crRows[i]!;

    const formatCell = (item: PlStatementRow) => {
      const isHeader = item.type === 'HEADER';
      const isSubtotal = item.type === 'SUBTOTAL';
      const isNetProfit = item.type === 'NET_PROFIT';
      const isNetLoss = item.type === 'NET_LOSS';
      const isEmpty = item.type === 'EMPTY';

      let bg = i % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
      let fontColor = C.textDark;
      let isBold = false;
      let fontSize = 8;

      if (isHeader) {
        bg = '#F1F5F9';
        fontColor = '#334155';
        isBold = true;
        fontSize = 7.5;
      } else if (isSubtotal) {
        bg = item.subtotalColor || '#F8FAFC';
        fontColor = '#0F172A';
        isBold = true;
        fontSize = 8;
      } else if (isNetProfit) {
        bg = '#EDE9FE';
        fontColor = '#5B21B6';
        isBold = true;
        fontSize = 8.5;
      } else if (isNetLoss) {
        bg = '#FEE2E2';
        fontColor = '#991B1B';
        isBold = true;
        fontSize = 8.5;
      } else if (isEmpty) {
        bg = '#FFFFFF';
      }

      return [
        {
          text: item.label,
          fontSize,
          bold: isBold,
          color: fontColor,
          fillColor: bg,
          margin: [2, 2.5, 2, 2.5]
        },
        {
          text: item.amount,
          fontSize,
          bold: isBold,
          alignment: 'right',
          color: fontColor,
          fillColor: bg,
          margin: [2, 2.5, 2, 2.5]
        }
      ];
    };

    const [drLabel, drAmount] = formatCell(dr);
    const [crLabel, crAmount] = formatCell(cr);

    tableBody.push([drLabel, drAmount, crLabel, crAmount]);
  }

  // Footer Grand Totals
  tableBody.push([
    { text: 'DR TOTAL', bold: true, fontSize: 9, color: '#FFFFFF', fillColor: '#4F46E5', margin: [2, 4, 2, 4] },
    { text: formatCurrency(plModel.drGrand), bold: true, fontSize: 9, alignment: 'right', color: '#FFFFFF', fillColor: '#4F46E5', margin: [2, 4, 2, 4] },
    { text: 'CR TOTAL', bold: true, fontSize: 9, color: '#FFFFFF', fillColor: '#4F46E5', margin: [2, 4, 2, 4] },
    { text: formatCurrency(plModel.crGrand), bold: true, fontSize: 9, alignment: 'right', color: '#FFFFFF', fillColor: '#4F46E5', margin: [2, 4, 2, 4] },
  ]);

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 25, 30, 25],
    defaultStyle: { fontSize: 8.5, color: C.textDark },
    content: [
      { text: (firmName || '').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
      { text: 'TRADING AND PROFIT & LOSS STATEMENT', fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
      { text: periodText, fontSize: 8.5, italic: true, alignment: 'center', margin: [0, 0, 0, 8] },

      // Executive KPI Cards
      {
        margin: [0, 0, 0, 9],
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              {
                fillColor: '#F0FDF4',
                margin: [4, 4, 4, 4],
                stack: [
                  { text: 'REVENUE', fontSize: 7, bold: true, color: '#166534' },
                  { text: formatCurrency(plModel.totalRevenueCr), fontSize: 10, bold: true, color: '#14532D', margin: [0, 2, 0, 0] },
                  { text: `${(plModel.crIncome || []).length} account(s)`, fontSize: 6.5, color: '#166534' }
                ]
              },
              {
                fillColor: '#F0F9FF',
                margin: [4, 4, 4, 4],
                stack: [
                  { text: 'GROSS PROFIT', fontSize: 7, bold: true, color: '#0369A1' },
                  { text: formatCurrency(plModel.grossProfit), fontSize: 10, bold: true, color: plModel.grossProfit >= 0 ? '#075985' : '#991B1B', margin: [0, 2, 0, 0] },
                  { text: `${(plModel.gpMargin || 0).toFixed(1)}% GP Margin`, fontSize: 6.5, color: '#0369A1' }
                ]
              },
              {
                fillColor: '#FFFBEB',
                margin: [4, 4, 4, 4],
                stack: [
                  { text: 'TOTAL OPEX', fontSize: 7, bold: true, color: '#B45309' },
                  { text: formatCurrency(plModel.totalOpex), fontSize: 10, bold: true, color: '#78350F', margin: [0, 2, 0, 0] },
                  { text: `${(plModel.drOpex || []).length} account(s)`, fontSize: 6.5, color: '#B45309' }
                ]
              },
              {
                fillColor: plModel.netProfit >= 0 ? '#FAF5FF' : '#FEF2F2',
                margin: [4, 4, 4, 4],
                stack: [
                  { text: 'NET PROFIT', fontSize: 7, bold: true, color: plModel.netProfit >= 0 ? '#6B21A8' : '#991B1B' },
                  { text: formatCurrency(plModel.netProfit), fontSize: 10, bold: true, color: plModel.netProfit >= 0 ? '#581C87' : '#991B1B', margin: [0, 2, 0, 0] },
                  { text: `${(plModel.npMargin || 0).toFixed(1)}% NP Margin`, fontSize: 6.5, color: plModel.netProfit >= 0 ? '#6B21A8' : '#991B1B' }
                ]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#E2E8F0',
          vLineColor: () => '#E2E8F0',
        }
      },

      // Statement Table
      {
        table: {
          widths: ['*', 105, '*', 105],
          body: tableBody
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: (i: number) => (i === 0 || i === 2 || i === 4 ? 1 : 0.5),
          hLineColor: () => '#E2E8F0',
          vLineColor: () => '#E2E8F0',
        }
      }
    ],
    styles: {
      tblHdrDr: { bold: true, fontSize: 8.5, fillColor: '#BE123C', color: '#FFFFFF', margin: [2, 3, 2, 3] },
      tblHdrCr: { bold: true, fontSize: 8.5, fillColor: '#047857', color: '#FFFFFF', margin: [2, 3, 2, 3] },
    }
  };

  return createPdfBufferFromDocDef(docDefinition);
}

export async function exportBalanceSheetToPdfBuffer(data: {
  firmName: string;
  periodText: string;
  bsModel: any;
}): Promise<Buffer> {
  const { firmName, periodText, bsModel } = data;

  const totalCapitalPool = (bsModel.capital || 0) + (bsModel.netProfit || 0) + (bsModel.diffObCr || 0);
  const totalOtherLiab = (bsModel.totalDebtorCreditBalances || 0) + (bsModel.totalCashBankCreditBalances || 0) + (bsModel.totalAssetCreditBalances || 0);
  const totalOtherDebits = (bsModel.totalLiabilityDebitBalances || 0) + (bsModel.diffObDr || 0);

  // 1. Main Statutory Balance Sheet Rows (Page 1)
  const mainLiabRows: Array<{ label: string; sch: string; amount: string; isBold?: boolean }> = [
    { label: 'Capital Account / Equity Fund', sch: '1', amount: formatCurrency(totalCapitalPool), isBold: true },
    { label: 'Loans & Borrowings (Liabilities)', sch: '2', amount: formatCurrency(bsModel.totalLiab || 0) },
    { label: 'Trade Payables (Sundry Creditors)', sch: '3', amount: formatCurrency(bsModel.totalCred || 0), isBold: true },
    { label: 'Other Current Liabilities & Provisions', sch: '4', amount: formatCurrency(totalOtherLiab) },
  ];

  const mainAssetRows: Array<{ label: string; sch: string; amount: string; isBold?: boolean }> = [
    { label: 'Fixed & Non-Current Assets', sch: '5', amount: formatCurrency(bsModel.totalOtherA || 0) },
    { label: 'Inventories (Closing Stock)', sch: '6', amount: formatCurrency(bsModel.totalStock || 0) },
    { label: 'Trade Receivables (Sundry Debtors)', sch: '7', amount: formatCurrency(bsModel.totalDebtors || 0), isBold: true },
    { label: 'Cash & Cash Equivalents', sch: '8', amount: formatCurrency(bsModel.totalCashBank || 0) },
    { label: 'Tax Receivables (GST Input Credit)', sch: '9', amount: formatCurrency(bsModel.totalGST || 0) },
  ];

  if (totalOtherDebits > 0) {
    mainAssetRows.push({ label: 'Other Debit Balances & Advances', sch: '10', amount: formatCurrency(totalOtherDebits) });
  }

  // Pad main table rows to equal length
  const maxMainLen = Math.max(mainLiabRows.length, mainAssetRows.length);
  while (mainLiabRows.length < maxMainLen) {
    mainLiabRows.push({ label: '', sch: '', amount: '' });
  }
  while (mainAssetRows.length < maxMainLen) {
    mainAssetRows.push({ label: '', sch: '', amount: '' });
  }

  const mainTableBody: any[] = [
    [
      { text: 'LIABILITIES & CAPITAL', style: 'tblHdrLiab' },
      { text: 'SCH', style: 'tblHdrLiab', alignment: 'center' },
      { text: 'AMOUNT (₹)', style: 'tblHdrLiab', alignment: 'right' },
      { text: 'ASSETS', style: 'tblHdrAsset' },
      { text: 'SCH', style: 'tblHdrAsset', alignment: 'center' },
      { text: 'AMOUNT (₹)', style: 'tblHdrAsset', alignment: 'right' },
    ]
  ];

  for (let i = 0; i < maxMainLen; i++) {
    const l = mainLiabRows[i]!;
    const a = mainAssetRows[i]!;
    const bg = i % 2 === 0 ? '#FFFFFF' : '#FAFAFA';

    mainTableBody.push([
      { text: l.label, fontSize: 8, bold: l.isBold, color: C.textDark, fillColor: bg, margin: [2, 3, 2, 3] },
      { text: l.sch, fontSize: 8, bold: true, color: '#475569', fillColor: bg, alignment: 'center', margin: [2, 3, 2, 3] },
      { text: l.amount, fontSize: 8, bold: l.isBold, color: C.textDark, fillColor: bg, alignment: 'right', margin: [2, 3, 2, 3] },
      { text: a.label, fontSize: 8, bold: a.isBold, color: C.textDark, fillColor: bg, margin: [2, 3, 2, 3] },
      { text: a.sch, fontSize: 8, bold: true, color: '#475569', fillColor: bg, alignment: 'center', margin: [2, 3, 2, 3] },
      { text: a.amount, fontSize: 8, bold: a.isBold, color: C.textDark, fillColor: bg, alignment: 'right', margin: [2, 3, 2, 3] },
    ]);
  }

  // Footer Grand Totals
  mainTableBody.push([
    { text: 'TOTAL CAPITAL & LIABILITIES', bold: true, fontSize: 9, color: '#FFFFFF', fillColor: '#1E293B', margin: [2, 4, 2, 4] },
    { text: '', fillColor: '#1E293B' },
    { text: formatCurrency(bsModel.totalLiabSide), bold: true, fontSize: 9, alignment: 'right', color: '#FFFFFF', fillColor: '#1E293B', margin: [2, 4, 2, 4] },
    { text: 'TOTAL ASSETS', bold: true, fontSize: 9, color: '#FFFFFF', fillColor: '#1E293B', margin: [2, 4, 2, 4] },
    { text: '', fillColor: '#1E293B' },
    { text: formatCurrency(bsModel.totalAssets), bold: true, fontSize: 9, alignment: 'right', color: '#FFFFFF', fillColor: '#1E293B', margin: [2, 4, 2, 4] },
  ]);

  // 2. Build Detailed Annexures (Pages 2+)
  const annexureContent: any[] = [
    { text: '', pageBreak: 'before' },
    { text: (firmName || '').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
    { text: 'ANNEXURES FORMING PART OF THE BALANCE SHEET', fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
    { text: `${periodText} — Detailed Supporting Schedules`, fontSize: 8.5, italic: true, alignment: 'center', margin: [0, 0, 0, 12] },
  ];

  const buildAnnexureTable = (
    title: string,
    scheduleNo: string,
    columns: { header: string; width: any; align?: string }[],
    rows: any[][],
    totalLabel: string,
    totalVal: number
  ) => {
    return [
      {
        margin: [0, 6, 0, 3],
        text: `SCHEDULE / ANNEXURE ${scheduleNo}: ${title.toUpperCase()}`,
        fontSize: 8.5,
        bold: true,
        color: '#1E293B'
      },
      {
        margin: [0, 0, 0, 8],
        table: {
          widths: columns.map(c => c.width),
          body: [
            columns.map(c => ({ text: c.header, style: 'tblHdrAnnex', alignment: c.align || 'left' })),
            ...rows.map((row, idx) =>
              row.map((cell, cIdx) => ({
                text: cell,
                fontSize: 7.5,
                color: C.textDark,
                fillColor: idx % 2 === 0 ? '#FFFFFF' : '#FBFBFB',
                alignment: columns[cIdx]?.align || 'left',
                margin: [2, 2, 2, 2]
              }))
            ),
            [
              {
                text: totalLabel,
                colSpan: columns.length - 1,
                bold: true,
                fontSize: 8,
                fillColor: '#F1F5F9',
                color: '#0F172A',
                margin: [2, 3, 2, 3]
              },
              ...Array(columns.length - 2).fill({}),
              {
                text: formatCurrency(totalVal),
                bold: true,
                fontSize: 8,
                alignment: 'right',
                fillColor: '#F1F5F9',
                color: '#0F172A',
                margin: [2, 3, 2, 3]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: () => 0.5,
          hLineColor: () => '#CBD5E1',
          vLineColor: () => '#E2E8F0',
        }
      }
    ];
  };

  // Annexure 1: Capital Account
  const capRows = [
    ['1', "Opening Capital / Proprietor's Equity", formatCurrency(Math.abs(bsModel.capital || 0))],
    ['2', (bsModel.netProfit || 0) >= 0 ? 'Add: Net Profit for the period (from P&L)' : 'Less: Net Loss for the period (from P&L)', formatCurrency(Math.abs(bsModel.netProfit || 0))],
  ];
  if ((bsModel.diffObCr || 0) > 0) {
    capRows.push(['3', 'Add: Difference in Opening Balances', formatCurrency(bsModel.diffObCr)]);
  }
  annexureContent.push(
    ...buildAnnexureTable(
      'Capital Account / Equity Fund',
      '1',
      [{ header: '#', width: 25, align: 'center' }, { header: 'Particulars', width: '*' }, { header: 'Amount (₹)', width: 105, align: 'right' }],
      capRows,
      'TOTAL CAPITAL FUND (Carried to Balance Sheet Sch 1)',
      totalCapitalPool
    )
  );

  // Annexure 3: Sundry Creditors (Trade Payables)
  const creditors = bsModel.creditors || [];
  if (creditors.length > 0) {
    const credRows = creditors.map((c: any, idx: number) => [
      String(idx + 1),
      c.head,
      c.type?.replace(/_/g, ' ') || 'Sundry Creditor',
      formatCurrency(c.netCr)
    ]);
    annexureContent.push(
      ...buildAnnexureTable(
        'Trade Payables (Sundry Creditors)',
        '3',
        [{ header: '#', width: 25, align: 'center' }, { header: 'Supplier / Party Name', width: '*' }, { header: 'Account Classification', width: 130 }, { header: 'Amount (₹)', width: 105, align: 'right' }],
        credRows,
        `TOTAL SUNDRY CREDITORS (${creditors.length} Accounts - Carried to Sch 3)`,
        bsModel.totalCred
      )
    );
  }

  // Annexure 7: Sundry Debtors (Trade Receivables)
  const debtors = bsModel.debtors || [];
  if (debtors.length > 0) {
    const debRows = debtors.map((d: any, idx: number) => [
      String(idx + 1),
      d.head,
      d.type?.replace(/_/g, ' ') || 'Sundry Debtor',
      formatCurrency(d.netDr)
    ]);
    annexureContent.push(
      ...buildAnnexureTable(
        'Trade Receivables (Sundry Debtors)',
        '7',
        [{ header: '#', width: 25, align: 'center' }, { header: 'Customer / Client Name', width: '*' }, { header: 'Account Classification', width: 130 }, { header: 'Amount (₹)', width: 105, align: 'right' }],
        debRows,
        `TOTAL SUNDRY DEBTORS (${debtors.length} Accounts - Carried to Sch 7)`,
        bsModel.totalDebtors
      )
    );
  }

  // Annexure 9: Tax Receivables (GST Input Credit)
  const gstAssets = bsModel.gstAssets || [];
  if (gstAssets.length > 0) {
    const gstRows = gstAssets.map((g: any, idx: number) => [
      String(idx + 1),
      g.head,
      'Tax Receivable / Input Tax Credit',
      formatCurrency(g.netDr)
    ]);
    annexureContent.push(
      ...buildAnnexureTable(
        'Tax Receivables (GST Input Credit)',
        '9',
        [{ header: '#', width: 25, align: 'center' }, { header: 'Tax Account Head', width: '*' }, { header: 'Nature', width: 130 }, { header: 'Amount (₹)', width: 105, align: 'right' }],
        gstRows,
        `TOTAL TAX RECEIVABLES (Carried to Sch 9)`,
        bsModel.totalGST
      )
    );
  }

  // Annexure 8: Cash & Bank Balances
  const cashBank = bsModel.cashBank || [];
  if (cashBank.length > 0) {
    const cbRows = cashBank.map((b: any, idx: number) => [
      String(idx + 1),
      b.head,
      b.type?.replace(/_/g, ' ') || 'Bank Account',
      formatCurrency(b.netDr)
    ]);
    annexureContent.push(
      ...buildAnnexureTable(
        'Cash & Bank Balances',
        '8',
        [{ header: '#', width: 25, align: 'center' }, { header: 'Bank / Cash Account Head', width: '*' }, { header: 'Nature', width: 130 }, { header: 'Amount (₹)', width: 105, align: 'right' }],
        cbRows,
        `TOTAL CASH & BANK BALANCES (Carried to Sch 8)`,
        bsModel.totalCashBank
      )
    );
  }

  // Annexure 5: Fixed & Non-Current Assets
  const otherAssets = bsModel.otherAssets || [];
  if (otherAssets.length > 0) {
    const oaRows = otherAssets.map((a: any, idx: number) => [
      String(idx + 1),
      a.head,
      a.type?.replace(/_/g, ' ') || 'Fixed Asset',
      formatCurrency(a.netDr)
    ]);
    annexureContent.push(
      ...buildAnnexureTable(
        'Fixed & Non-Current Assets',
        '5',
        [{ header: '#', width: 25, align: 'center' }, { header: 'Asset Head', width: '*' }, { header: 'Classification', width: 130 }, { header: 'Amount (₹)', width: 105, align: 'right' }],
        oaRows,
        `TOTAL FIXED ASSETS (Carried to Sch 5)`,
        bsModel.totalOtherA
      )
    );
  }

  // Annexure 6: Inventories (Closing Stock)
  const stockAssets = bsModel.stockAssets || [];
  if (stockAssets.length > 0) {
    const stRows = stockAssets.map((s: any, idx: number) => [
      String(idx + 1),
      s.head,
      'Inventory / Stock Ledger',
      formatCurrency(s.netDr)
    ]);
    annexureContent.push(
      ...buildAnnexureTable(
        'Inventories (Closing Stock)',
        '6',
        [{ header: '#', width: 25, align: 'center' }, { header: 'Stock Account', width: '*' }, { header: 'Valuation', width: 130 }, { header: 'Amount (₹)', width: 105, align: 'right' }],
        stRows,
        `TOTAL INVENTORIES (Carried to Sch 6)`,
        bsModel.totalStock
      )
    );
  }

  // Annexure 2: Loans & Borrowings
  const liabilities = bsModel.liabilities || [];
  if (liabilities.length > 0) {
    const liabRows = liabilities.map((l: any, idx: number) => [
      String(idx + 1),
      l.head,
      l.type?.replace(/_/g, ' ') || 'Loan / Liability',
      formatCurrency(l.netCr)
    ]);
    annexureContent.push(
      ...buildAnnexureTable(
        'Loans & Borrowings (Liabilities)',
        '2',
        [{ header: '#', width: 25, align: 'center' }, { header: 'Lender / Account Head', width: '*' }, { header: 'Classification', width: 130 }, { header: 'Amount (₹)', width: 105, align: 'right' }],
        liabRows,
        `TOTAL LOANS & BORROWINGS (Carried to Sch 2)`,
        bsModel.totalLiab
      )
    );
  }

  // Annexure 4: Other Current Liabilities
  const otherLiabItems = [
    ...(bsModel.debtorCreditBalances || []).map((a: any) => ({ head: `${a.head} (Customer Advance)`, type: 'Customer Credit', netCr: a.netCr })),
    ...(bsModel.cashBankCreditBalances || []).map((a: any) => ({ head: `${a.head} (Bank OD)`, type: 'Bank Overdraft', netCr: a.netCr })),
    ...(bsModel.assetCreditBalances || []).map((a: any) => ({ head: a.head, type: 'Credit Balance', netCr: a.netCr })),
  ];
  if (otherLiabItems.length > 0) {
    const olRows = otherLiabItems.map((o: any, idx: number) => [
      String(idx + 1),
      o.head,
      o.type,
      formatCurrency(o.netCr)
    ]);
    annexureContent.push(
      ...buildAnnexureTable(
        'Other Current Liabilities & Credit Balances',
        '4',
        [{ header: '#', width: 25, align: 'center' }, { header: 'Account Head', width: '*' }, { header: 'Nature', width: 130 }, { header: 'Amount (₹)', width: 105, align: 'right' }],
        olRows,
        `TOTAL OTHER LIABILITIES (Carried to Sch 4)`,
        totalOtherLiab
      )
    );
  }

  // Annexure 10: Other Debit Balances & Advances
  const otherDebitItems = [
    ...(bsModel.liabilityDebitBalances || []).map((a: any) => ({ head: `${a.head} (Advance / Dr)`, type: 'Liability Debit', netDr: a.netDr })),
    ...(bsModel.diffObDr > 0 ? [{ head: 'Difference in Opening Balances', type: 'Opening Balance Contra', netDr: bsModel.diffObDr }] : []),
  ];
  if (otherDebitItems.length > 0) {
    const odRows = otherDebitItems.map((o: any, idx: number) => [
      String(idx + 1),
      o.head,
      o.type,
      formatCurrency(o.netDr)
    ]);
    annexureContent.push(
      ...buildAnnexureTable(
        'Other Debit Balances & Advances',
        '10',
        [{ header: '#', width: 25, align: 'center' }, { header: 'Account Head', width: '*' }, { header: 'Nature', width: 130 }, { header: 'Amount (₹)', width: 105, align: 'right' }],
        odRows,
        `TOTAL OTHER DEBITS (Carried to Sch 10)`,
        totalOtherDebits
      )
    );
  }

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 25, 30, 25],
    defaultStyle: { fontSize: 8.5, color: C.textDark },
    content: [
      // PAGE 1: STATUTORY BALANCE SHEET
      { text: (firmName || '').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
      { text: 'BALANCE SHEET STATEMENT', fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 1] },
      { text: `(Prepared in accordance with ICAI Standards & Schedule III GAAP) — ${periodText}`, fontSize: 8, italic: true, alignment: 'center', margin: [0, 0, 0, 8] },

      // Executive KPI Cards
      {
        margin: [0, 0, 0, 8],
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              {
                fillColor: '#F0FDF4',
                margin: [4, 4, 4, 4],
                stack: [
                  { text: 'TOTAL ASSETS', fontSize: 7, bold: true, color: '#166534' },
                  { text: formatCurrency(bsModel.totalAssets), fontSize: 10, bold: true, color: '#14532D', margin: [0, 2, 0, 0] },
                  { text: `${bsModel.assetSideCount || 0} asset A/Cs`, fontSize: 6.5, color: '#166534' }
                ]
              },
              {
                fillColor: '#FFF1F2',
                margin: [4, 4, 4, 4],
                stack: [
                  { text: 'EXTERNAL LIABILITIES', fontSize: 7, bold: true, color: '#BE123C' },
                  { text: formatCurrency(bsModel.totalExtLib), fontSize: 10, bold: true, color: '#9F1239', margin: [0, 2, 0, 0] },
                  { text: `${bsModel.liabilitySideCount || 0} liability A/Cs`, fontSize: 6.5, color: '#BE123C' }
                ]
              },
              {
                fillColor: (bsModel.capital || 0) >= 0 ? '#F0F9FF' : '#FEF2F2',
                margin: [4, 4, 4, 4],
                stack: [
                  { text: 'CAPITAL (EQUITY)', fontSize: 7, bold: true, color: (bsModel.capital || 0) >= 0 ? '#0369A1' : '#991B1B' },
                  { text: formatCurrency(Math.abs(bsModel.capital || 0)), fontSize: 10, bold: true, color: (bsModel.capital || 0) >= 0 ? '#075985' : '#991B1B', margin: [0, 2, 0, 0] },
                  { text: (bsModel.capital || 0) >= 0 ? 'Owner Equity' : 'Equity Deficit', fontSize: 6.5, color: (bsModel.capital || 0) >= 0 ? '#0369A1' : '#991B1B' }
                ]
              },
              {
                fillColor: (bsModel.netProfit || 0) >= 0 ? '#FAF5FF' : '#FEF2F2',
                margin: [4, 4, 4, 4],
                stack: [
                  { text: 'NET PROFIT / (LOSS)', fontSize: 7, bold: true, color: (bsModel.netProfit || 0) >= 0 ? '#6B21A8' : '#991B1B' },
                  { text: formatCurrency(Math.abs(bsModel.netProfit || 0)), fontSize: 10, bold: true, color: (bsModel.netProfit || 0) >= 0 ? '#581C87' : '#991B1B', margin: [0, 2, 0, 0] },
                  { text: (bsModel.netProfit || 0) >= 0 ? 'Period Surplus' : 'Period Deficit', fontSize: 6.5, color: (bsModel.netProfit || 0) >= 0 ? '#6B21A8' : '#991B1B' }
                ]
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#E2E8F0',
          vLineColor: () => '#E2E8F0',
        }
      },

      // Financial Ratios Bar
      {
        margin: [0, 0, 0, 9],
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              { text: `Current Ratio: ${(bsModel.currentRatio || 0).toFixed(2)}`, fontSize: 7.5, bold: true, color: '#334155', fillColor: '#F8FAFC', alignment: 'center', margin: [2, 3, 2, 3] },
              { text: `Quick Ratio: ${(bsModel.quickRatio || 0).toFixed(2)}`, fontSize: 7.5, bold: true, color: '#334155', fillColor: '#F8FAFC', alignment: 'center', margin: [2, 3, 2, 3] },
              { text: `Working Capital: ${formatCurrency(bsModel.workingCapital || 0)}`, fontSize: 7.5, bold: true, color: '#334155', fillColor: '#F8FAFC', alignment: 'center', margin: [2, 3, 2, 3] },
              { text: bsModel.balanced ? 'STATUS: BALANCED' : 'STATUS: IMBALANCED', fontSize: 7.5, bold: true, color: bsModel.balanced ? '#059669' : '#DC2626', fillColor: bsModel.balanced ? '#ECFDF5' : '#FEF2F2', alignment: 'center', margin: [2, 3, 2, 3] },
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CBD5E1',
          vLineColor: () => '#CBD5E1',
        }
      },

      // Main Statutory Balance Sheet Table (with Schedule references)
      {
        table: {
          widths: ['*', 32, 95, '*', 32, 95],
          body: mainTableBody
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
          vLineWidth: (i: number) => (i === 0 || i === 3 || i === 6 ? 1 : 0.5),
          hLineColor: () => '#CBD5E1',
          vLineColor: () => '#CBD5E1',
        }
      },

      // Statutory Sign-off Block on Page 1
      {
        margin: [0, 16, 0, 0],
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Significant Accounting Policies and Notes & Annexures (1 to 10) form an integral part of this Balance Sheet.', fontSize: 7, italic: true, color: '#64748B' },
              { text: 'As per our report of even date attached.', fontSize: 7, color: '#64748B', margin: [0, 2, 0, 14] },
              { text: `For ${(firmName || 'THE FIRM').toUpperCase()}`, fontSize: 8, bold: true, color: '#0F172A' },
              { text: '\n\nProprietor / Partner / Director', fontSize: 7.5, color: '#475569' }
            ]
          },
          {
            width: 240,
            stack: [
              { text: 'For Statutory Compliance & Audit Records', fontSize: 7, bold: true, alignment: 'right', color: '#64748B' },
              { text: `Place: Siliguri, WB\nDate: ${periodText.replace(/As of /i, '')}`, fontSize: 7, alignment: 'right', color: '#64748B', margin: [0, 2, 0, 14] },
              { text: 'Chartered Accountants / Authorised Signatory', fontSize: 8, bold: true, alignment: 'right', color: '#0F172A' },
              { text: '\n\nFirm Reg No. / UDIN Applicable', fontSize: 7, alignment: 'right', color: '#64748B' }
            ]
          }
        ]
      },

      // PAGES 2+: DETAILED ANNEXURES
      ...annexureContent
    ],
    styles: {
      tblHdrLiab: { bold: true, fontSize: 8.5, fillColor: '#BE123C', color: '#FFFFFF', margin: [2, 3, 2, 3] },
      tblHdrAsset: { bold: true, fontSize: 8.5, fillColor: '#047857', color: '#FFFFFF', margin: [2, 3, 2, 3] },
      tblHdrAnnex: { bold: true, fontSize: 8, fillColor: '#334155', color: '#FFFFFF', margin: [2, 3, 2, 3] },
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

// ── Day Book PDF Generator ──────────────────────────────────────────────────
export async function generateDayBookPdf(data: {
  firmName: string;
  periodText: string;
  vouchers: any[];
  summary: any;
}): Promise<Buffer> {
  const tableBody: any[] = [
    [
      { text: 'Date', style: 'tblHdr', alignment: 'center' },
      { text: 'Voucher No', style: 'tblHdr' },
      { text: 'Type', style: 'tblHdr', alignment: 'center' },
      { text: 'Particulars (Account Heads)', style: 'tblHdr' },
      { text: 'Narration', style: 'tblHdr' },
      { text: 'Debit (₹)', style: 'tblHdr', alignment: 'right' },
      { text: 'Credit (₹)', style: 'tblHdr', alignment: 'right' }
    ]
  ];

  (data.vouchers || []).forEach((v: any) => {
    if (Array.isArray(v.entries) && v.entries.length > 0) {
      v.entries.forEach((en: any, entryIdx: number) => {
        tableBody.push([
          { text: entryIdx === 0 ? v.transactionDate : '', alignment: 'center', fontSize: 7.5 },
          { text: entryIdx === 0 ? v.voucherNo : '', bold: entryIdx === 0, fontSize: 8 },
          { text: entryIdx === 0 ? v.voucherType : '', alignment: 'center', fontSize: 7.5 },
          { text: `${en.debitAmount > 0 ? 'Dr. ' : '     To '} ${en.accountHead}`, bold: en.debitAmount > 0, fontSize: 8 },
          { text: entryIdx === 0 ? (v.narration || '') : '', fontSize: 7.5, color: C.textMid },
          { text: en.debitAmount > 0 ? formatCurrency(en.debitAmount) : '', alignment: 'right', fontSize: 8, color: C.green },
          { text: en.creditAmount > 0 ? formatCurrency(en.creditAmount) : '', alignment: 'right', fontSize: 8, color: C.red }
        ]);
      });
    } else {
      tableBody.push([
        { text: v.transactionDate, alignment: 'center', fontSize: 7.5 },
        { text: v.voucherNo, bold: true, fontSize: 8 },
        { text: v.voucherType, alignment: 'center', fontSize: 7.5 },
        { text: v.primaryAccount, fontSize: 8 },
        { text: v.narration || '', fontSize: 7.5, color: C.textMid },
        { text: v.totalDebit > 0 ? formatCurrency(v.totalDebit) : '', alignment: 'right', fontSize: 8, color: C.green },
        { text: v.totalCredit > 0 ? formatCurrency(v.totalCredit) : '', alignment: 'right', fontSize: 8, color: C.red }
      ]);
    }
  });

  // Grand Total Row
  tableBody.push([
    { text: 'TOTALS', colSpan: 4, bold: true, alignment: 'right', fontSize: 8.5 },
    {},
    {},
    {},
    { text: `Count: ${data.summary.totalVouchers || 0}`, bold: true, fontSize: 8 },
    { text: formatCurrency(data.summary.totalDebits || 0), alignment: 'right', bold: true, color: C.green, fontSize: 8.5 },
    { text: formatCurrency(data.summary.totalCredits || 0), alignment: 'right', bold: true, color: C.red, fontSize: 8.5 }
  ]);

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [25, 25, 25, 25],
    defaultStyle: { fontSize: 8, color: C.textDark },
    content: [
      { text: (data.firmName || '').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
      { text: 'DAY BOOK (TRANSACTION JOURNAL)', fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
      { text: `Period: ${data.periodText}  |  Generated on: ${new Date().toLocaleString('en-IN')}`, fontSize: 8, italic: true, alignment: 'center', margin: [0, 0, 0, 8] },
      {
        columns: [
          { text: `Total Vouchers: ${data.summary.totalVouchers || 0}`, bold: true },
          { text: `Total Inflows: ${formatCurrency(data.summary.totalReceipts || 0)}`, bold: true, color: C.green },
          { text: `Total Outflows: ${formatCurrency(data.summary.totalPayments || 0)}`, bold: true, color: C.red },
          { text: `Status: ${data.summary.isBooksBalanced ? 'BALANCED (Dr = Cr)' : 'IMBALANCED'}`, bold: true, alignment: 'right' }
        ],
        margin: [0, 0, 0, 6]
      },
      {
        table: {
          headerRows: 1,
          widths: [55, 75, 55, 210, '*', 95, 95],
          body: tableBody
        }
      }
    ],
    styles: {
      tblHdr: { bold: true, fontSize: 8, fillColor: C.tableHdrBg, color: C.tableHdrText, margin: [2, 3, 2, 3] }
    }
  };

  return createPdfBufferFromDocDef(docDefinition);
}
