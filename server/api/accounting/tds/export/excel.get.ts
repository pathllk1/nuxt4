import { defineEventHandler, getQuery, createError, setHeader } from 'h3';
import ExcelJS from 'exceljs';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { TdsManagerService } from '../../../../utils/accounting/tds-manager.service';

/**
 * Converts a 1-based column index to an Excel column letter (e.g. 1 -> 'A', 27 -> 'AA').
 */
function getColLetter(colIndex: number): string {
  let temp;
  let letter = '';
  let col = colIndex;
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = Math.floor((col - temp - 1) / 26);
  }
  return letter;
}

/**
 * Standard Indian TDS Section descriptions under Chapter XVII-B.
 */
const SECTION_NATURE_MAP: Record<string, string> = {
  '194C': 'Payments to Contractors & Sub-contractors',
  '194J': 'Fees for Professional or Technical Services',
  '194I': 'Rent for Land, Building or Plant & Machinery',
  '194H': 'Commission or Brokerage',
  '194A': 'Interest other than on Securities',
  '194Q': 'Payment for Purchase of Goods',
  '192': 'Salaries under Sec 192',
  '195': 'Other sums payable to Non-Residents',
  '194DA': 'Payment in respect of Life Insurance Policy',
  '194E': 'Payments to Non-resident Sportsmen / Sports Association',
};

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    if (!user || !user.firm_id) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const query = getQuery(event);
    const financialYear = query.financialYear ? String(query.financialYear).trim() : undefined;
    const quarter = query.quarter ? (String(query.quarter).trim().toUpperCase() as any) : 'ALL';
    const section = query.section ? String(query.section).trim() : 'ALL';
    const fromDate = query.fromDate ? String(query.fromDate).trim() : undefined;
    const toDate = query.toDate ? String(query.toDate).trim() : undefined;
    const search = query.search ? String(query.search).trim() : undefined;

    const [registerData, firm] = await Promise.all([
      TdsManagerService.getTdsRegister({
        firmId: String(user.firm_id),
        financialYear,
        quarter,
        section,
        fromDate,
        toDate,
        search
      }),
      Firm.findById(user.firm_id).lean()
    ]);

    const firmName = (firm as any)?.name || 'Company ERP';
    const firmPan = (firm as any)?.pan || '';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nuxt 4 ERP - Enterprise Statutory TDS Manager';
    workbook.created = new Date();

    const navyDark = { argb: 'FF0F172A' };      // Slate-900 (Main Title)
    const slateHeader = { argb: 'FF1E293B' };   // Slate-800 (Table Headers)
    const slateSub = { argb: 'FF334155' };      // Slate-700 (Group Headers)
    const lightZebra = { argb: 'FFF8FAFC' };    // Slate-50 (Subtle alternating row)
    const totalRowBg = { argb: 'FFF1F5F9' };    // Slate-100 (Grand Total rows)
    const invalidPanBg = { argb: 'FFFEF2F2' };  // Red-50 (PAN Alert)
    const invalidPanText = { argb: 'FF991B1B' };// Red-800
    const borderSlate = { argb: 'FFE2E8F0' };   // Slate-200 (Clean Gridlines)

    // ── Executive Financial Gradients ──
    const bannerGradient: ExcelJS.FillGradientAngle = {
      type: 'gradient',
      gradient: 'angle',
      degree: 90, // Left-to-right linear transition
      stops: [
        { position: 0, color: { argb: 'FF0F172A' } }, // Slate-900 (Deep Onyx)
        { position: 1, color: { argb: 'FF1E3A8A' } }  // Blue-900 (Midnight Navy)
      ]
    };

    const subBannerGradient: ExcelJS.FillGradientAngle = {
      type: 'gradient',
      gradient: 'angle',
      degree: 90,
      stops: [
        { position: 0, color: { argb: 'FF1E293B' } }, // Slate-800
        { position: 1, color: { argb: 'FF334155' } }  // Slate-700
      ]
    };

    const tableHeaderGradient: ExcelJS.FillGradientAngle = {
      type: 'gradient',
      gradient: 'angle',
      degree: 90,
      stops: [
        { position: 0, color: { argb: 'FF1E293B' } }, // Slate-800
        { position: 1, color: { argb: 'FF0F172A' } }  // Slate-900
      ]
    };

    const monthHeaderGradient: ExcelJS.FillGradientAngle = {
      type: 'gradient',
      gradient: 'angle',
      degree: 90,
      stops: [
        { position: 0, color: { argb: 'FF334155' } }, // Slate-700
        { position: 1, color: { argb: 'FF1E293B' } }  // Slate-800
      ]
    };

    const cumulativeTotalGradient: ExcelJS.FillGradientAngle = {
      type: 'gradient',
      gradient: 'angle',
      degree: 90,
      stops: [
        { position: 0, color: { argb: 'FF1E1B4B' } }, // Deep Indigo-950
        { position: 1, color: { argb: 'FF0F172A' } }  // Slate-900
      ]
    };

    const totalRowGradient: ExcelJS.FillGradientAngle = {
      type: 'gradient',
      gradient: 'angle',
      degree: 90,
      stops: [
        { position: 0, color: { argb: 'FFF1F5F9' } }, // Slate-100
        { position: 1, color: { argb: 'FFE2E8F0' } }  // Slate-200
      ]
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 1: FORM 26Q DEDUCTEE SCHEDULE (GRANULAR STATUTORY REGISTER)
    // ─────────────────────────────────────────────────────────────────────────
    const annexureSheet = workbook.addWorksheet('Form 26Q Deductee Annexure', {
      views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
      pageSetup: { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
    });

    // Report Header Titles
    annexureSheet.mergeCells('A1:O1');
    const titleCell = annexureSheet.getCell('A1');
    titleCell.value = `${firmName.toUpperCase()} — STATUTORY TDS DEDUCTEE REGISTER (FORM 26Q)`;
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= 15; c++) {
      annexureSheet.getRow(1).getCell(c).fill = bannerGradient;
    }
    annexureSheet.getRow(1).height = 28;

    annexureSheet.mergeCells('A2:O2');
    const subCell = annexureSheet.getCell('A2');
    subCell.value = `Financial Year: ${registerData.financialYear} | Quarter: ${registerData.quarter} | Period: ${registerData.fromDate} to ${registerData.toDate} | Firm PAN: ${firmPan || 'N/A'}`;
    subCell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FFE2E8F0' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= 15; c++) {
      annexureSheet.getRow(2).getCell(c).fill = subBannerGradient;
    }
    annexureSheet.getRow(2).height = 20;

    annexureSheet.addRow([]); // Row 3 spacer

    const headers = [
      'S.No',
      'Date',
      'Voucher No',
      'Deductee / Payee Legal Name',
      'Code',
      'PAN Card No',
      'PAN Status',
      'Section',
      'Gross Amount (₹)',
      'TDS Rate',
      'TDS Deducted (₹)',
      'Net Paid (₹)',
      'Paid From Bank',
      'Gross-Up (195A)',
      'Narration'
    ];

    const headerRow = annexureSheet.addRow(headers);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = tableHeaderGradient;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: navyDark },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    const startDataRow = 5;
    registerData.items.forEach((item, idx) => {
      const deducteeCode = item.panEntityType === 'COMPANY' ? '01' : '02';
      const panStatus = item.isPanValid ? 'VALID' : 'MISSING (Sec 206AA)';

      const row = annexureSheet.addRow([
        idx + 1,
        item.transactionDate,
        item.voucherNo,
        item.payeeName,
        deducteeCode,
        item.panNumber || 'PAN NOT PROVIDED',
        panStatus,
        item.section,
        item.grossAmount,
        item.tdsRate / 100,
        item.tdsAmount,
        item.netAmount,
        item.bankAccountName || '-',
        item.isGrossUp ? 'YES' : 'NO',
        item.narration || ''
      ]);

      row.height = 20;

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell(9).numFmt = '₹#,##0.00';
      row.getCell(10).numFmt = '0.00%';
      row.getCell(11).numFmt = '₹#,##0.00';
      row.getCell(12).numFmt = '₹#,##0.00';

      row.getCell(13).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(15).alignment = { horizontal: 'left', vertical: 'middle' };

      if (!item.isPanValid) {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: invalidPanBg };
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: invalidPanBg };
        row.getCell(7).font = { color: invalidPanText, bold: true, size: 9 };
      }

      if (idx % 2 === 1 && item.isPanValid) {
        for (let c = 1; c <= 15; c++) {
          if (!row.getCell(c).fill) {
            row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: lightZebra };
          }
        }
      }

      for (let c = 1; c <= 15; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: borderSlate },
          bottom: { style: 'thin', color: borderSlate },
          left: { style: 'thin', color: borderSlate },
          right: { style: 'thin', color: borderSlate }
        };
      }
    });

    const endDataRow = startDataRow + registerData.items.length - 1;
    const totalRowIndex = endDataRow + 1;

    // Total Row with Dynamic Excel Formulas
    const totalRow = annexureSheet.addRow([
      '',
      '',
      '',
      'TOTAL STATUTORY TDS SUMMARY',
      '',
      '',
      '',
      '',
      registerData.items.length > 0 ? { formula: `SUM(I${startDataRow}:I${endDataRow})`, result: registerData.metrics.totalGross } : 0,
      '',
      registerData.items.length > 0 ? { formula: `SUM(K${startDataRow}:K${endDataRow})`, result: registerData.metrics.totalTds } : 0,
      registerData.items.length > 0 ? { formula: `SUM(L${startDataRow}:L${endDataRow})`, result: registerData.metrics.totalNet } : 0,
      '',
      '',
      ''
    ]);

    totalRow.height = 24;
    totalRow.font = { name: 'Calibri', size: 10, bold: true, color: navyDark };
    totalRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    totalRow.getCell(9).numFmt = '₹#,##0.00';
    totalRow.getCell(11).numFmt = '₹#,##0.00';
    totalRow.getCell(12).numFmt = '₹#,##0.00';

    for (let c = 1; c <= 15; c++) {
      totalRow.getCell(c).fill = totalRowGradient;
      totalRow.getCell(c).border = {
        top: { style: 'thin', color: navyDark },
        bottom: { style: 'double', color: navyDark },
        left: { style: 'thin', color: borderSlate },
        right: { style: 'thin', color: borderSlate }
      };
    }

    annexureSheet.columns = [
      { width: 7 },  // S.No
      { width: 13 }, // Date
      { width: 17 }, // Voucher No
      { width: 30 }, // Payee Name
      { width: 8 },  // Deductee Code
      { width: 16 }, // PAN Card No
      { width: 18 }, // PAN Status
      { width: 10 }, // Section
      { width: 17 }, // Gross Amount
      { width: 11 }, // TDS Rate
      { width: 17 }, // TDS Deducted
      { width: 17 }, // Net Paid
      { width: 22 }, // Paid From Bank
      { width: 14 }, // Gross-Up
      { width: 34 }  // Narration
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 2: PAYEE MONTHLY SUMMARY (PIVOT MATRIX CROSS-TAB WITH FORMULAS)
    // ─────────────────────────────────────────────────────────────────────────
    const pivotSheet = workbook.addWorksheet('Payee Monthly Summary', {
      views: [{ state: 'frozen', xSplit: 4, ySplit: 4, showGridLines: true }],
      pageSetup: { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 }
    });

    // Collect and sort all distinct months (YYYY-MM)
    const monthKeysSet = new Set<string>();
    registerData.items.forEach(it => {
      if (it.transactionDate && it.transactionDate.length >= 7) {
        monthKeysSet.add(it.transactionDate.substring(0, 7));
      }
    });

    // If no transactions, fall back to current period month
    const defaultPeriodMonth: string = (registerData.fromDate && registerData.fromDate.length >= 7)
      ? registerData.fromDate.substring(0, 7)
      : new Date().toISOString().substring(0, 7);

    if (monthKeysSet.size === 0) {
      monthKeysSet.add(defaultPeriodMonth);
    }

    const sortedMonthKeys: string[] = Array.from(monthKeysSet).sort();
    const fallbackMonth: string = sortedMonthKeys[0] || defaultPeriodMonth;
    const monthLabels: string[] = sortedMonthKeys.map(mk => {
      const parts = mk.split('-');
      const year = Number(parts[0] || '2026');
      const month = Number(parts[1] || '1');
      const d = new Date(year, month - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    // Total columns count: 4 static (S.No, Payee, PAN, Sec) + (2 * months) + 3 totals (Total Gross, Total TDS, Net Paid)
    const totalMatrixCols = 4 + (sortedMonthKeys.length * 2) + 3;
    const lastColLetter = getColLetter(totalMatrixCols);

    // Sheet 2 Title & Subtitle
    pivotSheet.mergeCells(`A1:${lastColLetter}1`);
    const pTitle = pivotSheet.getCell('A1');
    pTitle.value = `${firmName.toUpperCase()} — PAYEE MONTHLY TDS SUMMARY (PIVOT MATRIX)`;
    pTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    pTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= totalMatrixCols; c++) {
      pivotSheet.getRow(1).getCell(c).fill = bannerGradient;
    }
    pivotSheet.getRow(1).height = 28;

    pivotSheet.mergeCells(`A2:${lastColLetter}2`);
    const pSub = pivotSheet.getCell('A2');
    pSub.value = `Financial Year: ${registerData.financialYear} | Quarter: ${registerData.quarter} | Period: ${registerData.fromDate} to ${registerData.toDate} | Firm PAN: ${firmPan || 'N/A'}`;
    pSub.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FFE2E8F0' } };
    pSub.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= totalMatrixCols; c++) {
      pivotSheet.getRow(2).getCell(c).fill = subBannerGradient;
    }
    pivotSheet.getRow(2).height = 20;

    // Row 3: Super-headers (Groupings)
    pivotSheet.mergeCells('A3:D3');
    const idHeader = pivotSheet.getCell('A3');
    idHeader.value = 'DEDUCTEE IDENTIFICATION';
    idHeader.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    idHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= 4; c++) {
      pivotSheet.getRow(3).getCell(c).fill = tableHeaderGradient;
    }

    let currentGroupCol = 5;
    sortedMonthKeys.forEach((mk, idx) => {
      const startL = getColLetter(currentGroupCol);
      const endL = getColLetter(currentGroupCol + 1);
      pivotSheet.mergeCells(`${startL}3:${endL}3`);
      const mHeader = pivotSheet.getCell(`${startL}3`);
      const label = monthLabels[idx] ?? mk;
      mHeader.value = label.toUpperCase();
      mHeader.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      mHeader.alignment = { horizontal: 'center', vertical: 'middle' };
      pivotSheet.getRow(3).getCell(currentGroupCol).fill = monthHeaderGradient;
      pivotSheet.getRow(3).getCell(currentGroupCol + 1).fill = monthHeaderGradient;
      currentGroupCol += 2;
    });

    const totStartL = getColLetter(currentGroupCol);
    const totEndL = getColLetter(currentGroupCol + 2);
    pivotSheet.mergeCells(`${totStartL}3:${totEndL}3`);
    const totHeader = pivotSheet.getCell(`${totStartL}3`);
    totHeader.value = 'CUMULATIVE PERIOD TOTAL';
    totHeader.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    totHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = currentGroupCol; c <= currentGroupCol + 2; c++) {
      pivotSheet.getRow(3).getCell(c).fill = cumulativeTotalGradient;
    }
    pivotSheet.getRow(3).height = 20;

    // Row 4: Column Headers
    const subHeaders: string[] = ['S.No', 'Deductee Legal Name', 'PAN Card No', 'Sec'];
    sortedMonthKeys.forEach(() => {
      subHeaders.push('Gross (₹)', 'TDS (₹)');
    });
    subHeaders.push('Total Gross (₹)', 'Total TDS (₹)', 'Total Net Paid (₹)');

    const pHeaderRow = pivotSheet.addRow(subHeaders);
    pHeaderRow.height = 24;
    pHeaderRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      if (colNumber > totalMatrixCols - 3) {
        cell.fill = cumulativeTotalGradient;
      } else if (colNumber >= 5) {
        cell.fill = monthHeaderGradient;
      } else {
        cell.fill = tableHeaderGradient;
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: navyDark },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    // Group items by Payee + PAN + Section
    interface IPayeeMonthlyBucket {
      payeeName: string;
      panNumber: string;
      isPanValid: boolean;
      section: string;
      monthly: Record<string, { gross: number; tds: number }>;
      totalGross: number;
      totalTds: number;
    }

    const payeeMap = new Map<string, IPayeeMonthlyBucket>();
    registerData.items.forEach(it => {
      const key = `${it.payeeName}___${it.panNumber || 'NO_PAN'}___${it.section}`;
      if (!payeeMap.has(key)) {
        payeeMap.set(key, {
          payeeName: it.payeeName,
          panNumber: it.panNumber || 'PAN NOT PROVIDED',
          isPanValid: it.isPanValid,
          section: it.section,
          monthly: {},
          totalGross: 0,
          totalTds: 0
        });
      }
      const bucket = payeeMap.get(key)!;
      const mKey: string = (it.transactionDate && it.transactionDate.length >= 7 ? it.transactionDate.substring(0, 7) : '') || fallbackMonth;
      if (!bucket.monthly[mKey]) {
        bucket.monthly[mKey] = { gross: 0, tds: 0 };
      }
      const monthData = bucket.monthly[mKey];
      if (monthData) {
        monthData.gross += it.grossAmount;
        monthData.tds += it.tdsAmount;
      }
      bucket.totalGross += it.grossAmount;
      bucket.totalTds += it.tdsAmount;
    });

    const pStartRow = 5;
    const payeeList = Array.from(payeeMap.values()).sort((a, b) => a.payeeName.localeCompare(b.payeeName));

    payeeList.forEach((payee, idx) => {
      const rowValues: any[] = [
        idx + 1,
        payee.payeeName,
        payee.panNumber,
        payee.section
      ];

      const grossColLetters: string[] = [];
      const tdsColLetters: string[] = [];

      sortedMonthKeys.forEach((mk, mIdx) => {
        const grossColIdx = 5 + (mIdx * 2);
        const tdsColIdx = grossColIdx + 1;
        grossColLetters.push(getColLetter(grossColIdx));
        tdsColLetters.push(getColLetter(tdsColIdx));

        const mData = payee.monthly[mk] || { gross: 0, tds: 0 };
        rowValues.push(mData.gross, mData.tds);
      });

      const currentRowNum = pStartRow + idx;
      const totGrossColLetter = getColLetter(totalMatrixCols - 2);
      const totTdsColLetter = getColLetter(totalMatrixCols - 1);

      // Formulas for Payee Totals across months
      const grossFormula = grossColLetters.map(c => `${c}${currentRowNum}`).join('+');
      const tdsFormula = tdsColLetters.map(c => `${c}${currentRowNum}`).join('+');
      const netFormula = `${totGrossColLetter}${currentRowNum}-${totTdsColLetter}${currentRowNum}`;

      rowValues.push(
        { formula: grossFormula, result: payee.totalGross },
        { formula: tdsFormula, result: payee.totalTds },
        { formula: netFormula, result: payee.totalGross - payee.totalTds }
      );

      const pRow = pivotSheet.addRow(rowValues);
      pRow.height = 20;

      pRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      pRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      pRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      pRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

      // Number formats for monthly columns
      for (let c = 5; c <= totalMatrixCols; c++) {
        pRow.getCell(c).numFmt = '₹#,##0.00';
      }

      if (!payee.isPanValid) {
        pRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: invalidPanBg };
        pRow.getCell(3).font = { color: invalidPanText, bold: true, size: 9 };
      }

      if (idx % 2 === 1 && payee.isPanValid) {
        for (let c = 1; c <= totalMatrixCols; c++) {
          if (!pRow.getCell(c).fill) {
            pRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: lightZebra };
          }
        }
      }

      for (let c = 1; c <= totalMatrixCols; c++) {
        pRow.getCell(c).border = {
          top: { style: 'thin', color: borderSlate },
          bottom: { style: 'thin', color: borderSlate },
          left: { style: 'thin', color: borderSlate },
          right: { style: 'thin', color: borderSlate }
        };
      }
    });

    const pEndRow = pStartRow + payeeList.length - 1;
    const pGrandTotalRowNum = pEndRow + 1;

    // Grand Total Row with Excel Formulas summing entire columns
    const grandTotalValues: any[] = [
      '',
      'GRAND TOTAL (ALL PAYEES)',
      '',
      ''
    ];

    for (let c = 5; c <= totalMatrixCols; c++) {
      const colL = getColLetter(c);
      grandTotalValues.push(
        payeeList.length > 0 ? { formula: `SUM(${colL}${pStartRow}:${colL}${pEndRow})` } : 0
      );
    }

    const pGrandTotalRow = pivotSheet.addRow(grandTotalValues);
    pGrandTotalRow.height = 24;
    pGrandTotalRow.font = { name: 'Calibri', size: 10, bold: true, color: navyDark };
    pGrandTotalRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

    for (let c = 5; c <= totalMatrixCols; c++) {
      pGrandTotalRow.getCell(c).numFmt = '₹#,##0.00';
    }

    for (let c = 1; c <= totalMatrixCols; c++) {
      pGrandTotalRow.getCell(c).fill = totalRowGradient;
      pGrandTotalRow.getCell(c).border = {
        top: { style: 'thin', color: navyDark },
        bottom: { style: 'double', color: navyDark },
        left: { style: 'thin', color: borderSlate },
        right: { style: 'thin', color: borderSlate }
      };
    }

    // Set Column Widths for Pivot Sheet
    const pColumns = [
      { width: 7 },  // S.No
      { width: 32 }, // Payee Name
      { width: 17 }, // PAN Card
      { width: 8 },  // Section
    ];
    sortedMonthKeys.forEach(() => {
      pColumns.push({ width: 16 }, { width: 15 });
    });
    pColumns.push({ width: 18 }, { width: 17 }, { width: 18 });
    pivotSheet.columns = pColumns;

    // ─────────────────────────────────────────────────────────────────────────
    // SHEET 3: STATUTORY COMPLIANCE & SECTION BREAKDOWN SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Section & Compliance Summary', {
      views: [{ showGridLines: true }],
      pageSetup: { orientation: 'portrait', fitToWidth: 1, fitToHeight: 0 }
    });

    summarySheet.mergeCells('A1:F1');
    const sTitle = summarySheet.getCell('A1');
    sTitle.value = `${firmName.toUpperCase()} — STATUTORY TDS SECTION & COMPLIANCE SUMMARY`;
    sTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    sTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= 6; c++) {
      summarySheet.getRow(1).getCell(c).fill = bannerGradient;
    }
    summarySheet.getRow(1).height = 28;

    summarySheet.mergeCells('A2:F2');
    const sSub = summarySheet.getCell('A2');
    sSub.value = `Financial Year: ${registerData.financialYear} | Quarter: ${registerData.quarter} | Period: ${registerData.fromDate} to ${registerData.toDate} | Firm PAN: ${firmPan || 'N/A'}`;
    sSub.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FFE2E8F0' } };
    sSub.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= 6; c++) {
      summarySheet.getRow(2).getCell(c).fill = subBannerGradient;
    }
    summarySheet.getRow(2).height = 20;

    summarySheet.addRow([]); // Row 3 spacer

    // ── Table 1: Section Breakdown ──
    const secHeaders = [
      'Section Code',
      'Nature of Payment / Applicable Category',
      'Voucher Count',
      'Total Gross Amount (₹)',
      'TDS Withheld (₹)',
      'Effective Rate'
    ];
    const secHRow = summarySheet.addRow(secHeaders);
    secHRow.height = 24;
    secHRow.eachCell((c) => {
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = tableHeaderGradient;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: navyDark },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    const secStartRow = 5;
    const secEntries = Object.entries(registerData.metrics.sectionBreakdown);
    secEntries.forEach(([sec, data], idx) => {
      const rowNum = secStartRow + idx;
      const natureDesc = SECTION_NATURE_MAP[sec] || 'Other Sums under Chapter XVII-B';
      const sRow = summarySheet.addRow([
        `Sec ${sec}`,
        natureDesc,
        data.count,
        data.gross,
        data.tds,
        data.gross > 0 ? { formula: `E${rowNum}/D${rowNum}`, result: data.tds / data.gross } : 0
      ]);

      sRow.height = 20;
      sRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      sRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      sRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      sRow.getCell(3).numFmt = '#,##0';
      sRow.getCell(4).numFmt = '₹#,##0.00';
      sRow.getCell(5).numFmt = '₹#,##0.00';
      sRow.getCell(6).numFmt = '0.00%';
      sRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

      for (let c = 1; c <= 6; c++) {
        sRow.getCell(c).border = {
          top: { style: 'thin', color: borderSlate },
          bottom: { style: 'thin', color: borderSlate },
          left: { style: 'thin', color: borderSlate },
          right: { style: 'thin', color: borderSlate }
        };
      }
    });

    const secEndRow = secStartRow + secEntries.length - 1;
    const secTotalRow = summarySheet.addRow([
      'TOTAL',
      'ALL STATUTORY SECTIONS',
      secEntries.length > 0 ? { formula: `SUM(C${secStartRow}:C${secEndRow})` } : 0,
      secEntries.length > 0 ? { formula: `SUM(D${secStartRow}:D${secEndRow})`, result: registerData.metrics.totalGross } : 0,
      secEntries.length > 0 ? { formula: `SUM(E${secStartRow}:E${secEndRow})`, result: registerData.metrics.totalTds } : 0,
      secEntries.length > 0 ? { formula: `E${secEndRow + 1}/D${secEndRow + 1}`, result: registerData.metrics.totalGross > 0 ? registerData.metrics.totalTds / registerData.metrics.totalGross : 0 } : 0
    ]);

    secTotalRow.height = 24;
    secTotalRow.font = { name: 'Calibri', size: 10, bold: true, color: navyDark };
    secTotalRow.getCell(3).numFmt = '#,##0';
    secTotalRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    secTotalRow.getCell(4).numFmt = '₹#,##0.00';
    secTotalRow.getCell(5).numFmt = '₹#,##0.00';
    secTotalRow.getCell(6).numFmt = '0.00%';
    secTotalRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

    for (let c = 1; c <= 6; c++) {
      secTotalRow.getCell(c).fill = totalRowGradient;
      secTotalRow.getCell(c).border = {
        top: { style: 'thin', color: navyDark },
        bottom: { style: 'double', color: navyDark },
        left: { style: 'thin', color: borderSlate },
        right: { style: 'thin', color: borderSlate }
      };
    }

    summarySheet.addRow([]); // Spacer
    summarySheet.addRow([]); // Spacer

    // ── Table 2: Statutory Compliance KPIs ──
    const kpiHeaderRow = summarySheet.addRow(['Statutory Compliance Metric', 'Statutory Standard', 'Audited Metric Value']);
    kpiHeaderRow.height = 24;
    kpiHeaderRow.eachCell((c) => {
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = tableHeaderGradient;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: navyDark },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    const kpiData: Array<[string, string, string | number]> = [
      ['Total Gross Turnover / Billings Subject to TDS', 'Form 26Q Schedule Annexure', registerData.metrics.totalGross],
      ['Total Statutory Tax Deducted at Source (TDS)', 'Challan ITNS-281 Reconciled', registerData.metrics.totalTds],
      ['Total Net Disbursed Payouts to Vendors', 'Bank Disbursal Register', registerData.metrics.totalNet],
      ['Total Unique Deductees in Financial Period', 'Vendor Master Register', registerData.metrics.totalDeductees],
      ['Payees with Valid Statutory PAN Cards', 'Sec 139A Compliant', registerData.metrics.validPanCount],
      ['Payees with Missing/Invalid PAN (Higher 20% Withholding)', 'Sec 206AA Compliant', registerData.metrics.missingPanCount],
      ['Deductee PAN Verification Health Score', 'Statutory Benchmark 100%', `${registerData.metrics.panComplianceRate}%`]
    ];

    kpiData.forEach((r, idx) => {
      const row = summarySheet.addRow([r[0], r[1], r[2]]);
      row.height = 20;
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };

      if (typeof r[2] === 'number') {
        row.getCell(3).numFmt = idx < 3 ? '₹#,##0.00' : '#,##0';
      }

      for (let c = 1; c <= 3; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: borderSlate },
          bottom: { style: 'thin', color: borderSlate },
          left: { style: 'thin', color: borderSlate },
          right: { style: 'thin', color: borderSlate }
        };
      }
    });

    summarySheet.columns = [
      { width: 44 },
      { width: 38 },
      { width: 22 },
      { width: 24 },
      { width: 22 },
      { width: 16 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();

    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setHeader(
      event,
      'Content-Disposition',
      `attachment; filename="TDS_Register_Form26Q_${registerData.financialYear}_${registerData.quarter}.xlsx"`
    );

    return buffer;
  } catch (err: any) {
    if (err.statusCode) throw err;
    console.error('Failed to export TDS Excel:', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to generate TDS Excel export'
    });
  }
});
