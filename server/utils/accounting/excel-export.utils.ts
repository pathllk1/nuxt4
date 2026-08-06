import ExcelJS from 'exceljs';

// ── Colors & Styles Palette ──────────────────────────────────────────────────
const COLORS = {
  navy: '1E3A8A',       // Primary Header
  slateDark: '0F172A',  // Title / Dark Text
  slateBorder: 'CBD5E1',// Borders
  slateLight: 'F8FAFC', // Alternating row bg
  grayBg: 'F1F5F9',     // Group / Sub-total bg
  greenBg: 'E6F4EA',    // Balanced banner bg
  greenText: '137333',  // Balanced banner text
  redBg: 'FCE8E6',      // Imbalanced banner bg
  redText: 'C5221F',    // Imbalanced banner text
  emerald: '10B981',    // Credit / Positive Accent
  rose: 'EF4444',       // Debit / Negative Accent
  indigo: '6366F1',     // Capital / Net Profit Accent
};

// ── Styling Helper Functions ─────────────────────────────────────────────────
function styleTitleBlock(ws: ExcelJS.Worksheet, title: string, subtitle: string, firmName: string) {
  // Firm Name
  const row1 = ws.getRow(1);
  row1.getCell(1).value = firmName.toUpperCase();
  row1.getCell(1).font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF475569' } };
  row1.height = 20;

  // Report Title
  const row2 = ws.getRow(2);
  row2.getCell(1).value = title;
  row2.getCell(1).font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: COLORS.navy } };
  row2.height = 25;

  // Period / Date Subtitle
  const row3 = ws.getRow(3);
  row3.getCell(1).value = subtitle;
  row3.getCell(1).font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
  row3.height = 18;

  ws.addRow([]); // Empty spacing row
}

function applyBordersToRow(row: ExcelJS.Row, colCount: number, borderStyle: any = {}) {
  const defaultBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  const actualBorder = { ...defaultBorder, ...borderStyle };
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).border = actualBorder;
  }
}

function autoFitColumns(ws: ExcelJS.Worksheet, minWidth: number = 12) {
  ws.columns.forEach((column: any) => {
    let maxLen = 0;
    column.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
      const valStr = cell.value ? String(cell.value) : '';
      if (Number((cell as any).row) > 4 && valStr.length > maxLen && valStr.length < 50) {
        maxLen = valStr.length;
      }
    });
    column.width = Math.max(maxLen + 4, minWidth);
  });
}

function formatCurrencyCell(cell: ExcelJS.Cell) {
  cell.numFmt = '₹#,##0.00;[Red](₹#,##0.00);"—"';
}

