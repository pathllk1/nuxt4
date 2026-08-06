/**
 * gstr1ExportUtils.ts
 * 
 * Export GSTR1 data in multiple formats: JSON, Excel, CSV
 * Supports all 15 GSTR-1 tables
 */

import ExcelJS from 'exceljs';

/**
 * Export GSTR1 data as JSON (all 15 tables)
 */
export function exportGSTR1AsJSON(summary: any, allTables: any) {
  return {
    metadata: {
      report_type: 'GSTR1',
      generated_at: new Date().toISOString(),
      period_start: summary.period_start,
      period_end: summary.period_end,
      firm_gstin: summary.firm_gstin,
      version: '2.0',
      tables_included: 15,
    },
    summary: summary,
    tables: allTables,
  };
}

/**
 * Export GSTR1 data as Excel (multi-sheet workbook with all 15 tables)
 */
export async function exportGSTR1AsExcel(summary: any, allTables: any): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  
  wb.creator = 'GSTR1 System';
  wb.created = new Date();
  wb.modified = new Date();

  createSummarySheet(wb, summary);

  if (allTables?.table_4a_b2b_supplies?.length > 0) {
    createB2BSheet(wb, allTables.table_4a_b2b_supplies);
  }
  if (allTables?.table_4b_b2b_reverse_charge?.length > 0) {
    createB2BReverseChargeSheet(wb, allTables.table_4b_b2b_reverse_charge);
  }
  if (allTables?.table_5_b2cl_supplies?.length > 0) {
    createB2CLSheet(wb, allTables.table_5_b2cl_supplies);
  }
  if (allTables?.table_6_exports?.length > 0) {
    createExportsSheet(wb, allTables.table_6_exports);
  }
  if (allTables?.table_7_b2cs_supplies?.length > 0) {
    createB2CSSheet(wb, allTables.table_7_b2cs_supplies);
  }
  if (allTables?.table_8_nil_rated?.length > 0) {
    createNilRatedSheet(wb, allTables.table_8_nil_rated);
  }
  if (allTables?.table_9_amendments?.length > 0) {
    createAmendmentsSheet(wb, allTables.table_9_amendments);
  }
  if (allTables?.table_11_advances?.length > 0) {
    createAdvancesSheet(wb, allTables.table_11_advances);
  }
  if (allTables?.table_12_hsn_b2b?.length > 0) {
    createHSNB2BSheet(wb, allTables.table_12_hsn_b2b);
  }
  if (allTables?.table_12_hsn_b2c?.length > 0) {
    createHSNB2CSheet(wb, allTables.table_12_hsn_b2c);
  }
  if (allTables?.table_13_document_summary?.length > 0) {
    createDocumentSummarySheet(wb, allTables.table_13_document_summary);
  }
  if (allTables?.validation) {
    createValidationSheet(wb, allTables.validation);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * Export GSTR1 data as CSV (all tables in one file with sections)
 */
export function exportGSTR1AsCSV(summary: any, allTables: any): string {
  let csv = '';

  csv += '=== GSTR1 SUMMARY ===\n';
  csv += `Period Start,${summary.period_start}\n`;
  csv += `Period End,${summary.period_end}\n`;
  csv += `Firm GSTIN,${summary.firm_gstin}\n`;
  csv += `Total Invoices,${summary.total_invoices}\n`;
  csv += `Total Taxable Value,${summary.total_taxable_value}\n`;
  csv += `Total GST,${summary.total_gst}\n\n`;

  if (allTables?.table_4a_b2b_supplies?.length > 0) {
    csv += '=== TABLE 4A: B2B SUPPLIES ===\n';
    csv += 'Invoice No,Invoice Date,Customer GSTIN,State Code,Invoice Value,Taxable Value,CGST,SGST,IGST,Cess,Reverse Charge\n';
    allTables.table_4a_b2b_supplies.forEach((row: any) => {
      csv += `${row.invoice_no},${row.invoice_date},${row.customer_gstin},${row.customer_state_code},${row.invoice_value},${row.taxable_value},${row.cgst},${row.sgst},${row.igst},${row.cess},${row.reverse_charge}\n`;
    });
    csv += '\n';
  }

  if (allTables?.table_5_b2cl_supplies?.length > 0) {
    csv += '=== TABLE 5: B2CL SUPPLIES (Inter-state > ₹1 Lakh) ===\n';
    csv += 'Invoice No,Invoice Date,State Code,Invoice Value,Taxable Value,CGST,SGST,IGST,Cess\n';
    allTables.table_5_b2cl_supplies.forEach((row: any) => {
      csv += `${row.invoice_no},${row.invoice_date},${row.state_code},${row.invoice_value},${row.taxable_value},${row.cgst},${row.sgst},${row.igst},${row.cess}\n`;
    });
    csv += '\n';
  }

  if (allTables?.table_7_b2cs_supplies?.length > 0) {
    csv += '=== TABLE 7: B2CS SUPPLIES (Small B2C) ===\n';
    csv += 'State Code,Rate,Taxable Value,CGST,SGST,IGST,Cess\n';
    allTables.table_7_b2cs_supplies.forEach((row: any) => {
      csv += `${row.state_code},${row.rate},${row.taxable_value},${row.cgst},${row.sgst},${row.igst},${row.cess}\n`;
    });
    csv += '\n';
  }

  if (allTables?.table_12_hsn_b2b?.length > 0) {
    csv += '=== TABLE 12: HSN SUMMARY (B2B) ===\n';
    csv += 'HSN,Description,UQC,Total Quantity,Total Value,Taxable Value,Integrated Tax,Central Tax,State/UT Tax,Cess\n';
    allTables.table_12_hsn_b2b.forEach((row: any) => {
      csv += `${row.hsn},${row.description},${row.uqc},${row.total_quantity},${row.total_value},${row.taxable_value},${row.integrated_tax},${row.central_tax},${row.state_ut_tax},${row.cess}\n`;
    });
    csv += '\n';
  }

  if (allTables?.table_12_hsn_b2c?.length > 0) {
    csv += '=== TABLE 12: HSN SUMMARY (B2C) ===\n';
    csv += 'HSN,Description,UQC,Total Quantity,Total Value,Taxable Value,Integrated Tax,Central Tax,State/UT Tax,Cess\n';
    allTables.table_12_hsn_b2c.forEach((row: any) => {
      csv += `${row.hsn},${row.description},${row.uqc},${row.total_quantity},${row.total_value},${row.taxable_value},${row.integrated_tax},${row.central_tax},${row.state_ut_tax},${row.cess}\n`;
    });
    csv += '\n';
  }

  if (allTables?.table_13_document_summary?.length > 0) {
    csv += '=== TABLE 13: DOCUMENT SUMMARY ===\n';
    csv += 'Nature of Document,Sr No From,Sr No To,Total Number,Cancelled\n';
    allTables.table_13_document_summary.forEach((row: any) => {
      csv += `${row.nature_of_document},${row.sr_no_from},${row.sr_no_to},${row.total_number},${row.cancelled}\n`;
    });
    csv += '\n';
  }

  return csv;
}

// ── Helper Functions ──────────────────────────────────────────────────────

function createSummarySheet(wb: ExcelJS.Workbook, summary: any) {
  const sheet = wb.addWorksheet('Summary');
  sheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];

  const data = [
    { metric: 'Report Type', value: 'GSTR1' },
    { metric: 'Period Start', value: summary.period_start },
    { metric: 'Period End', value: summary.period_end },
    { metric: 'Firm GSTIN', value: summary.firm_gstin },
    { metric: 'Total Invoices', value: summary.total_invoices },
    { metric: 'B2B Invoices', value: summary.b2b_invoices },
    { metric: 'B2C Invoices', value: summary.b2c_invoices },
    { metric: 'Total Taxable Value', value: summary.total_taxable_value },
    { metric: 'Total CGST', value: summary.total_cgst },
    { metric: 'Total SGST', value: summary.total_sgst },
    { metric: 'Total IGST', value: summary.total_igst },
    { metric: 'Total GST', value: summary.total_gst },
    { metric: 'Total Invoice Value', value: summary.total_invoice_value },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
}

function createB2BSheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('4A - B2B Supplies');
  sheet.columns = [
    { header: 'Invoice No', key: 'invoice_no', width: 15 },
    { header: 'Invoice Date', key: 'invoice_date', width: 12 },
    { header: 'Customer GSTIN', key: 'customer_gstin', width: 18 },
    { header: 'State Code', key: 'customer_state_code', width: 12 },
    { header: 'Invoice Value', key: 'invoice_value', width: 15 },
    { header: 'Taxable Value', key: 'taxable_value', width: 15 },
    { header: 'CGST', key: 'cgst', width: 12 },
    { header: 'SGST', key: 'sgst', width: 12 },
    { header: 'IGST', key: 'igst', width: 12 },
    { header: 'Cess', key: 'cess', width: 12 },
    { header: 'Reverse Charge', key: 'reverse_charge', width: 15 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
  formatCurrencyColumns(sheet, ['invoice_value', 'taxable_value', 'cgst', 'sgst', 'igst', 'cess']);
}

function createB2BReverseChargeSheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('4B - B2B Reverse Charge');
  sheet.columns = [
    { header: 'Invoice No', key: 'invoice_no', width: 15 },
    { header: 'Invoice Date', key: 'invoice_date', width: 12 },
    { header: 'Customer GSTIN', key: 'customer_gstin', width: 18 },
    { header: 'State Code', key: 'customer_state_code', width: 12 },
    { header: 'Place of Supply', key: 'place_of_supply', width: 15 },
    { header: 'Invoice Value', key: 'invoice_value', width: 15 },
    { header: 'Taxable Value', key: 'taxable_value', width: 15 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
  formatCurrencyColumns(sheet, ['invoice_value', 'taxable_value']);
}

function createB2CLSheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('5 - B2CL Supplies');
  sheet.columns = [
    { header: 'Invoice No', key: 'invoice_no', width: 15 },
    { header: 'Invoice Date', key: 'invoice_date', width: 12 },
    { header: 'State Code', key: 'state_code', width: 12 },
    { header: 'Invoice Value', key: 'invoice_value', width: 15 },
    { header: 'Taxable Value', key: 'taxable_value', width: 15 },
    { header: 'CGST', key: 'cgst', width: 12 },
    { header: 'SGST', key: 'sgst', width: 12 },
    { header: 'IGST', key: 'igst', width: 12 },
    { header: 'Cess', key: 'cess', width: 12 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
  formatCurrencyColumns(sheet, ['invoice_value', 'taxable_value', 'cgst', 'sgst', 'igst', 'cess']);
}

function createExportsSheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('6 - Exports');
  sheet.columns = [
    { header: 'Export Type', key: 'export_type', width: 20 },
    { header: 'Invoice No', key: 'invoice_no', width: 15 },
    { header: 'Invoice Date', key: 'invoice_date', width: 12 },
    { header: 'Invoice Value', key: 'invoice_value', width: 15 },
    { header: 'Taxable Value', key: 'taxable_value', width: 15 },
    { header: 'IGST', key: 'igst', width: 12 },
    { header: 'Cess', key: 'cess', width: 12 },
    { header: 'Port Code', key: 'port_code', width: 12 },
    { header: 'Shipping Bill No', key: 'shipping_bill_no', width: 15 },
    { header: 'Shipping Bill Date', key: 'shipping_bill_date', width: 15 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
  formatCurrencyColumns(sheet, ['invoice_value', 'taxable_value', 'igst', 'cess']);
}

function createB2CSSheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('7 - B2CS Supplies');
  sheet.columns = [
    { header: 'State Code', key: 'state_code', width: 12 },
    { header: 'Rate (%)', key: 'rate', width: 10 },
    { header: 'Taxable Value', key: 'taxable_value', width: 15 },
    { header: 'CGST', key: 'cgst', width: 12 },
    { header: 'SGST', key: 'sgst', width: 12 },
    { header: 'IGST', key: 'igst', width: 12 },
    { header: 'Cess', key: 'cess', width: 12 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
  formatCurrencyColumns(sheet, ['taxable_value', 'cgst', 'sgst', 'igst', 'cess']);
}

function createNilRatedSheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('8 - Nil Rated');
  sheet.columns = [
    { header: 'Description', key: 'description', width: 30 },
    { header: 'Inter-State', key: 'inter_state', width: 15 },
    { header: 'Intra-State', key: 'intra_state', width: 15 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
  formatCurrencyColumns(sheet, ['inter_state', 'intra_state']);
}

function createAmendmentsSheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('9 - Amendments');
  sheet.columns = [
    { header: 'Amendment Type', key: 'amendment_type', width: 15 },
    { header: 'Original Invoice No', key: 'original_invoice_no', width: 15 },
    { header: 'Original Date', key: 'original_invoice_date', width: 12 },
    { header: 'Amendment Invoice No', key: 'amendment_invoice_no', width: 15 },
    { header: 'Amendment Date', key: 'amendment_invoice_date', width: 12 },
    { header: 'Customer GSTIN', key: 'customer_gstin', width: 18 },
    { header: 'State Code', key: 'customer_state_code', width: 12 },
    { header: 'Invoice Value', key: 'invoice_value', width: 15 },
    { header: 'Taxable Value', key: 'taxable_value', width: 15 },
    { header: 'CGST', key: 'cgst', width: 12 },
    { header: 'SGST', key: 'sgst', width: 12 },
    { header: 'IGST', key: 'igst', width: 12 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
  formatCurrencyColumns(sheet, ['invoice_value', 'taxable_value', 'cgst', 'sgst', 'igst']);
}

function createAdvancesSheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('11 - Advances');
  sheet.columns = [
    { header: 'Place of Supply', key: 'place_of_supply', width: 15 },
    { header: 'Rate (%)', key: 'rate', width: 10 },
    { header: 'Gross Advance Received', key: 'gross_advance_received', width: 20 },
    { header: 'CGST', key: 'cgst', width: 12 },
    { header: 'SGST', key: 'sgst', width: 12 },
    { header: 'IGST', key: 'igst', width: 12 },
    { header: 'Cess', key: 'cess', width: 12 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
  formatCurrencyColumns(sheet, ['gross_advance_received', 'cgst', 'sgst', 'igst', 'cess']);
}

function createHSNB2BSheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('12 - HSN Summary (B2B)');
  sheet.columns = [
    { header: 'HSN', key: 'hsn', width: 12 },
    { header: 'Description', key: 'description', width: 30 },
    { header: 'UQC', key: 'uqc', width: 10 },
    { header: 'Total Quantity', key: 'total_quantity', width: 15 },
    { header: 'Total Value', key: 'total_value', width: 15 },
    { header: 'Taxable Value', key: 'taxable_value', width: 15 },
    { header: 'Integrated Tax', key: 'integrated_tax', width: 15 },
    { header: 'Central Tax', key: 'central_tax', width: 15 },
    { header: 'State/UT Tax', key: 'state_ut_tax', width: 15 },
    { header: 'Cess', key: 'cess', width: 12 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
  formatCurrencyColumns(sheet, ['total_value', 'taxable_value', 'integrated_tax', 'central_tax', 'state_ut_tax', 'cess']);
}

function createHSNB2CSheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('12 - HSN Summary (B2C)');
  sheet.columns = [
    { header: 'HSN', key: 'hsn', width: 12 },
    { header: 'Description', key: 'description', width: 30 },
    { header: 'UQC', key: 'uqc', width: 10 },
    { header: 'Total Quantity', key: 'total_quantity', width: 15 },
    { header: 'Total Value', key: 'total_value', width: 15 },
    { header: 'Taxable Value', key: 'taxable_value', width: 15 },
    { header: 'Integrated Tax', key: 'integrated_tax', width: 15 },
    { header: 'Central Tax', key: 'central_tax', width: 15 },
    { header: 'State/UT Tax', key: 'state_ut_tax', width: 15 },
    { header: 'Cess', key: 'cess', width: 12 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
  formatCurrencyColumns(sheet, ['total_value', 'taxable_value', 'integrated_tax', 'central_tax', 'state_ut_tax', 'cess']);
}

function createDocumentSummarySheet(wb: ExcelJS.Workbook, data: any[]) {
  const sheet = wb.addWorksheet('13 - Document Summary');
  sheet.columns = [
    { header: 'Nature of Document', key: 'nature_of_document', width: 30 },
    { header: 'Sr No From', key: 'sr_no_from', width: 15 },
    { header: 'Sr No To', key: 'sr_no_to', width: 15 },
    { header: 'Total Number', key: 'total_number', width: 15 },
    { header: 'Cancelled', key: 'cancelled', width: 12 },
  ];

  sheet.addRows(data);
  styleHeaderRow(sheet);
}

function createValidationSheet(wb: ExcelJS.Workbook, validation: any) {
  const sheet = wb.addWorksheet('Validation Report');
  sheet.columns = [
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Message', key: 'message', width: 80 },
  ];

  const rows: any[] = [];
  rows.push({ type: 'STATUS', message: validation.valid ? 'VALID' : 'INVALID' });
  rows.push({ type: 'Total Bills', message: validation.total_bills || 0 });
  rows.push({ type: 'Total Items', message: validation.total_items || 0 });
  rows.push({ type: '', message: '' });

  if (validation.errors?.length > 0) {
    rows.push({ type: 'ERRORS', message: `Found ${validation.errors.length} error(s)` });
    validation.errors.forEach((err: string) => {
      rows.push({ type: 'ERROR', message: err });
    });
    rows.push({ type: '', message: '' });
  }

  if (validation.warnings?.length > 0) {
    rows.push({ type: 'WARNINGS', message: `Found ${validation.warnings.length} warning(s)` });
    validation.warnings.forEach((warn: string) => {
      rows.push({ type: 'WARNING', message: warn });
    });
  }

  sheet.addRows(rows);
  styleHeaderRow(sheet);
}

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 20;
}

function formatCurrencyColumns(sheet: ExcelJS.Worksheet, columnKeys: string[]) {
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    columnKeys.forEach(key => {
      const cell = row.getCell(key);
      if (cell.value !== null && cell.value !== undefined) {
        cell.numFmt = '₹#,##0.00';
      }
    });
  });
}
