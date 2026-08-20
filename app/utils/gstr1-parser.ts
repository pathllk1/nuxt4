/**
 * GSTR-1 Client-Side JSON Parser & Analytics Engine
 * Extracts and normalizes B2B, B2CS, B2CL, HSN (B2B & B2C), CDNR, and Document issue data.
 */

export interface Gstr1ItemDet {
  txval: number;
  rt: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt?: number;
}

export interface Gstr1InvoiceItem {
  num: number;
  itm_det: Gstr1ItemDet;
}

export interface Gstr1Invoice {
  inum: string;
  idt: string;
  val: number;
  pos: string;
  rchrg: string;
  inv_typ: string;
  itms: Gstr1InvoiceItem[];
  ctin: string; // Recipient GSTIN
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  totalTax: number;
}

export interface Gstr1HsnItem {
  num?: number;
  hsn_sc: string;
  desc?: string;
  user_desc?: string;
  uqc: string;
  qty: number;
  rt: number;
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt?: number;
  totalTax: number;
  totalValue: number;
  sourceType: 'B2B' | 'B2C';
}

export interface Gstr1B2csItem {
  typ: string;
  sply_ty: string;
  rt: number;
  pos: string;
  txval: number;
  camt: number;
  samt: number;
  iamt?: number;
  csamt?: number;
  totalTax: number;
  totalValue: number;
}

export interface Gstr1DocItem {
  num: number;
  from: string;
  to: string;
  totnum: number;
  cancel: number;
  net_issue: number;
  doc_name?: string;
}

export interface Gstr1ParsedData {
  gstin: string;
  fp: string;
  periodFormatted: string;
  grossTurnover?: number;
  currentGrossTurnover?: number;
  b2bInvoices: Gstr1Invoice[];
  b2csItems: Gstr1B2csItem[];
  b2clInvoices: any[];
  cdnrItems: any[];
  cdnurItems: any[];
  hsnItems: Gstr1HsnItem[];
  hsnSummaryByCode: Array<{
    hsn_sc: string;
    description: string;
    uqc: string;
    totalQty: number;
    rates: number[];
    totalTaxable: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalCess: number;
    totalTax: number;
    totalValue: number;
    b2bQty: number;
    b2cQty: number;
    b2bTaxable: number;
    b2cTaxable: number;
    percentageOfTotal: number;
  }>;
  uqcDistribution: Record<string, { qty: number; taxable: number; count: number }>;
  rateDistribution: Record<number, { taxable: number; cgst: number; sgst: number; igst: number; totalTax: number; count: number }>;
  docIssue: Gstr1DocItem[];
  summary: {
    totalB2bInvoices: number;
    totalB2bValue: number;
    totalB2bTaxable: number;
    totalB2bTax: number;
    uniqueB2bBuyers: number;
    totalB2csValue: number;
    totalB2csTaxable: number;
    totalB2csTax: number;
    grandTotalTaxable: number;
    grandTotalCgst: number;
    grandTotalSgst: number;
    grandTotalIgst: number;
    grandTotalCess: number;
    grandTotalTax: number;
    grandTotalValue: number;
    totalStockUnitsDispatched: number;
    totalHsnLines: number;
    uniqueHsnCount: number;
    totalDocsIssued: number;
    totalDocsCancelled: number;
    netDocsIssued: number;
  };
}

export function formatGstrPeriod(fp: string = ''): string {
  if (!fp || fp.length < 6) return fp;
  const mm = fp.substring(0, 2);
  const yyyy = fp.substring(2);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthIdx = parseInt(mm, 10) - 1;
  const monthName = (monthIdx >= 0 && monthIdx < months.length) ? (months[monthIdx] ?? mm) : mm;
  return `${monthName} ${yyyy}`;
}

