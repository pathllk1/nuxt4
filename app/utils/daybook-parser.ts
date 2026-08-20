import * as XLSX from 'xlsx';

export interface DaybookRawRow {
  voucherNumber: string;
  reference: string;
  date: string;
  voucherType: string;
  partyName: string;
  partyAlias: string;
  gstin: string;
  supplyType: 'INTRA' | 'INTER';
  pos: string;
  itemName: string;
  mrp: number;
  hsn: string;
  gstRate: number;
  godown: string;
  batch: string;
  actualQty: number;
  billedQty: number;
  rate: number;
  purchaseRate: number;
  unit: string;
  discount: number;
  discountAmount: number;
  margin: number;
  amount: number; // Taxable value
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number; // Taxable + Tax
  ledger: string;
  narration: string;
}

export interface DaybookVoucher {
  voucherNumber: string;
  date: string;
  voucherType: string;
  partyName: string;
  gstin: string;
  pos: string;
  supplyType: 'INTRA' | 'INTER';
  narration: string;
  itemsCount: number;
  totalActualQty: number;
  totalBilledQty: number;
  totalAmount: number; // Taxable
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  unroundedGrandTotal: number;
  roundOff: number;
  grandTotal: number; // Final Rounded Invoice Bill Value
  totalCost: number;
  totalMargin: number;
  marginPct: number;
  items: DaybookRawRow[];
  gstr1Status: 'MATCHED' | 'MISMATCH' | 'B2CS_RETAIL' | 'UNFILED' | 'NOT_CHECKED';
  gstr1MatchDetails?: {
    gstr1Taxable: number;
    gstr1TotalTax: number;
    gstr1GrandTotal: number;
    taxVariance: number;
  };
}

export interface DaybookStockSummary {
  itemName: string;
  hsn: string;
  unit: string;
  godown: string;
  batch: string;
  gstRate: number;
  totalActualQty: number;
  totalBilledQty: number;
  avgSellingRate: number;
  avgPurchaseRate: number;
  totalRevenue: number; // Taxable
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  totalWithTax: number;
  totalCost: number;
  totalMargin: number;
  marginPct: number;
  transactionCount: number;
  parties: Set<string>;
}

export interface DaybookPartySummary {
  partyName: string;
  gstin: string;
  pos: string;
  supplyType: 'INTRA' | 'INTER';
  voucherCount: number;
  itemsCount: number;
  totalQty: number;
  totalAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  grandTotal: number;
  totalCost: number;
  totalMargin: number;
  marginPct: number;
  itemsList: {
    itemName: string;
    qty: number;
    unit: string;
    amount: number;
    tax: number;
    grandTotal: number;
    margin: number;
  }[];
}

export interface DaybookHsnSummary {
  hsn: string;
  gstRate: number;
  totalQty: number;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  totalWithTax: number;
  totalCost: number;
  totalMargin: number;
  marginPct: number;
  itemsCount: number;
}

export interface Gstr1Reconciliation {
  hasGstr1: boolean;
  supplierGstin: string;
  returnPeriod: string;
  b2bInvoicesCount: number;
  b2bMatchedCount: number;
  b2bMismatchCount: number;
  unfiledInvoicesCount: number;
  b2csRetailTaxable: number;
  b2csRetailTax: number;
  totalGstr1Taxable: number;
  totalGstr1Tax: number;
  totalGstr1GrandTotal: number;
  taxVariance: number;
  discrepancies: {
    voucherNumber: string;
    partyName: string;
    issue: string;
    bookTaxable: number;
    gstr1Taxable: number;
    bookTax: number;
    gstr1Tax: number;
  }[];
}