function formatCenterDateCell(cell: ExcelJS.Cell) {
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

// ── Export Implementations ───────────────────────────────────────────────────

/**
 * 1. TRIAL BALANCE EXPORT
 */
export async function generateTrialBalanceExcel(data: {
  firmName: string;
  periodText: string;
  tbData: any[];
  isBalanced: boolean;
  diff: number;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Trial Balance');
  ws.views = [{ showGridLines: true }];

  styleTitleBlock(ws, 'TRIAL BALANCE', data.periodText, data.firmName);

  const statusRow = ws.getRow(5);
  ws.mergeCells('A5:D5');
  const statusCell = statusRow.getCell(1);
  if (data.isBalanced) {
    statusCell.value = 'STATUS: BALANCED (Total Debit matches Total Credit)';
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.greenBg } };
    statusCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.greenText } };
  } else {
    statusCell.value = `STATUS: IMBALANCED (Difference of ₹${data.diff.toFixed(2)})`;
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.redBg } };
    statusCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.redText } };
  }
  statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
  statusRow.height = 24;
  applyBordersToRow(statusRow, 4, {
    top: { style: 'medium', color: { argb: data.isBalanced ? COLORS.greenText : COLORS.redText } },
    bottom: { style: 'medium', color: { argb: data.isBalanced ? COLORS.greenText : COLORS.redText } },
  });

  ws.addRow([]);

  const headers = ['ACCOUNT HEAD', 'CATEGORY', 'DEBIT (DR)', 'CREDIT (CR)'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.navy } };
    cell.alignment = {
      horizontal: colIndex > 2 ? 'right' : 'left',
      vertical: 'middle',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
      bottom: { style: 'medium', color: { argb: COLORS.slateDark } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
    };
  });

  let totalDebits = 0;
  let totalCredits = 0;

  data.tbData.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;
    
    totalDebits += row.totalDebit || 0;
    totalCredits += row.totalCredit || 0;

    const dataRow = ws.addRow([
      row.accountHead,
      row.accountType?.replace(/_/g, ' ') || 'GENERAL',
      row.totalDebit > 0 ? row.totalDebit : '',
      row.totalCredit > 0 ? row.totalCredit : '',
    ]);

    dataRow.height = 20;
    dataRow.eachCell((cell, colIndex) => {
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF' + COLORS.slateDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colIndex > 2) {
        formatCurrencyCell(cell);
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  const totalsRow = ws.addRow([
    'GRAND TOTALS',
    '',
    totalDebits,
    totalCredits,
  ]);
  totalsRow.height = 24;
  totalsRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF' + COLORS.slateDark } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.grayBg } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      bottom: { style: 'double', color: { argb: COLORS.navy } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    };

    if (colIndex > 2) {
      formatCurrencyCell(cell);
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = {
        name: 'Segoe UI',
        size: 10.5,
        bold: true,
        color: { argb: colIndex === 3 ? 'FF' + COLORS.greenText : 'FF' + COLORS.redText },
      };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });

  autoFitColumns(ws, 15);
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * 2. GENERAL LEDGER EXPORT
 */
export async function generateLedgerExcel(data: {
  firmName: string;
  periodText: string;
  accountHead: string;
  startingBal: {
    balance: number;
    balanceType: string;
    rawBalance: number;
  };
  mappedEntries: any[];
  totalDebits: number;
  totalCredits: number;
  finalBalance: number;
  finalBalanceType: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('General Ledger');
  ws.views = [{ showGridLines: true }];

  styleTitleBlock(ws, `GENERAL LEDGER: ${data.accountHead.toUpperCase()}`, data.periodText, data.firmName);

  const obRow = ws.getRow(5);
  ws.mergeCells('A5:F5');
  const obCell = obRow.getCell(1);
  obCell.value = `STARTING POSITION (Prior to Statement Period): ${data.startingBal.balanceType} BALANCE OF ₹${data.startingBal.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  obCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.grayBg } };
  obCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.slateDark } };
  obCell.alignment = { horizontal: 'center', vertical: 'middle' };
  obRow.height = 24;
  applyBordersToRow(obRow, 6, {
    top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    bottom: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
  });

  ws.addRow([]);

  const headers = ['DATE', 'VOUCHER / REF', 'NARRATION', 'DEBIT (DR)', 'CREDIT (CR)', 'RUNNING BAL'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.navy } };
    cell.alignment = {
      horizontal: colIndex > 3 ? 'right' : (colIndex === 1 ? 'center' : 'left'),
      vertical: 'middle',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
      bottom: { style: 'medium', color: { argb: COLORS.slateDark } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
    };
  });

  const opRow = ws.addRow([
    data.periodText.split('to')[0]?.trim() || '—',
    'OPENING BAL',
    'Brought forward balance',
    data.startingBal.balanceType === 'DR' && data.startingBal.balance > 0 ? data.startingBal.balance : '',
    data.startingBal.balanceType === 'CR' && data.startingBal.balance > 0 ? data.startingBal.balance : '',
    `${data.startingBal.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${data.startingBal.balanceType}`,
  ]);
  opRow.height = 22;
  opRow.eachCell((cell, colIdx) => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF64748B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.slateLight } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
    if (colIdx === 1) formatCenterDateCell(cell);
    if (colIdx === 4 || colIdx === 5) formatCurrencyCell(cell);
    if (colIdx === 6) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: data.startingBal.balanceType === 'DR' ? 'FF' + COLORS.greenText : 'FF' + COLORS.redText } };
    }
  });

  data.mappedEntries.forEach((row, idx) => {
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;
    
    let dateVal = '';
    if (row.transactionDate) {
      try {
        const d = new Date(row.transactionDate);
        dateVal = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      } catch {
        dateVal = String(row.transactionDate);
      }
    }

    const docRow = ws.addRow([
      dateVal,
      `${row.voucherNo || row.refType || 'N/A'}${row.voucherType ? ` (${row.voucherType})` : ''}`,
      row.narration || '',
      row.debitAmount > 0 ? row.debitAmount : '',
      row.creditAmount > 0 ? row.creditAmount : '',
      `${row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${row.runningBalanceType}`,
    ]);

    docRow.height = 22;
    docRow.eachCell((cell, colIdx) => {
      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF' + COLORS.slateDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colIdx === 1) formatCenterDateCell(cell);
      if (colIdx === 4 || colIdx === 5) {
        formatCurrencyCell(cell);
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (row.debitAmount > 0 && colIdx === 4) cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF' + COLORS.rose } };
        if (row.creditAmount > 0 && colIdx === 5) cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF' + COLORS.emerald } };
      }
      if (colIdx === 6) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: row.runningBalanceType === 'DR' ? 'FF' + COLORS.greenText : 'FF' + COLORS.redText } };
      }
    });
  });

  const totalsRow = ws.addRow([
    'PERIOD TOTALS',
    '',
    `${data.mappedEntries.length} txn(s)`,
    data.totalDebits,
    data.totalCredits,
    `${data.finalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${data.finalBalanceType}`,
  ]);
  totalsRow.height = 24;
  totalsRow.eachCell((cell, colIdx) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.slateDark } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.grayBg } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      bottom: { style: 'double', color: { argb: COLORS.navy } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    };

    if (colIdx === 4 || colIdx === 5) {
      formatCurrencyCell(cell);
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: colIdx === 4 ? 'FF' + COLORS.rose : 'FF' + COLORS.emerald } };
    }
    if (colIdx === 6) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: data.finalBalanceType === 'DR' ? 'FF' + COLORS.greenText : 'FF' + COLORS.redText } };
    }
  });

  autoFitColumns(ws, 14);
  ws.getColumn(3).width = 30;
  ws.getColumn(2).width = 25;
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function createKPIBlock(ws: ExcelJS.Worksheet, startRow: number, cards: { title: string; val: number; colorHex: string; isPercent?: boolean; pText?: string }[]) {
  ws.getRow(startRow).height = 18;
  ws.getRow(startRow + 1).height = 24;
  ws.getRow(startRow + 2).height = 16;

  cards.forEach((card, index) => {
    const colIndex = index * 3 + 1;
    const colEnd = colIndex + 2;
    
    ws.mergeCells(startRow, colIndex, startRow, colEnd);
    const lblCell = ws.getCell(startRow, colIndex);
    lblCell.value = card.title.toUpperCase();
    lblCell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF64748B' } };
    lblCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(startRow + 1, colIndex, startRow + 1, colEnd);
    const valCell = ws.getCell(startRow + 1, colIndex);
    if (card.isPercent) {
      valCell.value = `${card.val.toFixed(1)}%`;
    } else {
      valCell.value = card.val;
      formatCurrencyCell(valCell);
    }
    valCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF' + card.colorHex } };
    valCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(startRow + 2, colIndex, startRow + 2, colEnd);
    const subCell = ws.getCell(startRow + 2, colIndex);
    subCell.value = card.pText || 'Statement Period';
    subCell.font = { name: 'Segoe UI', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };

    for (let r = startRow; r <= startRow + 2; r++) {
      for (let c = colIndex; c <= colEnd; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.slateLight } };
        
        const border: any = {};
        if (r === startRow) border.top = { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } };
        if (r === startRow + 2) border.bottom = { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } };
        if (c === colIndex) border.left = { style: 'medium', color: { argb: 'FF' + card.colorHex } };
        if (c === colEnd) border.right = { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } };
        cell.border = border;
      }
    }
  });

  ws.addRow([]);
}

/**
 * 3. PROFIT & LOSS STATEMENT EXPORT
 */
export async function generateProfitLossExcel(data: {
  firmName: string;
  periodText: string;
  plModel: any;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Profit & Loss');
  ws.views = [{ showGridLines: true }];

  styleTitleBlock(ws, 'TRADING AND PROFIT & LOSS STATEMENT', data.periodText, data.firmName);

  const kpis = [
    { title: 'Total Revenue', val: data.plModel.totalRevenueCr, colorHex: COLORS.emerald, pText: `${data.plModel.crIncome?.length || 0} Accounts` },
    { title: 'Gross Profit', val: data.plModel.grossProfit, colorHex: '0284C7', pText: `${(data.plModel.gpMargin || 0).toFixed(1)}% GP Margin` },
    { title: 'Operating Expenses', val: data.plModel.totalOpex, colorHex: COLORS.rose, pText: `${data.plModel.drOpex?.length || 0} Accounts` },
    { title: 'Net Profit', val: data.plModel.netProfit, colorHex: COLORS.indigo, pText: `${(data.plModel.npMargin || 0).toFixed(1)}% NP Margin` },
  ];
  createKPIBlock(ws, 5, kpis);

  const tableStartRow = 9;

  const subHeaders = ['DEBIT SIDE (DR) - EXPENSES', 'AMOUNT', 'CREDIT SIDE (CR) - INCOMES', 'AMOUNT'];
  const subHeaderRow = ws.getRow(tableStartRow);
  subHeaderRow.values = subHeaders;
  subHeaderRow.height = 24;
  subHeaderRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (colIndex === 1 || colIndex === 2 ? COLORS.slateDark : COLORS.navy) } };
    cell.alignment = { horizontal: colIndex % 2 === 0 ? 'right' : 'left', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      bottom: { style: 'medium', color: { argb: 'FF' + COLORS.slateDark } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    };
  });

  const drList: { label: string; val: any; type: 'HEADER' | 'ITEM' | 'TOTAL' | 'NET_PROFIT' }[] = [];
  drList.push({ label: 'To Cost of Goods Sold', val: data.plModel.totalCOGS, type: 'HEADER' });
  (data.plModel.drCOGS || []).forEach((a: any) => drList.push({ label: `  ${a.head}`, val: Math.abs(a.netCr), type: 'ITEM' }));
  (data.plModel.crCOGS || []).forEach((a: any) => drList.push({ label: `  ${a.head} (Contra)`, val: -a.netCr, type: 'ITEM' }));

  if ((data.plModel.drContraIncome || []).length > 0) {
    drList.push({ label: 'To Returns / Contra Income', val: data.plModel.totalContraInc, type: 'HEADER' });
    data.plModel.drContraIncome.forEach((a: any) => drList.push({ label: `  ${a.head}`, val: Math.abs(a.netCr), type: 'ITEM' }));
  }

  drList.push({ label: 'To Operating Expenses', val: data.plModel.totalOpex, type: 'HEADER' });
  (data.plModel.drOpex || []).forEach((a: any) => drList.push({ label: `  ${a.head}`, val: Math.abs(a.netCr), type: 'ITEM' }));
  (data.plModel.crOpex || []).forEach((a: any) => drList.push({ label: `  ${a.head} (Contra)`, val: -a.netCr, type: 'ITEM' }));

  if ((data.plModel.drGeneral || []).length > 0) {
    drList.push({ label: 'To Miscellaneous Expenses', val: data.plModel.drGeneral.reduce((s:number,a:any)=>s+Math.abs(a.netCr),0), type: 'HEADER' });
    data.plModel.drGeneral.forEach((a: any) => drList.push({ label: `  ${a.head}`, val: Math.abs(a.netCr), type: 'ITEM' }));
  }

  if (data.plModel.netProfit >= 0) {
    drList.push({ label: 'To Net Profit (Transferred to Capital)', val: data.plModel.netProfit, type: 'NET_PROFIT' });
  }

  const crList: { label: string; val: any; type: 'HEADER' | 'ITEM' | 'TOTAL' | 'NET_LOSS' }[] = [];
  crList.push({ label: 'By Revenue / Sales', val: data.plModel.totalRevenueCr, type: 'HEADER' });
  (data.plModel.crIncome || []).forEach((a: any) => crList.push({ label: `  ${a.head}`, val: a.netCr, type: 'ITEM' }));

  if ((data.plModel.crGeneral || []).length > 0) {
    crList.push({ label: 'By Miscellaneous Income', val: data.plModel.crGeneral.reduce((s:number,a:any)=>s+a.netCr,0), type: 'HEADER' });
    data.plModel.crGeneral.forEach((a: any) => crList.push({ label: `  ${a.head}`, val: a.netCr, type: 'ITEM' }));
  }

  if ((data.plModel.crCOGS || []).length + (data.plModel.crOpex || []).length > 0) {
    crList.push({ label: 'By Contra Expense Reversals', val: (data.plModel.crCOGS || []).reduce((s:number,a:any)=>s+a.netCr,0)+ (data.plModel.crOpex || []).reduce((s:number,a:any)=>s+a.netCr,0), type: 'HEADER' });
    [...(data.plModel.crCOGS || []), ...(data.plModel.crOpex || [])].forEach((a: any) => crList.push({ label: `  ${a.head}`, val: a.netCr, type: 'ITEM' }));
  }

  if (data.plModel.netProfit < 0) {
    crList.push({ label: 'By Net Loss (Transferred to Capital)', val: Math.abs(data.plModel.netProfit), type: 'NET_LOSS' });
  }

  const maxLen = Math.max(drList.length, crList.length);
  while (drList.length < maxLen) drList.push({ label: '', val: '', type: 'ITEM' });
  while (crList.length < maxLen) crList.push({ label: '', val: '', type: 'ITEM' });

  for (let i = 0; i < maxLen; i++) {
    const dr = drList[i] || { label: '', val: '', type: 'ITEM' };
    const cr = crList[i] || { label: '', val: '', type: 'ITEM' };
    const newRow = ws.addRow([dr.label, dr.val, cr.label, cr.val]);
    newRow.height = 20;

    const isEven = i % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;

    newRow.eachCell((cell, colIdx) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      const item = colIdx === 1 || colIdx === 2 ? dr : cr;

      if (colIdx === 2 || colIdx === 4) {
        if (typeof cell.value === 'number') {
          formatCurrencyCell(cell);
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      if (item && item.type === 'HEADER') {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: colIdx <= 2 ? COLORS.navy : COLORS.greenText } };
      } else if (item && item.type === 'NET_PROFIT') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8B4FE' } };
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF5B21B6' } };
      } else if (item && item.type === 'NET_LOSS') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      } else {
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF475569' } };
      }
    });
  }

  const totalsRow = ws.addRow([
    'TOTAL EXPENSES & PROFITS',
    data.plModel.drGrand,
    'TOTAL INCOME & LOSSES',
    data.plModel.crGrand,
  ]);
  totalsRow.height = 24;
  totalsRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (colIndex <= 2 ? COLORS.navy : COLORS.greenText) } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      bottom: { style: 'double', color: { argb: COLORS.slateDark } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    };

    if (colIndex === 2 || colIndex === 4) {
      formatCurrencyCell(cell);
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });

  autoFitColumns(ws, 15);
  ws.getColumn(1).width = 30;
  ws.getColumn(3).width = 30;
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * 4. BALANCE SHEET EXPORT
 */
export async function generateBalanceSheetExcel(data: {
  firmName: string;
  periodText: string;
  bsModel: any;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Balance Sheet');
  ws.views = [{ showGridLines: true }];

  styleTitleBlock(ws, 'BALANCE SHEET', data.periodText, data.firmName);

  const statusRow = ws.getRow(5);
  ws.mergeCells('A5:D5');
  const statusCell = statusRow.getCell(1);
  if (data.bsModel.balanced) {
    statusCell.value = 'STATUS: BALANCED (Total Capital & Liabilities matches Total Assets)';
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.greenBg } };
    statusCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.greenText } };
  } else {
    const diff = Math.abs((data.bsModel.totalAssets || 0) - (data.bsModel.totalLiabSide || 0));
    statusCell.value = `STATUS: IMBALANCED (Difference of ₹${diff.toFixed(2)})`;
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.redBg } };
    statusCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.redText } };
  }
  statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
  statusRow.height = 24;
  applyBordersToRow(statusRow, 4, {
    top: { style: 'medium', color: { argb: data.bsModel.balanced ? COLORS.greenText : COLORS.redText } },
    bottom: { style: 'medium', color: { argb: data.bsModel.balanced ? COLORS.greenText : COLORS.redText } },
  });

  ws.addRow([]);

  const kpis = [
    { title: 'Total Assets', val: data.bsModel.totalAssets, colorHex: COLORS.emerald, pText: `${data.bsModel.assetSideCount || 0} Asset A/Cs` },
    { title: 'External Liabilities', val: data.bsModel.totalExtLib, colorHex: COLORS.rose, pText: `${data.bsModel.liabilitySideCount || 0} Liab A/Cs` },
    { title: 'Capital Equity', val: data.bsModel.capital, colorHex: COLORS.navy, pText: data.bsModel.capital >= 0 ? 'Equity Surplus' : 'Equity Deficit' },
    { title: 'Current Net Profit', val: data.bsModel.netProfit, colorHex: COLORS.indigo, pText: 'From P&L Statement' },
  ];
  createKPIBlock(ws, 7, kpis);

  const tableStartRow = 11;
  const headers = ['LIABILITIES & CAPITAL', 'AMOUNT', 'ASSETS', 'AMOUNT'];
  const headerRow = ws.getRow(tableStartRow);
  headerRow.values = headers;
  headerRow.height = 24;
  headerRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (colIndex <= 2 ? COLORS.slateDark : COLORS.navy) } };
    cell.alignment = { horizontal: colIndex % 2 === 0 ? 'right' : 'left', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      bottom: { style: 'medium', color: { argb: 'FF' + COLORS.slateDark } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    };
  });

  const liabList: { label: string; val: any; type: 'HEADER' | 'ITEM' | 'TOTAL' }[] = [];
  liabList.push({ label: 'Capital Account', val: data.bsModel.capital, type: 'HEADER' });
  liabList.push({ label: '  Equity / Starting Capital', val: data.bsModel.capital, type: 'ITEM' });
  liabList.push({ label: data.bsModel.netProfit >= 0 ? '  Add: Period Net Profit' : '  Less: Period Net Loss', val: data.bsModel.netProfit, type: 'ITEM' });
  liabList.push({ label: '  Total Capital Pool', val: data.bsModel.capital + data.bsModel.netProfit, type: 'TOTAL' });

  if ((data.bsModel.liabilities || []).length > 0) {
    liabList.push({ label: 'Loans & Liabilities', val: data.bsModel.totalLiab, type: 'HEADER' });
    data.bsModel.liabilities.forEach((a: any) => liabList.push({ label: `  ${a.head}`, val: a.netCr, type: 'ITEM' }));
  }

  if ((data.bsModel.creditors || []).length > 0) {
    liabList.push({ label: 'Sundry Creditors', val: data.bsModel.totalCred, type: 'HEADER' });
    data.bsModel.creditors.forEach((a: any) => liabList.push({ label: `  ${a.head}`, val: a.netCr, type: 'ITEM' }));
  }

  if (((data.bsModel.debtorCreditBalances || []).length + (data.bsModel.cashBankCreditBalances || []).length + (data.bsModel.assetCreditBalances || []).length) > 0) {
    liabList.push({ label: 'Other Credit Balances', val: (data.bsModel.totalDebtorCreditBalances || 0) + (data.bsModel.totalCashBankCreditBalances || 0) + (data.bsModel.totalAssetCreditBalances || 0), type: 'HEADER' });
    (data.bsModel.debtorCreditBalances || []).forEach((a: any) => liabList.push({ label: `  ${a.head} (Credit)`, val: a.netCr, type: 'ITEM' }));
    (data.bsModel.cashBankCreditBalances || []).forEach((a: any) => liabList.push({ label: `  ${a.head} (OD)`, val: a.netCr, type: 'ITEM' }));
    (data.bsModel.assetCreditBalances || []).forEach((a: any) => liabList.push({ label: `  ${a.head} (Credit)`, val: a.netCr, type: 'ITEM' }));
  }

  const assetList: { label: string; val: any; type: 'HEADER' | 'ITEM' | 'TOTAL' }[] = [];

  if ((data.bsModel.otherAssets || []).length > 0) {
    assetList.push({ label: 'Fixed & Other Assets', val: data.bsModel.totalOtherA, type: 'HEADER' });
    data.bsModel.otherAssets.forEach((a: any) => assetList.push({ label: `  ${a.head}`, val: a.netDr, type: 'ITEM' }));
  }

  if ((data.bsModel.stockAssets || []).length > 0) {
    assetList.push({ label: 'Stock & Inventory', val: data.bsModel.totalStock, type: 'HEADER' });
    data.bsModel.stockAssets.forEach((a: any) => assetList.push({ label: `  ${a.head}`, val: a.netDr, type: 'ITEM' }));
  }

  if ((data.bsModel.gstAssets || []).length > 0) {
    assetList.push({ label: 'Tax Receivables (GST Credit)', val: data.bsModel.totalGST, type: 'HEADER' });
    data.bsModel.gstAssets.forEach((a: any) => assetList.push({ label: `  ${a.head}`, val: a.netDr, type: 'ITEM' }));
  }

  if ((data.bsModel.debtors || []).length > 0) {
    assetList.push({ label: 'Sundry Debtors', val: data.bsModel.totalDebtors, type: 'HEADER' });
    data.bsModel.debtors.forEach((a: any) => assetList.push({ label: `  ${a.head}`, val: a.netDr, type: 'ITEM' }));
  }

  if ((data.bsModel.cashBank || []).length > 0) {
    assetList.push({ label: 'Cash & Bank Balances', val: data.bsModel.totalCashBank, type: 'HEADER' });
    data.bsModel.cashBank.forEach((a: any) => assetList.push({ label: `  ${a.head}`, val: a.netDr, type: 'ITEM' }));
  }

  if ((data.bsModel.liabilityDebitBalances || []).length > 0) {
    assetList.push({ label: 'Other Debit Balances', val: data.bsModel.totalLiabilityDebitBalances, type: 'HEADER' });
    data.bsModel.liabilityDebitBalances.forEach((a: any) => assetList.push({ label: `  ${a.head} (Debit)`, val: a.netDr, type: 'ITEM' }));
  }

  const maxLen = Math.max(liabList.length, assetList.length);
  while (liabList.length < maxLen) liabList.push({ label: '', val: '', type: 'ITEM' });
  while (assetList.length < maxLen) assetList.push({ label: '', val: '', type: 'ITEM' });

  for (let i = 0; i < maxLen; i++) {
    const liab = liabList[i] || { label: '', val: '', type: 'ITEM' };
    const asset = assetList[i] || { label: '', val: '', type: 'ITEM' };
    const newRow = ws.addRow([liab.label, liab.val, asset.label, asset.val]);
    newRow.height = 20;

    const isEven = i % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;

    newRow.eachCell((cell, colIdx) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      const item = colIdx <= 2 ? liab : asset;

      if (colIdx === 2 || colIdx === 4) {
        if (typeof cell.value === 'number') {
          formatCurrencyCell(cell);
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      if (item && item.type === 'HEADER') {
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: colIdx <= 2 ? COLORS.navy : COLORS.greenText } };
      } else if (item && item.type === 'TOTAL') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.grayBg } };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF' + COLORS.slateDark } };
      } else {
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF475569' } };
      }
    });
  }

  const totalsRow = ws.addRow([
    'TOTAL LIABILITIES & CAPITAL',
    data.bsModel.totalLiabSide,
    'TOTAL ASSETS',
    data.bsModel.totalAssets,
  ]);
  totalsRow.height = 24;
  totalsRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (colIndex <= 2 ? COLORS.navy : COLORS.greenText) } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      bottom: { style: 'double', color: { argb: COLORS.slateDark } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    };

    if (colIndex === 2 || colIndex === 4) {
      formatCurrencyCell(cell);
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });

  autoFitColumns(ws, 15);
  ws.getColumn(1).width = 30;
  ws.getColumn(3).width = 30;
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
