import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';

try {
  const vfs = (pdfFonts as any)?.pdfMake?.vfs || (pdfFonts as any)?.vfs || (pdfFonts as any)?.default?.pdfMake?.vfs || (pdfFonts as any)?.default?.vfs;
  if (vfs) {
    (pdfMake as any).vfs = vfs;
  }
} catch (e) {
  console.warn('pdfMake VFS initialization warning:', e);
}

const customFonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  },
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

const C = {
  primary: '#1B3A6B',
  border: '#A0B4CC',
  borderDark: '#1B3A6B',
  textDark: '#1A1A2E',
  textMid: '#3D4D6A',
  textLight: '#6B7A99',
  red: '#991B1B',
  green: '#059669',
};

const formatCurrency = (amount: number | undefined | null): string =>
  '\u20B9\u00A0' +
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(amount) || 0,
  );

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

export async function createPdfBufferFromDocDef(docDefinition: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      if (!docDefinition.defaultStyle) docDefinition.defaultStyle = {};
      if (!docDefinition.defaultStyle.font) docDefinition.defaultStyle.font = 'Helvetica';

      const pdfDoc = (pdfMake as any).createPdf(docDefinition, null, customFonts);
      pdfDoc.getBuffer((buffer: Buffer) => {
        resolve(buffer);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function exportBillsToPdfBuffer(bills: any[], firm: any): Promise<Buffer> {
  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { fontSize: 8.5, color: C.textDark },
    content: [
      { text: (firm?.name || 'Company Name').toUpperCase(), fontSize: 14, bold: true, color: C.primary, alignment: 'center' },
      { text: 'BILLS & INVOICES REGISTER', fontSize: 12, bold: true, alignment: 'center', margin: [0, 2, 0, 15] },
      {
        table: {
          headerRows: 1,
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
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.primary, color: '#FFFFFF', margin: [2, 3, 2, 3] }
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
    pageMargins: [30, 30, 30, 30],
    defaultStyle: { fontSize: 8.5, color: C.textDark },
    content: [
      { text: (data.firmName || '').toUpperCase(), fontSize: 13, bold: true, color: C.primary, alignment: 'center' },
      { text: `ACCOUNT LEDGER: ${data.accountHead.toUpperCase()}`, fontSize: 11, bold: true, alignment: 'center', margin: [0, 2, 0, 2] },
      { text: data.periodText, fontSize: 8.5, italic: true, alignment: 'center', margin: [0, 0, 0, 10] },
      {
        table: {
          headerRows: 1,
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
            [
              { text: '—', alignment: 'center', fontSize: 8 },
              { text: 'OPENING BAL', bold: true, fontSize: 8 },
              { text: 'Brought forward balance', fontSize: 8 },
              { text: data.startingBal.balanceType === 'DR' && data.startingBal.balance > 0 ? formatCurrency(data.startingBal.balance) : '', alignment: 'right', fontSize: 8 },
              { text: data.startingBal.balanceType === 'CR' && data.startingBal.balance > 0 ? formatCurrency(data.startingBal.balance) : '', alignment: 'right', fontSize: 8 },
              { text: `${formatCurrency(data.startingBal.balance)} ${data.startingBal.balanceType}`, alignment: 'right', bold: true, fontSize: 8 },
            ],
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
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.primary, color: '#FFFFFF', margin: [2, 3, 2, 3] }
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
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.primary, color: '#FFFFFF', margin: [2, 3, 2, 3] }
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
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.primary, color: '#FFFFFF', margin: [2, 3, 2, 3] }
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
      tblHdr: { bold: true, fontSize: 8.5, fillColor: C.primary, color: '#FFFFFF', margin: [2, 3, 2, 3] }
    }
  };
  return createPdfBufferFromDocDef(docDefinition);
}