export interface DaybookParsedData {
  fileName: string;
  sheetName: string;
  totalRawRows: number;
  supplierGstin: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalRevenue: number; // Taxable Turnover
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalGstTax: number;
    totalBillValue: number; // Grand Total with Tax
    totalCost: number;
    totalGrossMargin: number;
    overallMarginPct: number;
    totalActualQty: number;
    totalBilledQty: number;
    totalVouchers: number;
    uniqueParties: number;
    uniqueItems: number;
    uniqueHsns: number;
    positiveMarginCount: number;
    negativeMarginCount: number;
    intraStateCount: number;
    interStateCount: number;
  };
  vouchers: DaybookVoucher[];
  stockConsumption: DaybookStockSummary[];
  partySummary: DaybookPartySummary[];
  hsnSummary: DaybookHsnSummary[];
  marginWatchlist: {
    stars: DaybookStockSummary[];
    stable: DaybookStockSummary[];
    low: DaybookStockSummary[];
    negative: DaybookStockSummary[];
  };
  reconciliation: Gstr1Reconciliation;
  rawRows: DaybookRawRow[];
}

export function parseExcelDate(val: any): string {
  if (!val && val !== 0) return '';
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    const year = dateInfo.getUTCFullYear();
    const month = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateInfo.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(trimmed)) {
      const parts = trimmed.split(/[-/]/);
      const day = parts[0]?.padStart(2, '0') || '01';
      const month = parts[1]?.padStart(2, '0') || '01';
      const year = parts[2] || '2026';
      return `${year}-${month}-${day}`;
    }
    return trimmed;
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0] || '';
  }
  return String(val);
}