export function parseGstr1Json(jsonContent: string | Record<string, any>): Gstr1ParsedData {
  const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;

  const gstin = String(data.gstin || '').toUpperCase();
  const fp = String(data.fp || '');
  const periodFormatted = formatGstrPeriod(fp);

  // 1. Extract and Flatten B2B Invoices
  const b2bInvoices: Gstr1Invoice[] = [];
  const b2bBuyersSet = new Set<string>();

  if (Array.isArray(data.b2b)) {
    data.b2b.forEach((b2bGroup: any) => {
      const ctin = String(b2bGroup.ctin || '').toUpperCase();
      if (ctin) b2bBuyersSet.add(ctin);

      if (Array.isArray(b2bGroup.inv)) {
        b2bGroup.inv.forEach((inv: any) => {
          let totalTaxable = 0;
          let totalCgst = 0;
          let totalSgst = 0;
          let totalIgst = 0;
          let totalCess = 0;

          const itms: Gstr1InvoiceItem[] = (inv.itms || []).map((itm: any) => {
            const det = itm.itm_det || {};
            const txval = Number(det.txval || 0);
            const rt = Number(det.rt || 0);
            const camt = Number(det.camt || 0);
            const samt = Number(det.samt || 0);
            const iamt = Number(det.iamt || 0);
            const csamt = Number(det.csamt || 0);

            totalTaxable += txval;
            totalCgst += camt;
            totalSgst += samt;
            totalIgst += iamt;
            totalCess += csamt;

            return {
              num: Number(itm.num || 1),
              itm_det: {
                txval,
                rt,
                camt,
                samt,
                iamt,
                csamt
              }
            };
          });

          const totalTax = totalCgst + totalSgst + totalIgst + totalCess;

          b2bInvoices.push({
            inum: String(inv.inum || ''),
            idt: String(inv.idt || ''),
            val: Number(inv.val || (totalTaxable + totalTax)),
            pos: String(inv.pos || ''),
            rchrg: String(inv.rchrg || 'N'),
            inv_typ: String(inv.inv_typ || 'R'),
            itms,
            ctin,
            totalTaxable: Number(totalTaxable.toFixed(2)),
            totalCgst: Number(totalCgst.toFixed(2)),
            totalSgst: Number(totalSgst.toFixed(2)),
            totalIgst: Number(totalIgst.toFixed(2)),
            totalCess: Number(totalCess.toFixed(2)),
            totalTax: Number(totalTax.toFixed(2))
          });
        });
      }
    });
  }

  // 2. Extract B2CS (Small Consumer Supplies)
  const b2csItems: Gstr1B2csItem[] = [];
  if (Array.isArray(data.b2cs)) {
    data.b2cs.forEach((item: any) => {
      const txval = Number(item.txval || 0);
      const camt = Number(item.camt || 0);
      const samt = Number(item.samt || 0);
      const iamt = Number(item.iamt || 0);
      const csamt = Number(item.csamt || 0);
      const totalTax = camt + samt + iamt + csamt;

      b2csItems.push({
        typ: String(item.typ || 'OE'),
        sply_ty: String(item.sply_ty || 'INTRA'),
        rt: Number(item.rt || 0),
        pos: String(item.pos || ''),
        txval: Number(txval.toFixed(2)),
        camt: Number(camt.toFixed(2)),
        samt: Number(samt.toFixed(2)),
        iamt: Number(iamt.toFixed(2)),
        csamt: Number(csamt.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        totalValue: Number((txval + totalTax).toFixed(2))
      });
    });
  }

  // 3. Extract and Merge HSN Summary (B2B + B2C)
  const hsnItems: Gstr1HsnItem[] = [];

  if (data.hsn) {
    if (Array.isArray(data.hsn.hsn_b2b)) {
      data.hsn.hsn_b2b.forEach((itm: any) => {
        const txval = Number(itm.txval || 0);
        const camt = Number(itm.camt || 0);
        const samt = Number(itm.samt || 0);
        const iamt = Number(itm.iamt || 0);
        const csamt = Number(itm.csamt || 0);
        const totalTax = camt + samt + iamt + csamt;

        hsnItems.push({
          num: itm.num,
          hsn_sc: String(itm.hsn_sc || ''),
          desc: itm.desc || '',
          user_desc: itm.user_desc || '',
          uqc: String(itm.uqc || 'OTH').toUpperCase(),
          qty: Number(itm.qty || 0),
          rt: Number(itm.rt || 0),
          txval: Number(txval.toFixed(2)),
          camt: Number(camt.toFixed(2)),
          samt: Number(samt.toFixed(2)),
          iamt: Number(iamt.toFixed(2)),
          csamt: Number(csamt.toFixed(2)),
          totalTax: Number(totalTax.toFixed(2)),
          totalValue: Number((txval + totalTax).toFixed(2)),
          sourceType: 'B2B'
        });
      });
    }

    if (Array.isArray(data.hsn.hsn_b2c)) {
      data.hsn.hsn_b2c.forEach((itm: any) => {
        const txval = Number(itm.txval || 0);
        const camt = Number(itm.camt || 0);
        const samt = Number(itm.samt || 0);
        const iamt = Number(itm.iamt || 0);
        const csamt = Number(itm.csamt || 0);
        const totalTax = camt + samt + iamt + csamt;

        hsnItems.push({
          num: itm.num,
          hsn_sc: String(itm.hsn_sc || ''),
          desc: itm.desc || '',
          user_desc: itm.user_desc || '',
          uqc: String(itm.uqc || 'OTH').toUpperCase(),
          qty: Number(itm.qty || 0),
          rt: Number(itm.rt || 0),
          txval: Number(txval.toFixed(2)),
          camt: Number(camt.toFixed(2)),
          samt: Number(samt.toFixed(2)),
          iamt: Number(iamt.toFixed(2)),
          csamt: Number(csamt.toFixed(2)),
          totalTax: Number(totalTax.toFixed(2)),
          totalValue: Number((txval + totalTax).toFixed(2)),
          sourceType: 'B2C'
        });
      });
    }
  }

  // 4. Aggregate HSN Summary by Code
  let totalHsnTaxableGlobal = 0;
  const hsnMap = new Map<string, any>();
  const uqcDistribution: Record<string, { qty: number; taxable: number; count: number }> = {};
  const rateDistribution: Record<number, { taxable: number; cgst: number; sgst: number; igst: number; totalTax: number; count: number }> = {};

  hsnItems.forEach((itm) => {
    totalHsnTaxableGlobal += itm.txval;

    // By HSN Code + UQC
    const key = `${itm.hsn_sc}_${itm.uqc}`;
    let row = hsnMap.get(key);
    if (!row) {
      row = {
        hsn_sc: itm.hsn_sc,
        description: itm.user_desc || itm.desc || `HSN ${itm.hsn_sc}`,
        uqc: itm.uqc,
        totalQty: 0,
        ratesSet: new Set<number>(),
        totalTaxable: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        totalCess: 0,
        totalTax: 0,
        totalValue: 0,
        b2bQty: 0,
        b2cQty: 0,
        b2bTaxable: 0,
        b2cTaxable: 0
      };
      hsnMap.set(key, row);
    }

    row.totalQty += itm.qty;
    row.ratesSet.add(itm.rt);
    row.totalTaxable += itm.txval;
    row.totalCgst += itm.camt;
    row.totalSgst += itm.samt;
    row.totalIgst += itm.iamt;
    row.totalCess += itm.csamt || 0;
    row.totalTax += itm.totalTax;
    row.totalValue += itm.totalValue;

    if (itm.sourceType === 'B2B') {
      row.b2bQty += itm.qty;
      row.b2bTaxable += itm.txval;
    } else {
      row.b2cQty += itm.qty;
      row.b2cTaxable += itm.txval;
    }

    // UQC breakdown
    const currentUqc = uqcDistribution[itm.uqc] || { qty: 0, taxable: 0, count: 0 };
    currentUqc.qty += itm.qty;
    currentUqc.taxable += itm.txval;
    currentUqc.count += 1;
    uqcDistribution[itm.uqc] = currentUqc;

    // Rate breakdown
    const currentRate = rateDistribution[itm.rt] || { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, count: 0 };
    currentRate.taxable += itm.txval;
    currentRate.cgst += itm.camt;
    currentRate.sgst += itm.samt;
    currentRate.igst += itm.iamt;
    currentRate.totalTax += itm.totalTax;
    currentRate.count += 1;
    rateDistribution[itm.rt] = currentRate;
  });

  const hsnSummaryByCode = Array.from(hsnMap.values())
    .map((row) => ({
      hsn_sc: row.hsn_sc,
      description: row.description,
      uqc: row.uqc,
      totalQty: Number(row.totalQty.toFixed(2)),
      rates: Array.from(row.ratesSet as Set<number>),
      totalTaxable: Number(row.totalTaxable.toFixed(2)),
      totalCgst: Number(row.totalCgst.toFixed(2)),
      totalSgst: Number(row.totalSgst.toFixed(2)),
      totalIgst: Number(row.totalIgst.toFixed(2)),
      totalCess: Number(row.totalCess.toFixed(2)),
      totalTax: Number(row.totalTax.toFixed(2)),
      totalValue: Number(row.totalValue.toFixed(2)),
      b2bQty: Number(row.b2bQty.toFixed(2)),
      b2cQty: Number(row.b2cQty.toFixed(2)),
      b2bTaxable: Number(row.b2bTaxable.toFixed(2)),
      b2cTaxable: Number(row.b2cTaxable.toFixed(2)),
      percentageOfTotal: totalHsnTaxableGlobal > 0 ? Number(((row.totalTaxable / totalHsnTaxableGlobal) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.totalTaxable - a.totalTaxable);

  // 5. Extract Documents Issued
  const docIssue: Gstr1DocItem[] = [];
  let totalDocsIssued = 0;
  let totalDocsCancelled = 0;
  let netDocsIssued = 0;

  if (data.doc_issue && Array.isArray(data.doc_issue.doc_det)) {
    data.doc_issue.doc_det.forEach((det: any) => {
      const docTypeNum = Number(det.doc_num || 1);
      const docName = docTypeNum === 1 ? 'Invoices for outward supply' : `Document Series #${docTypeNum}`;

      if (Array.isArray(det.docs)) {
        det.docs.forEach((doc: any) => {
          const tot = Number(doc.totnum || 0);
          const canc = Number(doc.cancel || 0);
          const net = Number(doc.net_issue || (tot - canc));

          totalDocsIssued += tot;
          totalDocsCancelled += canc;
          netDocsIssued += net;

          docIssue.push({
            num: Number(doc.num || 1),
            from: String(doc.from || ''),
            to: String(doc.to || ''),
            totnum: tot,
            cancel: canc,
            net_issue: net,
            doc_name: docName
          });
        });
      }
    });
  }

  // 6. Global Summary Totals
  const totalB2bTaxable = b2bInvoices.reduce((s, i) => s + i.totalTaxable, 0);
  const totalB2bCgst = b2bInvoices.reduce((s, i) => s + i.totalCgst, 0);
  const totalB2bSgst = b2bInvoices.reduce((s, i) => s + i.totalSgst, 0);
  const totalB2bIgst = b2bInvoices.reduce((s, i) => s + i.totalIgst, 0);
  const totalB2bCess = b2bInvoices.reduce((s, i) => s + i.totalCess, 0);
  const totalB2bTax = totalB2bCgst + totalB2bSgst + totalB2bIgst + totalB2bCess;
  const totalB2bValue = b2bInvoices.reduce((s, i) => s + i.val, 0);

  const totalB2csTaxable = b2csItems.reduce((s, i) => s + i.txval, 0);
  const totalB2csCgst = b2csItems.reduce((s, i) => s + i.camt, 0);
  const totalB2csSgst = b2csItems.reduce((s, i) => s + i.samt, 0);
  const totalB2csIgst = b2csItems.reduce((s, i) => s + (i.iamt || 0), 0);
  const totalB2csCess = b2csItems.reduce((s, i) => s + (i.csamt || 0), 0);
  const totalB2csTax = totalB2csCgst + totalB2csSgst + totalB2csIgst + totalB2csCess;
  const totalB2csValue = b2csItems.reduce((s, i) => s + i.totalValue, 0);

  const grandTotalTaxable = Number((totalB2bTaxable + totalB2csTaxable).toFixed(2));
  const grandTotalCgst = Number((totalB2bCgst + totalB2csCgst).toFixed(2));
  const grandTotalSgst = Number((totalB2bSgst + totalB2csSgst).toFixed(2));
  const grandTotalIgst = Number((totalB2bIgst + totalB2csIgst).toFixed(2));
  const grandTotalCess = Number((totalB2bCess + totalB2csCess).toFixed(2));
  const grandTotalTax = Number((totalB2bTax + totalB2csTax).toFixed(2));
  const grandTotalValue = Number((totalB2bValue + totalB2csValue).toFixed(2));

  const totalStockUnitsDispatched = hsnItems.reduce((s, i) => s + i.qty, 0);

  return {
    gstin,
    fp,
    periodFormatted,
    grossTurnover: data.gt,
    currentGrossTurnover: data.cur_gt,
    b2bInvoices,
    b2csItems,
    b2clInvoices: Array.isArray(data.b2cl) ? data.b2cl : [],
    cdnrItems: Array.isArray(data.cdnr) ? data.cdnr : [],
    cdnurItems: Array.isArray(data.cdnur) ? data.cdnur : [],
    hsnItems,
    hsnSummaryByCode,
    uqcDistribution,
    rateDistribution,
    docIssue,
    summary: {
      totalB2bInvoices: b2bInvoices.length,
      totalB2bValue: Number(totalB2bValue.toFixed(2)),
      totalB2bTaxable: Number(totalB2bTaxable.toFixed(2)),
      totalB2bTax: Number(totalB2bTax.toFixed(2)),
      uniqueB2bBuyers: b2bBuyersSet.size,
      totalB2csValue: Number(totalB2csValue.toFixed(2)),
      totalB2csTaxable: Number(totalB2csTaxable.toFixed(2)),
      totalB2csTax: Number(totalB2csTax.toFixed(2)),
      grandTotalTaxable,
      grandTotalCgst,
      grandTotalSgst,
      grandTotalIgst,
      grandTotalCess,
      grandTotalTax,
      grandTotalValue,
      totalStockUnitsDispatched: Number(totalStockUnitsDispatched.toFixed(2)),
      totalHsnLines: hsnItems.length,
      uniqueHsnCount: new Set(hsnItems.map(i => i.hsn_sc)).size,
      totalDocsIssued,
      totalDocsCancelled,
      netDocsIssued
    }
  };
}
