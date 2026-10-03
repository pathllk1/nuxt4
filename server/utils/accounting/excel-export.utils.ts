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
  ws.mergeCells('A5:G5');
  const obCell = obRow.getCell(1);
  obCell.value = `STARTING POSITION (Prior to Statement Period): ${data.startingBal.balanceType} BALANCE OF ₹${data.startingBal.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  obCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.grayBg } };
  obCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.slateDark } };
  obCell.alignment = { horizontal: 'center', vertical: 'middle' };
  obRow.height = 24;
  applyBordersToRow(obRow, 7, {
    top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    bottom: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
  });

  ws.addRow([]);

  const headers = ['DATE', 'VOUCHER / REF', 'ACCOUNT HEAD', 'NARRATION', 'DEBIT (DR)', 'CREDIT (CR)', 'RUNNING BAL'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.navy } };
    cell.alignment = {
      horizontal: colIndex > 4 ? 'right' : (colIndex === 1 ? 'center' : 'left'),
      vertical: 'middle',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
      bottom: { style: 'medium', color: { argb: COLORS.slateDark } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.navy } },
    };
  });

  if (data.startingBal.balance > 0 || data.periodText !== 'All Time') {
    const opRow = ws.addRow([
      data.periodText.includes('to') ? data.periodText.split('to')[0]?.trim() || '—' : '—',
      'OPENING BAL',
      'Opening Balance',
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
      if (colIdx === 5 || colIdx === 6) formatCurrencyCell(cell);
      if (colIdx === 7) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: data.startingBal.balanceType === 'DR' ? 'FF' + COLORS.greenText : 'FF' + COLORS.redText } };
      }
    });
  }

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
      row.opposingAccountHead || '—',
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
      if (colIdx === 5 || colIdx === 6) {
        formatCurrencyCell(cell);
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (row.debitAmount > 0 && colIdx === 5) cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF' + COLORS.rose } };
        if (row.creditAmount > 0 && colIdx === 6) cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF' + COLORS.emerald } };
      }
      if (colIdx === 7) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: row.runningBalanceType === 'DR' ? 'FF' + COLORS.greenText : 'FF' + COLORS.redText } };
      }
    });
  });

  const totalsRow = ws.addRow([
    'PERIOD TOTALS',
    '',
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

    if (colIdx === 5 || colIdx === 6) {
      formatCurrencyCell(cell);
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: colIdx === 5 ? 'FF' + COLORS.rose : 'FF' + COLORS.emerald } };
    }
    if (colIdx === 7) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: data.finalBalanceType === 'DR' ? 'FF' + COLORS.greenText : 'FF' + COLORS.redText } };
    }
  });

  autoFitColumns(ws, 14);
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 28;
  ws.getColumn(4).width = 34;
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

  const drList: { label: string; val: any; type: 'HEADER' | 'ITEM' | 'SUBTOTAL' | 'NET_PROFIT' }[] = [];
  drList.push({ label: 'To Cost of Goods Sold & Direct Expenses', val: '', type: 'HEADER' });

  // Standalone Direct COGS / Production Accounts (Purchases, Inventory, etc.)
  const directCogs = (data.plModel.drCOGS || []).filter((a: any) => a.type !== 'CASUAL_LABOR');
  directCogs.forEach((a: any) => drList.push({ label: `  ${a.head}`, val: Math.abs(a.netCr), type: 'ITEM' }));

  // Grouped Casual Labour / Direct Wages with sub-records
  const casualLabor = (data.plModel.drCOGS || []).filter((a: any) => a.type === 'CASUAL_LABOR');
  if (casualLabor.length > 0) {
    const clTotal = casualLabor.reduce((s: number, a: any) => s + Math.abs(a.netCr), 0);
    drList.push({ label: `  Casual Labour / Direct Wages (${casualLabor.length} Workers)`, val: clTotal, type: 'ITEM' });
    casualLabor.forEach((a: any) => drList.push({ label: `    ↳ ${a.head}`, val: Math.abs(a.netCr), type: 'ITEM' }));
  }

  drList.push({ label: '  Total Cost of Sales & Direct Expenses', val: data.plModel.sumDrCOGS, type: 'SUBTOTAL' });

  if ((data.plModel.drContraIncome || []).length > 0) {
    drList.push({ label: 'To Returns / Contra Income', val: '', type: 'HEADER' });
    data.plModel.drContraIncome.forEach((a: any) => drList.push({ label: `  ${a.head}`, val: Math.abs(a.netCr), type: 'ITEM' }));
    drList.push({ label: '  Total Contra Income', val: data.plModel.totalContraInc, type: 'SUBTOTAL' });
  }

  drList.push({ label: 'To Operating Expenses', val: '', type: 'HEADER' });
  (data.plModel.drOpex || []).forEach((a: any) => drList.push({ label: `  ${a.head}`, val: Math.abs(a.netCr), type: 'ITEM' }));
  drList.push({ label: '  Total Operating Expenses', val: data.plModel.sumDrOpex, type: 'SUBTOTAL' });

  if ((data.plModel.drGeneral || []).length > 0) {
    drList.push({ label: 'To Miscellaneous Expenses', val: '', type: 'HEADER' });
    data.plModel.drGeneral.forEach((a: any) => drList.push({ label: `  ${a.head}`, val: Math.abs(a.netCr), type: 'ITEM' }));
    drList.push({ label: '  Total Misc Expenses', val: data.plModel.sumDrGeneral, type: 'SUBTOTAL' });
  }

  if (data.plModel.netProfit >= 0) {
    drList.push({ label: 'To Net Profit (Transferred to Capital)', val: data.plModel.netProfit, type: 'NET_PROFIT' });
  }

  const crList: { label: string; val: any; type: 'HEADER' | 'ITEM' | 'SUBTOTAL' | 'NET_LOSS' }[] = [];
  crList.push({ label: 'By Revenue / Sales', val: '', type: 'HEADER' });
  (data.plModel.crIncome || []).forEach((a: any) => crList.push({ label: `  ${a.head}`, val: a.netCr, type: 'ITEM' }));
  crList.push({ label: '  Total Revenue', val: data.plModel.totalRevenueCr, type: 'SUBTOTAL' });

  if ((data.plModel.crGeneral || []).length > 0) {
    crList.push({ label: 'By Miscellaneous Income', val: '', type: 'HEADER' });
    data.plModel.crGeneral.forEach((a: any) => crList.push({ label: `  ${a.head}`, val: a.netCr, type: 'ITEM' }));
    crList.push({ label: '  Total Misc Income', val: data.plModel.sumCrGeneral, type: 'SUBTOTAL' });
  }

  if ((data.plModel.crCOGS || []).length + (data.plModel.crOpex || []).length > 0) {
    crList.push({ label: 'By Contra Expense', val: '', type: 'HEADER' });
    [...(data.plModel.crCOGS || []), ...(data.plModel.crOpex || [])].forEach((a: any) => crList.push({ label: `  ${a.head}`, val: a.netCr, type: 'ITEM' }));
    crList.push({ label: '  Total Contra Expense', val: data.plModel.sumContraExpense, type: 'SUBTOTAL' });
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
      } else if (item && item.type === 'SUBTOTAL') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
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
 * 4. BALANCE SHEET EXPORT (Schedule III / ICAI Standard with Annexures)
 */
export async function generateBalanceSheetExcel(data: {
  firmName: string;
  periodText: string;
  bsModel: any;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BusinessPro Accounting';

  const { firmName, periodText, bsModel } = data;

  const totalCapitalPool = (bsModel.capital || 0) + (bsModel.netProfit || 0) + (bsModel.diffObCr || 0);
  const totalOtherLiab = (bsModel.totalDebtorCreditBalances || 0) + (bsModel.totalCashBankCreditBalances || 0) + (bsModel.totalAssetCreditBalances || 0);
  const totalOtherDebits = (bsModel.totalLiabilityDebitBalances || 0) + (bsModel.diffObDr || 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 1: MAIN STATUTORY BALANCE SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  const wsMain = workbook.addWorksheet('Balance Sheet');
  wsMain.views = [{ showGridLines: true }];

  styleTitleBlock(wsMain, 'BALANCE SHEET STATEMENT', `(Prepared in accordance with ICAI Standards & Schedule III GAAP) — ${periodText}`, firmName);

  // Status Banner
  const statusRow = wsMain.getRow(5);
  wsMain.mergeCells('A5:F5');
  const statusCell = statusRow.getCell(1);
  if (bsModel.balanced) {
    statusCell.value = 'STATUS: BALANCED (Total Capital & Liabilities matches Total Assets)';
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.greenBg } };
    statusCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.greenText } };
  } else {
    const diff = Math.abs((bsModel.totalAssets || 0) - (bsModel.totalLiabSide || 0));
    statusCell.value = `STATUS: IMBALANCED (Difference of ₹${diff.toFixed(2)})`;
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.redBg } };
    statusCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF' + COLORS.redText } };
  }
  statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
  statusRow.height = 24;
  applyBordersToRow(statusRow, 6, {
    top: { style: 'medium', color: { argb: bsModel.balanced ? COLORS.greenText : COLORS.redText } },
    bottom: { style: 'medium', color: { argb: bsModel.balanced ? COLORS.greenText : COLORS.redText } },
  });

  wsMain.addRow([]);

  // Executive KPI Block
  const kpis = [
    { title: 'Total Assets', val: bsModel.totalAssets, colorHex: COLORS.emerald, pText: `${bsModel.assetSideCount || 0} Asset Accounts` },
    { title: 'External Liabilities', val: bsModel.totalExtLib, colorHex: COLORS.rose, pText: `${bsModel.liabilitySideCount || 0} Liability Accounts` },
    { title: 'Capital Equity', val: bsModel.capital, colorHex: COLORS.navy, pText: bsModel.capital >= 0 ? 'Equity Surplus' : 'Equity Deficit' },
    { title: 'Current Net Profit', val: bsModel.netProfit, colorHex: COLORS.indigo, pText: 'From Trading & P&L A/c' },
  ];
  createKPIBlock(wsMain, 7, kpis);

  // Financial Ratios Block
  const ratioRow = wsMain.getRow(10);
  ratioRow.values = [
    `Current Ratio: ${(bsModel.currentRatio || 0).toFixed(2)}`,
    '',
    `Quick Ratio: ${(bsModel.quickRatio || 0).toFixed(2)}`,
    '',
    `Working Capital: ₹${Number(bsModel.workingCapital || 0).toLocaleString('en-IN')}`,
    bsModel.balanced ? 'STATUS: BALANCED' : 'STATUS: IMBALANCED'
  ];
  ratioRow.height = 22;
  ratioRow.eachCell((cell, colIdx) => {
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: colIdx === 6 ? (bsModel.balanced ? 'FF059669' : 'FFDC2626') : 'FF334155' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colIdx === 6 ? (bsModel.balanced ? 'FFECFDF5' : 'FFFEF2F2') : 'FFF8FAFC' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });

  const tableStartRow = 12;
  const headers = ['LIABILITIES & CAPITAL', 'SCH', 'AMOUNT (₹)', 'ASSETS', 'SCH', 'AMOUNT (₹)'];
  const headerRow = wsMain.getRow(tableStartRow);
  headerRow.values = headers;
  headerRow.height = 26;
  headerRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (colIndex <= 3 ? COLORS.navy : '1E293B') } };
    cell.alignment = { horizontal: (colIndex === 3 || colIndex === 6) ? 'right' : (colIndex === 2 || colIndex === 5 ? 'center' : 'left'), vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      bottom: { style: 'medium', color: { argb: 'FF' + COLORS.slateDark } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    };
  });

  // Statutory Schedule Rows
  const mainLiabRows: Array<{ label: string; sch: string; val: number | string; isBold?: boolean }> = [
    { label: 'Capital Account / Equity Fund', sch: '1', val: totalCapitalPool, isBold: true },
    { label: 'Loans & Borrowings (Liabilities)', sch: '2', val: bsModel.totalLiab || 0 },
    { label: 'Trade Payables (Sundry Creditors)', sch: '3', val: bsModel.totalCred || 0, isBold: true },
    { label: 'Other Current Liabilities & Provisions', sch: '4', val: totalOtherLiab },
  ];

  const mainAssetRows: Array<{ label: string; sch: string; val: number | string; isBold?: boolean }> = [
    { label: 'Fixed & Non-Current Assets', sch: '5', val: bsModel.totalOtherA || 0 },
    { label: 'Inventories (Closing Stock)', sch: '6', val: bsModel.totalStock || 0 },
    { label: 'Trade Receivables (Sundry Debtors)', sch: '7', val: bsModel.totalDebtors || 0, isBold: true },
    { label: 'Cash & Cash Equivalents', sch: '8', val: bsModel.totalCashBank || 0 },
    { label: 'Tax Receivables (GST Input Credit)', sch: '9', val: bsModel.totalGST || 0 },
  ];

  if (totalOtherDebits > 0) {
    mainAssetRows.push({ label: 'Other Debit Balances & Advances', sch: '10', val: totalOtherDebits });
  }

  const maxMainLen = Math.max(mainLiabRows.length, mainAssetRows.length);
  while (mainLiabRows.length < maxMainLen) mainLiabRows.push({ label: '', sch: '', val: '' });
  while (mainAssetRows.length < maxMainLen) mainAssetRows.push({ label: '', sch: '', val: '' });

  for (let i = 0; i < maxMainLen; i++) {
    const l = mainLiabRows[i]!;
    const a = mainAssetRows[i]!;
    const row = wsMain.addRow([l.label, l.sch, l.val, a.label, a.sch, a.val]);
    row.height = 22;

    const rowBg = i % 2 === 0 ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;
    row.eachCell((cell, colIdx) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      const isLiab = colIdx <= 3;
      const item = isLiab ? l : a;

      if (colIdx === 2 || colIdx === 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF475569' } };
      } else if (colIdx === 3 || colIdx === 6) {
        if (typeof cell.value === 'number') {
          formatCurrencyCell(cell);
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: 'Segoe UI', size: 9.5, bold: !!item.isBold, color: { argb: 'FF0F172A' } };
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: !!item.isBold, color: { argb: 'FF1E293B' } };
      }
    });
  }

  // Grand Totals Row
  const totalsRow = wsMain.addRow([
    'TOTAL CAPITAL & LIABILITIES',
    '',
    bsModel.totalLiabSide,
    'TOTAL ASSETS',
    '',
    bsModel.totalAssets,
  ]);
  totalsRow.height = 26;
  totalsRow.eachCell((cell, colIndex) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.slateDark } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      bottom: { style: 'double', color: { argb: 'FFFFFFFF' } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    };

    if (colIndex === 3 || colIndex === 6) {
      formatCurrencyCell(cell);
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (colIndex === 2 || colIndex === 5) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
  });

  // Note row
  wsMain.addRow([]);
  const noteRow = wsMain.addRow(['Note: Please refer to the "Annexures & Schedules" worksheet for detailed party-wise and account-level breakdown.']);
  wsMain.mergeCells(`A${noteRow.number}:F${noteRow.number}`);
  noteRow.getCell(1).font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };

  // Set explicit column widths on wsMain
  wsMain.getColumn(1).width = 38;
  wsMain.getColumn(2).width = 8;
  wsMain.getColumn(3).width = 18;
  wsMain.getColumn(4).width = 38;
  wsMain.getColumn(5).width = 8;
  wsMain.getColumn(6).width = 18;

  // ═══════════════════════════════════════════════════════════════════════════
  // SHEET 2: ANNEXURES & SCHEDULES (RAW DATA BREAKDOWN)
  // ═══════════════════════════════════════════════════════════════════════════
  const wsAnnex = workbook.addWorksheet('Annexures & Schedules');
  wsAnnex.views = [{ showGridLines: true }];

  // Sheet 2 Title Block
  styleTitleBlock(wsAnnex, 'ANNEXURES FORMING PART OF THE BALANCE SHEET', `Detailed Supporting Schedules for the Period: ${periodText}`, firmName);

  const addScheduleTable = (
    scheduleNo: string,
    title: string,
    rows: Array<{ sno: string | number; name: string; type: string; amount: number }>,
    totalLabel: string,
    totalVal: number
  ) => {
    // Schedule Title Bar
    const titleRow = wsAnnex.addRow([`SCHEDULE / ANNEXURE ${scheduleNo}: ${title.toUpperCase()}`]);
    titleRow.height = 22;
    wsAnnex.mergeCells(`A${titleRow.number}:D${titleRow.number}`);
    const tCell = titleRow.getCell(1);
    tCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    tCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.navy } };
    tCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // Sub-header Row
    const subHdrRow = wsAnnex.addRow(['#', 'PARTICULARS / ACCOUNT HEAD', 'ACCOUNT CLASSIFICATION / NATURE', 'AMOUNT (₹)']);
    subHdrRow.height = 20;
    subHdrRow.eachCell((cell, colIdx) => {
      cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.alignment = { horizontal: colIdx === 4 ? 'right' : (colIdx === 1 ? 'center' : 'left'), vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    // Data rows
    rows.forEach((r, idx) => {
      const dataRow = wsAnnex.addRow([r.sno, r.name, r.type, r.amount]);
      dataRow.height = 19;
      const isEven = idx % 2 === 0;
      const bg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      dataRow.eachCell((cell, colIdx) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colIdx === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF64748B' } };
        } else if (colIdx === 4) {
          formatCurrencyCell(cell);
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF0F172A' } };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1E293B' } };
        }
      });
    });

    // Schedule Total Row
    const totRow = wsAnnex.addRow(['', totalLabel, '', totalVal]);
    totRow.height = 22;
    wsAnnex.mergeCells(`B${totRow.number}:C${totRow.number}`);
    totRow.eachCell((cell, colIdx) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      if (colIdx === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      } else if (colIdx === 4) {
        formatCurrencyCell(cell);
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
      }
    });

    wsAnnex.addRow([]); // Blank spacer
  };

  // 1. Capital Fund Schedule
  const capItems: Array<{ sno: string | number; name: string; type: string; amount: number }> = [
    { sno: 1, name: "Opening Capital / Proprietor's Equity", type: 'Capital Fund', amount: Math.abs(bsModel.capital || 0) },
    { sno: 2, name: (bsModel.netProfit || 0) >= 0 ? 'Add: Net Profit for the period (from P&L)' : 'Less: Net Loss for the period (from P&L)', type: 'Period Profit/Loss', amount: Math.abs(bsModel.netProfit || 0) },
  ];
  if ((bsModel.diffObCr || 0) > 0) {
    capItems.push({ sno: 3, name: 'Add: Difference in Opening Balances', type: 'Opening Balance Contra', amount: bsModel.diffObCr });
  }
  addScheduleTable('1', 'Capital Account / Equity Fund', capItems, 'TOTAL CAPITAL FUND (Carried to Balance Sheet Sch 1)', totalCapitalPool);

  // 2. Loans & Borrowings
  const liabilities = bsModel.liabilities || [];
  if (liabilities.length > 0) {
    const liabItems = liabilities.map((l: any, idx: number) => ({
      sno: idx + 1,
      name: l.head,
      type: l.type?.replace(/_/g, ' ') || 'Loan / Borrowing',
      amount: l.netCr,
    }));
    addScheduleTable('2', 'Loans & Borrowings (Liabilities)', liabItems, 'TOTAL LOANS & BORROWINGS (Carried to Sch 2)', bsModel.totalLiab);
  }

  // 3. Trade Payables (Sundry Creditors)
  const creditors = bsModel.creditors || [];
  if (creditors.length > 0) {
    const credItems = creditors.map((c: any, idx: number) => ({
      sno: idx + 1,
      name: c.head,
      type: c.type?.replace(/_/g, ' ') || 'Sundry Creditor',
      amount: c.netCr,
    }));
    addScheduleTable('3', 'Trade Payables (Sundry Creditors)', credItems, `TOTAL SUNDRY CREDITORS (${creditors.length} Suppliers - Carried to Sch 3)`, bsModel.totalCred);
  }

  // 4. Other Current Liabilities
  const otherLiabItems = [
    ...(bsModel.debtorCreditBalances || []).map((a: any) => ({ name: `${a.head} (Customer Advance)`, type: 'Customer Credit', amount: a.netCr })),
    ...(bsModel.cashBankCreditBalances || []).map((a: any) => ({ name: `${a.head} (Bank OD)`, type: 'Bank Overdraft', amount: a.netCr })),
    ...(bsModel.assetCreditBalances || []).map((a: any) => ({ name: a.head, type: 'Credit Balance', amount: a.netCr })),
  ];
  if (otherLiabItems.length > 0) {
    const olItems = otherLiabItems.map((o: any, idx: number) => ({
      sno: idx + 1,
      name: o.name,
      type: o.type,
      amount: o.amount,
    }));
    addScheduleTable('4', 'Other Current Liabilities & Provisions', olItems, 'TOTAL OTHER LIABILITIES (Carried to Sch 4)', totalOtherLiab);
  }

  // 5. Fixed Assets
  const otherAssets = bsModel.otherAssets || [];
  if (otherAssets.length > 0) {
    const oaItems = otherAssets.map((a: any, idx: number) => ({
      sno: idx + 1,
      name: a.head,
      type: a.type?.replace(/_/g, ' ') || 'Fixed Asset',
      amount: a.netDr,
    }));
    addScheduleTable('5', 'Fixed & Non-Current Assets', oaItems, 'TOTAL FIXED ASSETS (Carried to Sch 5)', bsModel.totalOtherA);
  }

  // 6. Inventories (Closing Stock)
  const stockAssets = bsModel.stockAssets || [];
  if (stockAssets.length > 0) {
    const stItems = stockAssets.map((s: any, idx: number) => ({
      sno: idx + 1,
      name: s.head,
      type: 'Inventory / Stock Ledger',
      amount: s.netDr,
    }));
    addScheduleTable('6', 'Inventories (Closing Stock)', stItems, 'TOTAL INVENTORIES (Carried to Sch 6)', bsModel.totalStock);
  }

  // 7. Trade Receivables (Sundry Debtors)
  const debtors = bsModel.debtors || [];
  if (debtors.length > 0) {
    const debItems = debtors.map((d: any, idx: number) => ({
      sno: idx + 1,
      name: d.head,
      type: d.type?.replace(/_/g, ' ') || 'Sundry Debtor',
      amount: d.netDr,
    }));
    addScheduleTable('7', 'Trade Receivables (Sundry Debtors)', debItems, `TOTAL SUNDRY DEBTORS (${debtors.length} Customers - Carried to Sch 7)`, bsModel.totalDebtors);
  }

  // 8. Cash & Bank Balances
  const cashBank = bsModel.cashBank || [];
  if (cashBank.length > 0) {
    const cbItems = cashBank.map((b: any, idx: number) => ({
      sno: idx + 1,
      name: b.head,
      type: b.type?.replace(/_/g, ' ') || 'Bank Account',
      amount: b.netDr,
    }));
    addScheduleTable('8', 'Cash & Bank Balances', cbItems, 'TOTAL CASH & BANK BALANCES (Carried to Sch 8)', bsModel.totalCashBank);
  }

  // 9. Tax Receivables (GST Input Credit)
  const gstAssets = bsModel.gstAssets || [];
  if (gstAssets.length > 0) {
    const gstItems = gstAssets.map((g: any, idx: number) => ({
      sno: idx + 1,
      name: g.head,
      type: 'Tax Receivable / Input Tax Credit',
      amount: g.netDr,
    }));
    addScheduleTable('9', 'Tax Receivables (GST Input Credit)', gstItems, 'TOTAL TAX RECEIVABLES (Carried to Sch 9)', bsModel.totalGST);
  }

  // 10. Other Debit Balances & Advances
  const otherDebitItems = [
    ...(bsModel.liabilityDebitBalances || []).map((a: any) => ({ name: `${a.head} (Advance / Dr)`, type: 'Liability Debit', amount: a.netDr })),
    ...(bsModel.diffObDr > 0 ? [{ name: 'Difference in Opening Balances', type: 'Opening Balance Contra', amount: bsModel.diffObDr }] : []),
  ];
  if (otherDebitItems.length > 0) {
    const odItems = otherDebitItems.map((o: any, idx: number) => ({
      sno: idx + 1,
      name: o.name,
      type: o.type,
      amount: o.amount,
    }));
    addScheduleTable('10', 'Other Debit Balances & Advances', odItems, 'TOTAL OTHER DEBITS (Carried to Sch 10)', totalOtherDebits);
  }

  // Set explicit column widths on wsAnnex
  wsAnnex.getColumn(1).width = 6;
  wsAnnex.getColumn(2).width = 44;
  wsAnnex.getColumn(3).width = 30;
  wsAnnex.getColumn(4).width = 20;

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function generateDrillDownExcel(data: {
  firmName: string;
  periodText: string;
  categoryTitle: string;
  accounts: Array<{ accountHead: string; totalDebit: number; totalCredit: number; balance: number; balanceType: string }>;
  grandTotalDebit: number;
  grandTotalCredit: number;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BusinessPro Accounting';
  const ws = workbook.addWorksheet('Drill-Down Summary');

  // Title Block
  const row1 = ws.getRow(1);
  row1.getCell(1).value = (data.firmName || 'Company').toUpperCase();
  row1.getCell(1).font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF475569' } };
  row1.height = 20;

  const row2 = ws.getRow(2);
  row2.getCell(1).value = `DRILL-DOWN STATEMENT: ${data.categoryTitle.toUpperCase()}`;
  row2.getCell(1).font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: COLORS.navy } };
  row2.height = 25;

  const row3 = ws.getRow(3);
  row3.getCell(1).value = data.periodText;
  row3.getCell(1).font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
  row3.height = 18;

  ws.addRow([]);

  const headerRow = ws.addRow(['#', 'ACCOUNT HEAD', 'DEBITS (₹)', 'CREDITS (₹)', 'NET BALANCE (₹)', 'TYPE']);
  headerRow.height = 24;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  data.accounts.forEach((acc, idx) => {
    const row = ws.addRow([
      idx + 1,
      acc.accountHead,
      acc.totalDebit,
      acc.totalCredit,
      acc.balance,
      acc.balanceType
    ]);
    row.height = 20;
    const isEven = idx % 2 === 0;
    const rowBg = isEven ? 'FFFFFFFF' : 'FF' + COLORS.slateLight;

    row.eachCell((cell, colIdx) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colIdx === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (colIdx === 2) cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
      if (colIdx === 3 || colIdx === 4 || colIdx === 5) {
        if (typeof cell.value === 'number') {
          cell.numFmt = '₹ #,##0.00;[Red]-₹ #,##0.00;₹ 0.00';
        }
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colIdx === 3 && acc.totalDebit > 0) cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.emerald } };
        if (colIdx === 4 && acc.totalCredit > 0) cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: COLORS.rose } };
      }
      if (colIdx === 6) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  const grandRow = ws.addRow([
    '',
    'GRAND TOTAL',
    data.grandTotalDebit,
    data.grandTotalCredit,
    Math.abs(data.grandTotalDebit - data.grandTotalCredit),
    data.grandTotalDebit >= data.grandTotalCredit ? 'DR' : 'CR'
  ]);
  grandRow.height = 24;
  grandRow.eachCell((cell, colIdx) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COLORS.grayBg } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      bottom: { style: 'double', color: { argb: COLORS.slateDark } },
      left: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
      right: { style: 'thin', color: { argb: 'FF' + COLORS.slateBorder } },
    };
    if (colIdx >= 3 && colIdx <= 5 && typeof cell.value === 'number') {
      cell.numFmt = '₹ #,##0.00;[Red]-₹ #,##0.00;₹ 0.00';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 35;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 20;
  ws.getColumn(6).width = 10;

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// ── Day Book Excel Generator ──────────────────────────────────────────────────
export async function generateDayBookExcel(data: {
  firmName: string;
  periodText: string;
  vouchers: any[];
  summary: any;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fastify Accounting System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Day Book', {
    pageSetup: { orientation: 'landscape', paperSize: 9 }
  });

  // Title Block
  styleTitleBlock(ws, 'DAY BOOK (TRANSACTION JOURNAL)', data.periodText, data.firmName);

  // Summary Highlights Row
  const summaryRow = ws.addRow([
    `Total Vouchers: ${data.summary.totalVouchers || 0}`,
    `Total Inflows (Receipts): ₹${(data.summary.totalReceipts || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `Total Outflows (Payments): ₹${(data.summary.totalPayments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `Total Debits: ₹${(data.summary.totalDebits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `Total Credits: ₹${(data.summary.totalCredits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `Status: ${data.summary.isBooksBalanced ? 'BALANCED' : 'IMBALANCED'}`
  ]);
  summaryRow.height = 20;
  summaryRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
  });

  ws.addRow([]); // Blank line

  // Column Headers
  const headers = ['Date', 'Voucher No', 'Voucher Type', 'Particulars (Account Heads)', 'Narration', 'Debit (₹)', 'Credit (₹)', 'Created By'];
  const headerRow = ws.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Data Rows
  let alt = false;
  (data.vouchers || []).forEach((v: any) => {
    // If multi-leg entries present, print each entry row or condensed row
    if (Array.isArray(v.entries) && v.entries.length > 0) {
      v.entries.forEach((en: any, entryIdx: number) => {
        const row = ws.addRow([
          entryIdx === 0 ? v.transactionDate : '',
          entryIdx === 0 ? v.voucherNo : '',
          entryIdx === 0 ? v.voucherType : '',
          `${en.debitAmount > 0 ? 'Dr. ' : '   To '} ${en.accountHead}`,
          entryIdx === 0 ? (v.narration || '') : '',
          en.debitAmount > 0 ? en.debitAmount : '',
          en.creditAmount > 0 ? en.creditAmount : '',
          entryIdx === 0 ? (v.createdBy || '') : ''
        ]);
        row.height = 19;
        row.eachCell((cell, colIdx) => {
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF334155' } };
          if (alt) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
          if (colIdx === 6 || colIdx === 7) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            if (typeof cell.value === 'number') {
              cell.numFmt = '₹ #,##0.00;[Red]-₹ #,##0.00;""';
            }
          }
        });
      });
    } else {
      const row = ws.addRow([
        v.transactionDate,
        v.voucherNo,
        v.voucherType,
        v.primaryAccount,
        v.narration || '',
        v.totalDebit > 0 ? v.totalDebit : '',
        v.totalCredit > 0 ? v.totalCredit : '',
        v.createdBy || ''
      ]);
      row.height = 20;
    }
    alt = !alt;
  });

  // Grand Total Row
  const grandTotalRow = ws.addRow([
    '',
    '',
    '',
    'TOTALS',
    `Total ${data.summary.totalVouchers || 0} Vouchers`,
    data.summary.totalDebits || 0,
    data.summary.totalCredits || 0,
    ''
  ]);
  grandTotalRow.height = 24;
  grandTotalRow.eachCell((cell, colIdx) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }
    };
    if (colIdx === 6 || colIdx === 7) {
      cell.numFmt = '₹ #,##0.00;[Red]-₹ #,##0.00;₹ 0.00';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  ws.getColumn(1).width = 12; // Date
  ws.getColumn(2).width = 18; // Voucher No
  ws.getColumn(3).width = 14; // Type
  ws.getColumn(4).width = 36; // Particulars
  ws.getColumn(5).width = 30; // Narration
  ws.getColumn(6).width = 16; // Debit
  ws.getColumn(7).width = 16; // Credit
  ws.getColumn(8).width = 14; // User

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