export function parseDaybookExcel(
  fileBuffer: ArrayBuffer | Uint8Array,
  fileName: string = 'DayBook.xlsx',
  gstr1JsonContent?: string | Record<string, any>
): DaybookParsedData {
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0] || 'Sheet1';
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" not found in Excel workbook`);
  }

  // Parse GSTR-1 JSON if provided
  let gstr1Data: any = null;
  let supplierGstin = '19BJKPP3718A1Z8'; // Default West Bengal state 19
  let supplierStateCode = '19';

  if (gstr1JsonContent) {
    try {
      gstr1Data = typeof gstr1JsonContent === 'string' ? JSON.parse(gstr1JsonContent) : gstr1JsonContent;
      if (gstr1Data.gstin) {
        supplierGstin = String(gstr1Data.gstin).trim();
        supplierStateCode = supplierGstin.substring(0, 2) || '19';
      }
    } catch (e) {
      console.warn('Could not parse GSTR-1 JSON:', e);
    }
  }

  const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  const rawRows: DaybookRawRow[] = [];
  const dates: string[] = [];

  rawJson.forEach((row) => {
    const vNo = String(row['Voucher Number'] || row['Voucher No'] || row['Vch No'] || row['Bill No'] || '').trim();
    const itm = String(row['Item Name'] || row['Item'] || row['Description'] || '').trim();
    const party = String(row['Party Name'] || row['Party'] || row['Customer'] || row['Account'] || '').trim();

    if (!vNo && !itm && !party) return;

    const parsedDate = parseExcelDate(row['Date'] || row['Voucher Date'] || row['Bill Date']);
    if (parsedDate) dates.push(parsedDate);

    const actualQty = parseFloat(String(row['Acutal Quantity'] || row['Actual Quantity'] || row['Actual Qty'] || row['Qty'] || 0)) || 0;
    const billedQty = parseFloat(String(row['Billed Quantity'] || row['Billed Qty'] || row['Qty'] || actualQty || 0)) || 0;
    const rate = parseFloat(String(row['Rate'] || row['Selling Rate'] || row['Price'] || 0)) || 0;
    const purchaseRate = parseFloat(String(row['Purchase Rate'] || row['Cost Rate'] || row['Cost'] || 0)) || 0;
    const amount = parseFloat(String(row['Amount'] || row['Taxable Amount'] || row['Total'] || (billedQty * rate))) || 0;
    const marginVal = row['Margin'] !== undefined && row['Margin'] !== ''
      ? parseFloat(String(row['Margin']))
      : amount - (billedQty * purchaseRate);

    const discount = parseFloat(String(row['Discount'] || row['Disc %'] || 0)) || 0;
    const discountAmount = parseFloat(String(row['Discount Amount'] || 0)) || 0;
    const gstRate = parseFloat(String(row['Item rate of GST'] || row['GST Rate'] || row['Tax Rate'] || 0)) || 0;
    const mrp = parseFloat(String(row['MRP/Marginal'] || row['MRP'] || 0)) || 0;
    const gstin = String(row['GSTIN/UIN'] || row['GSTIN'] || '').trim();

    // Determine State and Supply Type
    let pos = supplierStateCode;
    if (gstin && gstin.length >= 2) {
      pos = gstin.substring(0, 2);
    }
    const supplyType: 'INTRA' | 'INTER' = pos === supplierStateCode ? 'INTRA' : 'INTER';

    // Calculate Taxes
    const totalTaxVal = Number(((amount * gstRate) / 100).toFixed(2));
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (supplyType === 'INTRA') {
      cgst = Number((totalTaxVal / 2).toFixed(2));
      sgst = Number((totalTaxVal / 2).toFixed(2));
      igst = 0;
    } else {
      cgst = 0;
      sgst = 0;
      igst = totalTaxVal;
    }

    const grandTotal = Number((amount + totalTaxVal).toFixed(2));

    rawRows.push({
      voucherNumber: vNo || 'VCH-AUTO',
      reference: String(row['Reference'] || '').trim(),
      date: parsedDate,
      voucherType: String(row['Voucher Type'] || 'Sales').trim(),
      partyName: party || 'Cash',
      partyAlias: String(row['Party Alias'] || '').trim(),
      gstin,
      supplyType,
      pos,
      itemName: itm || 'General Item',
      mrp,
      hsn: String(row['Item HSN'] || row['HSN'] || '').trim(),
      gstRate,
      godown: String(row['Godown'] || row['Location'] || 'Main Location').trim(),
      batch: String(row['Item Batch'] || row['Batch'] || 'Primary Batch').trim(),
      actualQty,
      billedQty,
      rate,
      purchaseRate,
      unit: String(row['Unit'] || row['UOM'] || 'Pc').trim(),
      discount,
      discountAmount,
      margin: marginVal,
      amount,
      cgst,
      sgst,
      igst,
      totalTax: totalTaxVal,
      grandTotal,
      ledger: String(row['Purchase/Sales Ledger'] || row['Ledger'] || 'Taxable Sales').trim(),
      narration: String(row['Narration'] || '').trim()
    });
  });

  dates.sort();
  const startDate = dates.length > 0 ? (dates[0] ?? '') : '';
  const endDate = dates.length > 0 ? (dates[dates.length - 1] ?? '') : '';

  // Index GSTR-1 Invoices if available
  const gstr1InvoiceMap = new Map<string, { inum: string; idt: string; val: number; txval: number; tax: number; ctin: string }>();
  if (gstr1Data && Array.isArray(gstr1Data.b2b)) {
    gstr1Data.b2b.forEach((b2bParty: any) => {
      const ctin = String(b2bParty.ctin || '').trim();
      (b2bParty.inv || []).forEach((inv: any) => {
        const inum = String(inv.inum || '').trim();
        let totalTxval = 0;
        let totalTax = 0;
        (inv.itms || []).forEach((itm: any) => {
          const d = itm.itm_det || {};
          totalTxval += Number(d.txval || 0);
          totalTax += Number(d.iamt || 0) + Number(d.camt || 0) + Number(d.samt || 0) + Number(d.csamt || 0);
        });
        gstr1InvoiceMap.set(inum, {
          inum,
          idt: inv.idt || '',
          val: Number(inv.val || 0),
          txval: Number(totalTxval.toFixed(2)),
          tax: Number(totalTax.toFixed(2)),
          ctin
        });
      });
    });
  }

  // 1. Group by Voucher
  const voucherMap = new Map<string, DaybookVoucher>();
  rawRows.forEach((row) => {
    const key = `${row.voucherNumber}_${row.date}_${row.partyName}`;
    let v = voucherMap.get(key);
    if (!v) {
      v = {
        voucherNumber: row.voucherNumber,
        date: row.date,
        voucherType: row.voucherType,
        partyName: row.partyName,
        gstin: row.gstin,
        pos: row.pos,
        supplyType: row.supplyType,
        narration: row.narration,
        itemsCount: 0,
        totalActualQty: 0,
        totalBilledQty: 0,
        totalAmount: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        totalTax: 0,
        grandTotal: 0,
        totalCost: 0,
        totalMargin: 0,
        marginPct: 0,
        items: [],
        gstr1Status: gstr1Data ? 'UNFILED' : 'NOT_CHECKED'
      };
      voucherMap.set(key, v);
    }
    v.itemsCount += 1;
    v.totalActualQty += row.actualQty;
    v.totalBilledQty += row.billedQty;
    v.totalAmount += row.amount;
    v.totalCgst += row.cgst;
    v.totalSgst += row.sgst;
    v.totalIgst += row.igst;
    v.totalTax += row.totalTax;
    v.grandTotal += row.grandTotal;
    v.totalCost += (row.billedQty * row.purchaseRate);
    v.totalMargin += row.margin;
    v.items.push(row);
  });

  const vouchers = Array.from(voucherMap.values()).map((v) => {
    v.totalAmount = Number(v.totalAmount.toFixed(2));
    v.totalCgst = Number(v.totalCgst.toFixed(2));
    v.totalSgst = Number(v.totalSgst.toFixed(2));
    v.totalIgst = Number(v.totalIgst.toFixed(2));
    v.totalTax = Number(v.totalTax.toFixed(2));
    v.unroundedGrandTotal = Number((v.totalAmount + v.totalTax).toFixed(2));
    v.totalCost = Number(v.totalCost.toFixed(2));
    v.totalMargin = Number(v.totalMargin.toFixed(2));
    v.marginPct = v.totalAmount > 0 ? Number(((v.totalMargin / v.totalAmount) * 100).toFixed(2)) : 0;

    let gstrInv: any = null;
    // Cross-verify with GSTR-1
    if (gstr1Data) {
      if (!v.gstin || v.partyName.toLowerCase() === 'cash') {
        v.gstr1Status = 'B2CS_RETAIL';
      } else {
        gstrInv = gstr1InvoiceMap.get(v.voucherNumber);
        if (gstrInv) {
          const diffTx = Math.abs(v.totalAmount - gstrInv.txval);
          const diffTax = Math.abs(v.totalTax - gstrInv.tax);
          if (diffTx < 1 && diffTax < 1) {
            v.gstr1Status = 'MATCHED';
          } else {
            v.gstr1Status = 'MISMATCH';
          }
          v.gstr1MatchDetails = {
            gstr1Taxable: gstrInv.txval,
            gstr1TotalTax: gstrInv.tax,
            gstr1GrandTotal: gstrInv.val,
            taxVariance: Number((v.totalTax - gstrInv.tax).toFixed(2))
          };
        } else {
          v.gstr1Status = 'UNFILED';
        }
      }
    }

    // Precise Statutory GST Round-off calculation
    if (gstrInv && gstrInv.val) {
      v.grandTotal = gstrInv.val;
      v.roundOff = Number((gstrInv.val - v.unroundedGrandTotal).toFixed(2));
    } else {
      v.grandTotal = Math.round(v.unroundedGrandTotal);
      v.roundOff = Number((v.grandTotal - v.unroundedGrandTotal).toFixed(2));
    }

    return v;
  });

  // 2. Group by Stock / Item
  const stockMap = new Map<string, DaybookStockSummary>();
  rawRows.forEach((row) => {
    const key = `${row.itemName}_${row.unit}_${row.hsn}`;
    let s = stockMap.get(key);
    if (!s) {
      s = {
        itemName: row.itemName,
        hsn: row.hsn,
        unit: row.unit,
        godown: row.godown,
        batch: row.batch,
        gstRate: row.gstRate,
        totalActualQty: 0,
        totalBilledQty: 0,
        avgSellingRate: 0,
        avgPurchaseRate: 0,
        totalRevenue: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        totalTax: 0,
        totalWithTax: 0,
        totalCost: 0,
        totalMargin: 0,
        marginPct: 0,
        transactionCount: 0,
        parties: new Set<string>()
      };
      stockMap.set(key, s);
    }
    s.totalActualQty += row.actualQty;
    s.totalBilledQty += row.billedQty;
    s.totalRevenue += row.amount;
    s.totalCgst += row.cgst;
    s.totalSgst += row.sgst;
    s.totalIgst += row.igst;
    s.totalTax += row.totalTax;
    s.totalWithTax += row.grandTotal;
    s.totalCost += row.billedQty * row.purchaseRate;
    s.totalMargin += row.margin;
    s.transactionCount += 1;
    s.parties.add(row.partyName);
  });

  const stockConsumption = Array.from(stockMap.values()).map((s) => {
    s.avgSellingRate = s.totalBilledQty > 0 ? Number((s.totalRevenue / s.totalBilledQty).toFixed(2)) : 0;
    s.avgPurchaseRate = s.totalBilledQty > 0 ? Number((s.totalCost / s.totalBilledQty).toFixed(2)) : 0;
    s.totalRevenue = Number(s.totalRevenue.toFixed(2));
    s.totalTax = Number(s.totalTax.toFixed(2));
    s.totalWithTax = Number(s.totalWithTax.toFixed(2));
    s.totalCost = Number(s.totalCost.toFixed(2));
    s.totalMargin = Number(s.totalMargin.toFixed(2));
    s.marginPct = s.totalRevenue > 0 ? Number(((s.totalMargin / s.totalRevenue) * 100).toFixed(2)) : 0;
    return s;
  });

  stockConsumption.sort((a, b) => b.totalRevenue - a.totalRevenue);

  // 3. Group by Party
  const partyMap = new Map<string, DaybookPartySummary>();
  rawRows.forEach((row) => {
    const key = `${row.partyName}_${row.gstin}`;
    let p = partyMap.get(key);
    if (!p) {
      p = {
        partyName: row.partyName,
        gstin: row.gstin,
        pos: row.pos,
        supplyType: row.supplyType,
        voucherCount: 0,
        itemsCount: 0,
        totalQty: 0,
        totalAmount: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        totalTax: 0,
        grandTotal: 0,
        totalCost: 0,
        totalMargin: 0,
        marginPct: 0,
        itemsList: []
      };
      partyMap.set(key, p);
    }
    p.itemsCount += 1;
    p.totalQty += row.billedQty;
    p.totalAmount += row.amount;
    p.totalCgst += row.cgst;
    p.totalSgst += row.sgst;
    p.totalIgst += row.igst;
    p.totalTax += row.totalTax;
    p.grandTotal += row.grandTotal;
    p.totalCost += (row.billedQty * row.purchaseRate);
    p.totalMargin += row.margin;
    p.itemsList.push({
      itemName: row.itemName,
      qty: row.billedQty,
      unit: row.unit,
      amount: row.amount,
      tax: row.totalTax,
      grandTotal: row.grandTotal,
      margin: row.margin
    });
  });

  const partyVoucherSets = new Map<string, Set<string>>();
  rawRows.forEach((row) => {
    const key = `${row.partyName}_${row.gstin}`;
    if (!partyVoucherSets.has(key)) {
      partyVoucherSets.set(key, new Set());
    }
    const set = partyVoucherSets.get(key);
    if (set) set.add(row.voucherNumber);
  });

  const partySummary = Array.from(partyMap.entries()).map(([key, p]) => {
    p.voucherCount = partyVoucherSets.get(key)?.size || 1;
    p.totalAmount = Number(p.totalAmount.toFixed(2));
    p.totalTax = Number(p.totalTax.toFixed(2));
    p.grandTotal = Number(p.grandTotal.toFixed(2));
    p.totalCost = Number(p.totalCost.toFixed(2));
    p.totalMargin = Number(p.totalMargin.toFixed(2));
    p.marginPct = p.totalAmount > 0 ? Number(((p.totalMargin / p.totalAmount) * 100).toFixed(2)) : 0;
    return p;
  });
  partySummary.sort((a, b) => b.totalAmount - a.totalAmount);

  // 4. Group by HSN & GST Rate
  const hsnMap = new Map<string, DaybookHsnSummary>();
  rawRows.forEach((row) => {
    const key = `${row.hsn || 'OTHERS'}_${row.gstRate}`;
    let h = hsnMap.get(key);
    if (!h) {
      h = {
        hsn: row.hsn || 'OTHERS',
        gstRate: row.gstRate,
        totalQty: 0,
        totalTaxable: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        totalTax: 0,
        totalWithTax: 0,
        totalCost: 0,
        totalMargin: 0,
        marginPct: 0,
        itemsCount: 0
      };
      hsnMap.set(key, h);
    }
    h.itemsCount += 1;
    h.totalQty += row.billedQty;
    h.totalTaxable += row.amount;
    h.totalCgst += row.cgst;
    h.totalSgst += row.sgst;
    h.totalIgst += row.igst;
    h.totalTax += row.totalTax;
    h.totalWithTax += row.grandTotal;
    h.totalCost += (row.billedQty * row.purchaseRate);
    h.totalMargin += row.margin;
  });

  const hsnSummary = Array.from(hsnMap.values()).map((h) => {
    h.totalTaxable = Number(h.totalTaxable.toFixed(2));
    h.totalCgst = Number(h.totalCgst.toFixed(2));
    h.totalSgst = Number(h.totalSgst.toFixed(2));
    h.totalIgst = Number(h.totalIgst.toFixed(2));
    h.totalTax = Number(h.totalTax.toFixed(2));
    h.totalWithTax = Number(h.totalWithTax.toFixed(2));
    h.totalCost = Number(h.totalCost.toFixed(2));
    h.totalMargin = Number(h.totalMargin.toFixed(2));
    h.marginPct = h.totalTaxable > 0 ? Number(((h.totalMargin / h.totalTaxable) * 100).toFixed(2)) : 0;
    return h;
  });
  hsnSummary.sort((a, b) => b.totalTaxable - a.totalTaxable);

  // 5. Margin Watchlist
  const stars = stockConsumption.filter((s) => s.marginPct >= 30);
  const stable = stockConsumption.filter((s) => s.marginPct >= 10 && s.marginPct < 30);
  const low = stockConsumption.filter((s) => s.marginPct >= 0 && s.marginPct < 10);
  const negative = stockConsumption.filter((s) => s.marginPct < 0);

  // 6. Overall Totals
  const totalRevenue = Number(rawRows.reduce((acc, r) => acc + r.amount, 0).toFixed(2));
  const totalCgst = Number(rawRows.reduce((acc, r) => acc + r.cgst, 0).toFixed(2));
  const totalSgst = Number(rawRows.reduce((acc, r) => acc + r.sgst, 0).toFixed(2));
  const totalIgst = Number(rawRows.reduce((acc, r) => acc + r.igst, 0).toFixed(2));
  const totalGstTax = Number((totalCgst + totalSgst + totalIgst).toFixed(2));
  const totalBillValue = Number((totalRevenue + totalGstTax).toFixed(2));
  const totalCost = Number(rawRows.reduce((acc, r) => acc + (r.billedQty * r.purchaseRate), 0).toFixed(2));
  const totalGrossMargin = Number(rawRows.reduce((acc, r) => acc + r.margin, 0).toFixed(2));
  const overallMarginPct = totalRevenue > 0 ? Number(((totalGrossMargin / totalRevenue) * 100).toFixed(2)) : 0;
  const totalActualQty = rawRows.reduce((acc, r) => acc + r.actualQty, 0);
  const totalBilledQty = rawRows.reduce((acc, r) => acc + r.billedQty, 0);

  // 7. GSTR-1 Reconciliation Summary
  let reconciliation: Gstr1Reconciliation = {
    hasGstr1: !!gstr1Data,
    supplierGstin,
    returnPeriod: gstr1Data?.fp || '',
    b2bInvoicesCount: gstr1InvoiceMap.size,
    b2bMatchedCount: vouchers.filter((v) => v.gstr1Status === 'MATCHED').length,
    b2bMismatchCount: vouchers.filter((v) => v.gstr1Status === 'MISMATCH').length,
    unfiledInvoicesCount: vouchers.filter((v) => v.gstr1Status === 'UNFILED').length,
    b2csRetailTaxable: 0,
    b2csRetailTax: 0,
    totalGstr1Taxable: 0,
    totalGstr1Tax: 0,
    totalGstr1GrandTotal: 0,
    taxVariance: 0,
    discrepancies: []
  };

  if (gstr1Data) {
    let b2csTx = 0;
    let b2csTax = 0;
    (gstr1Data.b2cs || []).forEach((b: any) => {
      b2csTx += Number(b.txval || 0);
      b2csTax += Number(b.camt || 0) + Number(b.samt || 0) + Number(b.iamt || 0);
    });
    reconciliation.b2csRetailTaxable = Number(b2csTx.toFixed(2));
    reconciliation.b2csRetailTax = Number(b2csTax.toFixed(2));

    let b2bTx = 0;
    let b2bTax = 0;
    let b2bVal = 0;
    gstr1InvoiceMap.forEach((inv) => {
      b2bTx += inv.txval;
      b2bTax += inv.tax;
      b2bVal += inv.val;
    });

    reconciliation.totalGstr1Taxable = Number((b2bTx + b2csTx).toFixed(2));
    reconciliation.totalGstr1Tax = Number((b2bTax + b2csTax).toFixed(2));
    reconciliation.totalGstr1GrandTotal = Number((b2bVal + b2csTx + b2csTax).toFixed(2));
    reconciliation.taxVariance = Number((totalGstTax - reconciliation.totalGstr1Tax).toFixed(2));

    // Compile list of discrepancies
    vouchers.forEach((v) => {
      if (v.gstr1Status === 'MISMATCH' && v.gstr1MatchDetails) {
        reconciliation.discrepancies.push({
          voucherNumber: v.voucherNumber,
          partyName: v.partyName,
          issue: 'Tax Amount Variance between Books and Portal Return',
          bookTaxable: v.totalAmount,
          gstr1Taxable: v.gstr1MatchDetails.gstr1Taxable,
          bookTax: v.totalTax,
          gstr1Tax: v.gstr1MatchDetails.gstr1TotalTax
        });
      } else if (v.gstr1Status === 'UNFILED') {
        reconciliation.discrepancies.push({
          voucherNumber: v.voucherNumber,
          partyName: v.partyName,
          issue: 'Registered B2B invoice in DayBook missing from GSTR-1 JSON',
          bookTaxable: v.totalAmount,
          gstr1Taxable: 0,
          bookTax: v.totalTax,
          gstr1Tax: 0
        });
      }
    });
  }

  return {
    fileName,
    sheetName,
    totalRawRows: rawRows.length,
    supplierGstin,
    dateRange: {
      startDate,
      endDate
    },
    summary: {
      totalRevenue,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGstTax,
      totalBillValue,
      totalCost,
      totalGrossMargin,
      overallMarginPct,
      totalActualQty,
      totalBilledQty,
      totalVouchers: vouchers.length,
      uniqueParties: partySummary.length,
      uniqueItems: stockConsumption.length,
      uniqueHsns: hsnSummary.length,
      positiveMarginCount: stockConsumption.filter((s) => s.marginPct > 0).length,
      negativeMarginCount: negative.length,
      intraStateCount: vouchers.filter((v) => v.supplyType === 'INTRA').length,
      interStateCount: vouchers.filter((v) => v.supplyType === 'INTER').length
    },
    vouchers,
    stockConsumption,
    partySummary,
    hsnSummary,
    marginWatchlist: {
      stars,
      stable,
      low,
      negative
    },
    reconciliation,
    rawRows
  };
}

