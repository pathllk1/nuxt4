export interface Gstr2aItem {
  rate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface Gstr2aParsedInvoice {
  gstin: string;
  invoiceNo: string;
  invoiceType: string;
  docType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  invoiceDate: string; // YYYY-MM-DD
  rawDate: string;
  invoiceValue: number;
  placeOfSupply: string;
  supplierStateCode: string;
  reverseCharge: boolean;
  grossTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  roundOff: number;
  netTotal: number;
  gstr1FilingStatus: string;
  gstr3bFilingStatus: string;
  source?: string;
  irn?: string;
  irnDate?: string;
  items: Gstr2aItem[];
  itemCount: number;
}

export interface Gstr2aParseResult {
  invoices: Gstr2aParsedInvoice[];
  totalInvoices: number;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalValue: number;
  uniqueGstins: string[];
  skippedSummaryRows: number;
  errors: string[];
}

/**
 * Robust CSV Line Tokenizer handling quotes and commas
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      // Check for escaped quote ("")
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Converts Indian Date "DD-MM-YYYY" or " DD-MM-YYYY" to ISO "YYYY-MM-DD"
 */
export function normalizeGstrDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.replace(/["\s]/g, '').trim();
  const parts = cleaned.split(/[-/]/);
  if (parts.length === 3) {
    const day = parts[0] || '';
    const month = parts[1] || '';
    const year = parts[2] || '';
    if (day.length === 4) {
      // Format is YYYY-MM-DD
      return `${day}-${month.padStart(2, '0')}-${year.padStart(2, '0')}`;
    }
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return cleaned;
}

/**
 * Parse GSTR-2A Inward Supplies CSV file
 */
export function parseGstr2aCsv(csvText: string): Gstr2aParseResult {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim().length > 0);

  const errors: string[] = [];
  let headerIndex = -1;
  let headers: string[] = [];

  // Find header row (skips metadata/title rows)
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (line && (line.includes('GSTIN of supplier') || (line.includes('GSTIN') && line.includes('Invoice number')))) {
      headerIndex = i;
      headers = parseCsvLine(line).map(h => h.replace(/["\r]/g, '').trim());
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      invoices: [],
      totalInvoices: 0,
      totalTaxable: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalValue: 0,
      uniqueGstins: [],
      skippedSummaryRows: 0,
      errors: ['Invalid GSTR-2A CSV format: Could not find header row containing "GSTIN of supplier" and "Invoice number".']
    };
  }

  // Map header column indices
  const getCol = (name: string, fallbackIdx: number = -1): number => {
    const lower = name.toLowerCase();
    const idx = headers.findIndex(h => h.toLowerCase().includes(lower));
    return idx !== -1 ? idx : fallbackIdx;
  };

  const colGstin = getCol('gstin of supplier', 0);
  const colInvNo = getCol('invoice number', 1);
  const colInvType = getCol('invoice type', 2);
  const colInvDate = getCol('invoice date', 3);
  const colInvVal = getCol('invoice value', 4);
  const colPos = getCol('place of supply', 5);
  const colRcm = getCol('reverse charge', 6);
  const colRate = getCol('rate', 7);
  const colTaxable = getCol('taxable value', 8);
  const colIgst = getCol('integrated tax', 9);
  const colCgst = getCol('central tax', 10);
  const colSgst = getCol('state/ut tax', 11);
  const colCess = getCol('cess', 12);
  const colGstr1 = getCol('gstr-1', 13);
  const colGstr3b = getCol('gstr-3b', 14);
  const colSource = getCol('source', 18);
  const colIrn = getCol('irn', 19);
  const colIrnDate = getCol('irn date', 20);

  const groupedMap = new Map<string, Gstr2aParsedInvoice>();
  let skippedSummaryRows = 0;

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i]?.trim();
    if (!rawLine) continue;

    const row = parseCsvLine(rawLine);
    if (row.length < 5) continue;

    const gstin = (row[colGstin] || '').replace(/["\s]/g, '').toUpperCase();
    const invoiceNo = (row[colInvNo] || '').replace(/["\s]/g, '').trim();
    if (!gstin || !invoiceNo || gstin.length < 15) continue;

    const rawRate = (row[colRate] || '').replace(/["\s]/g, '').trim();

    // In GSTR-2A CSV, summary rows have rate as "-" or ""- or are blank
    if (rawRate === '-' || rawRate === '""-' || rawRate === '' || isNaN(Number(rawRate))) {
      skippedSummaryRows++;
      continue;
    }

    const rate = parseFloat(rawRate) || 0;
    const taxableValue = parseFloat((row[colTaxable] || '0').replace(/["\s,]/g, '')) || 0;
    const igst = parseFloat((row[colIgst] || '0').replace(/["\s,]/g, '')) || 0;
    const cgst = parseFloat((row[colCgst] || '0').replace(/["\s,]/g, '')) || 0;
    const sgst = parseFloat((row[colSgst] || '0').replace(/["\s,]/g, '')) || 0;
    const cess = parseFloat((row[colCess] || '0').replace(/["\s,]/g, '')) || 0;
    const invoiceValue = parseFloat((row[colInvVal] || '0').replace(/["\s,]/g, '')) || 0;

    const rawDate = (row[colInvDate] || '').replace(/["\s]/g, '').trim();
    const invoiceDate = normalizeGstrDate(rawDate);
    const invoiceType = (row[colInvType] || 'R').replace(/["\s]/g, '').toUpperCase();
    const placeOfSupply = (row[colPos] || '').replace(/["\r]/g, '').trim();
    const reverseCharge = (row[colRcm] || 'N').replace(/["\s]/g, '').toUpperCase() === 'Y';
    const gstr1FilingStatus = (row[colGstr1] || '').replace(/["\s]/g, '').toUpperCase();
    const gstr3bFilingStatus = (row[colGstr3b] || '').replace(/["\s]/g, '').toUpperCase();
    const source = (row[colSource] || '').replace(/["\r]/g, '').trim();
    const irn = (row[colIrn] || '').replace(/["\s-]/g, '').trim();
    const irnDate = (row[colIrnDate] || '').replace(/["\s-]/g, '').trim();

    const supplierStateCode = gstin.substring(0, 2);

    // Grouping key: GSTIN + Normalized Invoice Number + Date
    const groupKey = `${gstin}_${invoiceNo.toUpperCase()}_${invoiceDate}`;

    const item: Gstr2aItem = {
      rate,
      taxableValue: Number(taxableValue.toFixed(2)),
      cgst: Number(cgst.toFixed(2)),
      sgst: Number(sgst.toFixed(2)),
      igst: Number(igst.toFixed(2)),
      cess: Number(cess.toFixed(2))
    };

    if (groupedMap.has(groupKey)) {
      const existing = groupedMap.get(groupKey)!;
      existing.items.push(item);
      existing.grossTotal = Number((existing.grossTotal + taxableValue).toFixed(2));
      existing.cgst = Number((existing.cgst + cgst).toFixed(2));
      existing.sgst = Number((existing.sgst + sgst).toFixed(2));
      existing.igst = Number((existing.igst + igst).toFixed(2));
      existing.cess = Number((existing.cess + cess).toFixed(2));
      existing.itemCount = existing.items.length;
      existing.roundOff = Number((existing.netTotal - (existing.grossTotal + existing.cgst + existing.sgst + existing.igst + existing.cess)).toFixed(2));
    } else {
      const grossTotal = Number(taxableValue.toFixed(2));
      const calcCgst = Number(cgst.toFixed(2));
      const calcSgst = Number(sgst.toFixed(2));
      const calcIgst = Number(igst.toFixed(2));
      const calcCess = Number(cess.toFixed(2));
      const netTotal = invoiceValue > 0 ? Number(invoiceValue.toFixed(2)) : Number((grossTotal + calcCgst + calcSgst + calcIgst + calcCess).toFixed(2));
      const roundOff = Number((netTotal - (grossTotal + calcCgst + calcSgst + calcIgst + calcCess)).toFixed(2));

      let docType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' = 'INVOICE';
      const normType = invoiceType.toUpperCase();
      if (normType === 'C' || normType === 'CR' || normType === 'CDNR' || normType.includes('CREDIT')) {
        docType = 'CREDIT_NOTE';
      } else if (normType === 'D' || normType === 'DR' || normType === 'DBNR' || normType.includes('DEBIT')) {
        docType = 'DEBIT_NOTE';
      }

      groupedMap.set(groupKey, {
        gstin,
        invoiceNo,
        invoiceType,
        docType,
        invoiceDate,
        rawDate,
        invoiceValue: netTotal,
        placeOfSupply,
        supplierStateCode,
        reverseCharge,
        grossTotal,
        cgst: calcCgst,
        sgst: calcSgst,
        igst: calcIgst,
        cess: calcCess,
        roundOff,
        netTotal,
        gstr1FilingStatus,
        gstr3bFilingStatus,
        source: source && source !== '-' ? source : undefined,
        irn: irn && irn.length > 10 ? irn : undefined,
        irnDate: irnDate && irnDate.length >= 8 ? normalizeGstrDate(irnDate) : undefined,
        items: [item],
        itemCount: 1
      });
    }
  }

  const invoices = Array.from(groupedMap.values());
  const uniqueGstins = Array.from(new Set(invoices.map(i => i.gstin)));

  const totals = invoices.reduce(
    (acc, inv) => {
      acc.taxable += inv.grossTotal;
      acc.cgst += inv.cgst;
      acc.sgst += inv.sgst;
      acc.igst += inv.igst;
      acc.value += inv.netTotal;
      return acc;
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, value: 0 }
  );

  return {
    invoices,
    totalInvoices: invoices.length,
    totalTaxable: Number(totals.taxable.toFixed(2)),
    totalCgst: Number(totals.cgst.toFixed(2)),
    totalSgst: Number(totals.sgst.toFixed(2)),
    totalIgst: Number(totals.igst.toFixed(2)),
    totalValue: Number(totals.value.toFixed(2)),
    uniqueGstins,
    skippedSummaryRows,
    errors
  };
}