export function exportDaybookAnalysisToExcel(data: DaybookParsedData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Vouchers Register (Complete Bill & Tax info)
  const voucherRows = data.vouchers.map((v, idx) => ({
    '#': idx + 1,
    'Voucher No': v.voucherNumber,
    'Date': v.date,
    'Type': v.voucherType,
    'Party Name': v.partyName,
    'GSTIN': v.gstin,
    'Supply Type': v.supplyType,
    'Taxable Turnover (₹)': v.totalAmount,
    'CGST (₹)': v.totalCgst,
    'SGST (₹)': v.totalSgst,
    'IGST (₹)': v.totalIgst,
    'Total Tax (₹)': v.totalTax,
    'Bill Grand Total (₹)': v.grandTotal,
    'Total Cost (₹)': v.totalCost,
    'Gross Margin (₹)': v.totalMargin,
    'Margin %': v.marginPct,
    'GSTR-1 Status': v.gstr1Status
  }));
  const wsVouchers = XLSX.utils.json_to_sheet(voucherRows);
  XLSX.utils.book_append_sheet(wb, wsVouchers, 'Vouchers Complete Bill');

  // Sheet 2: Stock Consumption
  const stockRows = data.stockConsumption.map((s, idx) => ({
    '#': idx + 1,
    'Item Name': s.itemName,
    'HSN': s.hsn,
    'Unit': s.unit,
    'GST Rate (%)': s.gstRate,
    'Actual Qty': s.totalActualQty,
    'Billed Qty': s.totalBilledQty,
    'Avg Selling Rate (₹)': s.avgSellingRate,
    'Avg Cost (₹)': s.avgPurchaseRate,
    'Taxable Revenue (₹)': s.totalRevenue,
    'Total Tax (₹)': s.totalTax,
    'Total with Tax (₹)': s.totalWithTax,
    'Total Cost (₹)': s.totalCost,
    'Gross Margin (₹)': s.totalMargin,
    'Margin %': s.marginPct,
    'Unique Buyers': s.parties.size
  }));
  const wsStock = XLSX.utils.json_to_sheet(stockRows);
  XLSX.utils.book_append_sheet(wb, wsStock, 'Stock Consumption');

  // Sheet 3: Party Summary
  const partyRows = data.partySummary.map((p, idx) => ({
    '#': idx + 1,
    'Party Name': p.partyName,
    'GSTIN': p.gstin,
    'Supply Type': p.supplyType,
    'Invoices': p.voucherCount,
    'Total Units': p.totalQty,
    'Taxable Turnover (₹)': p.totalAmount,
    'Total Tax (₹)': p.totalTax,
    'Total Bill Value (₹)': p.grandTotal,
    'Total Cost (₹)': p.totalCost,
    'Gross Margin (₹)': p.totalMargin,
    'Margin %': p.marginPct
  }));
  const wsParty = XLSX.utils.json_to_sheet(partyRows);
  XLSX.utils.book_append_sheet(wb, wsParty, 'Party Summary');

  // Sheet 4: HSN Summary
  const hsnRows = data.hsnSummary.map((h, idx) => ({
    '#': idx + 1,
    'HSN Code': h.hsn,
    'GST Rate (%)': h.gstRate,
    'Total Qty': h.totalQty,
    'Taxable Value (₹)': h.totalTaxable,
    'CGST (₹)': h.totalCgst,
    'SGST (₹)': h.totalSgst,
    'IGST (₹)': h.totalIgst,
    'Total Tax (₹)': h.totalTax,
    'Total with Tax (₹)': h.totalWithTax,
    'Total Cost (₹)': h.totalCost,
    'Gross Margin (₹)': h.totalMargin,
    'Margin %': h.marginPct
  }));
  const wsHsn = XLSX.utils.json_to_sheet(hsnRows);
  XLSX.utils.book_append_sheet(wb, wsHsn, 'HSN & Tax Summary');

  const outName = `${data.fileName.replace(/\.[^/.]+$/, '')}_Complete_Bill_Analysis.xlsx`;
  XLSX.writeFile(wb, outName);
}
