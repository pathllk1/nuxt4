import { defineEventHandler, createError, setHeader } from 'h3';
import ExcelJS from 'exceljs';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Period ID is required' });

    // 1. Fetch Header strictly scoped to active firm
    const [period] = await sql`
      SELECT 
        p.*,
        l.name as leader_name,
        l.phone as leader_phone
      FROM labor_periods p
      JOIN labor_leaders l ON p.leader_id = l.id
      WHERE p.id = ${id} AND p.firm_id = ${String(session.firm_id)}
    `;

    if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found' });

    // 2. Fetch Data
    const workers = await sql`SELECT * FROM labor_workers WHERE period_id = ${id} ORDER BY created_at ASC`;
    const workerIds = workers.map((w: any) => w.id);
    let attendanceLogs: any[] = [];
    if (workerIds.length > 0) {
      attendanceLogs = await sql`SELECT * FROM labor_attendance WHERE worker_id = ANY(${workerIds})`;
    }
    const expenses = await sql`SELECT * FROM labor_expenses WHERE period_id = ${id} ORDER BY created_at ASC`;
    const advances = await sql`SELECT * FROM labor_advances WHERE period_id = ${id} ORDER BY payment_date ASC`;
    const [settlement] = await sql`SELECT * FROM labor_settlements WHERE period_id = ${id} LIMIT 1`;

    // 3. Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NXT Labor System';

    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    const headerFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // Sheet 1: Overview Summary
    const summarySheet = workbook.addWorksheet('Overview', { views: [{ showGridLines: false }] });
    summarySheet.getColumn('B').width = 25;
    summarySheet.getColumn('C').width = 40;

    summarySheet.mergeCells('B2:C2');
    const titleCell = summarySheet.getCell('B2');
    titleCell.value = 'LABOR PERIOD SUMMARY';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF0F766E' } };
    titleCell.alignment = { horizontal: 'center' };

    const summaryRows = [
      ['', 'Leader Name', period.leader_name],
      ['', 'Date Range', `${new Date(period.start_date).toLocaleDateString()} to ${new Date(period.end_date).toLocaleDateString()}`],
      ['', 'Status', period.status],
      ['', 'Batch ID', period.id],
      ['', '', ''],
      ['', 'FINANCIAL SNAPSHOT', ''],
      ['', 'Total Wages', workers.reduce((sum: number, w: any) => sum + Number(w.total_wages), 0)],
      ['', 'Misc Expenses', expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0)],
      ['', 'Total Advances', advances.reduce((sum: number, a: any) => sum + Number(a.amount), 0)],
      ['', 'Net Payable', settlement ? Number(settlement.net_payable) : (
        workers.reduce((sum: number, w: any) => sum + Number(w.total_wages), 0) +
        expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0) -
        advances.reduce((sum: number, a: any) => sum + Number(a.amount), 0)
      )]
    ];

    summarySheet.addRows(summaryRows);
    summarySheet.getCell('B8').font = { bold: true, size: 12 };
    summarySheet.getCell('C9').numFmt = '\"₹\"#,##0.00';
    summarySheet.getCell('C10').numFmt = '\"₹\"#,##0.00';
    summarySheet.getCell('C11').numFmt = '\"₹\"#,##0.00';
    summarySheet.getCell('C12').numFmt = '\"₹\"#,##0.00';
    summarySheet.getCell('C12').font = { bold: true, color: { argb: 'FF059669' }, size: 14 };

    // Sheet 2: Attendance Grid
    const attSheet = workbook.addWorksheet('Attendance Grid');
    const start = new Date(period.start_date);
    const end = new Date(period.end_date);
    const dateList: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dateList.push(new Date(d));
    }

    const headers = ['Labor Name', 'Daily Wage', ...dateList.map((d) => d.getDate()), 'Total Days', 'Total Wages'];
    const headerRow = attSheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center' };
      cell.border = borderStyle;
    });

    attSheet.getColumn(1).width = 25;
    attSheet.getColumn(2).width = 15;
    attSheet.getColumn(headers.length).width = 20;

    function dayLabel(val: any) {
      const v = parseFloat(val);
      if (isNaN(v) || v === 0) return 'L';
      if (v === 0.5) return '½';
      if (v === 1) return 'P';
      return v.toString();
    }

    workers.forEach((w: any) => {
      const rowData: any[] = [w.labor_name, Number(w.daily_wage)];

      dateList.forEach((d) => {
        const dateStr = d.toISOString().split('T')[0];
        const entry = attendanceLogs.find(
          (a: any) => a.worker_id === w.id && new Date(a.attendance_date).toISOString().split('T')[0] === dateStr
        );
        rowData.push(entry ? dayLabel(entry.day_value) : '-');
      });

      rowData.push(Number(w.total_present_days));
      rowData.push(Number(w.total_wages));

      const row = attSheet.addRow(rowData);
      row.getCell(2).numFmt = '\"₹\"#,##0.00';
      row.getCell(headers.length).numFmt = '\"₹\"#,##0.00';
      row.getCell(headers.length - 1).numFmt = '0.0';

      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        if (colNumber > 2 && colNumber <= 2 + dateList.length) {
          cell.alignment = { horizontal: 'center' };
        }
      });
    });

    // Sheet 3: Expenses
    const expSheet = workbook.addWorksheet('Miscellaneous Expenses');
    expSheet.addRow(['Description', 'Amount', 'Date Recorded']).font = { bold: true };
    expSheet.getColumn(1).width = 35;
    expSheet.getColumn(2).width = 20;
    expSheet.getColumn(3).width = 25;

    expenses.forEach((e: any) => {
      const row = expSheet.addRow([e.description, Number(e.amount), new Date(e.created_at).toLocaleString()]);
      row.getCell(2).numFmt = '\"₹\"#,##0.00';
    });

    // Sheet 4: Advances & Settlement
    const advSheet = workbook.addWorksheet('Advances & Payments');
    advSheet.addRow(['Payment Date', 'Description', 'Amount', 'Type']).font = { bold: true };
    advSheet.getColumn(1).width = 25;
    advSheet.getColumn(2).width = 35;
    advSheet.getColumn(3).width = 20;

    advances.forEach((a: any) => {
      const row = advSheet.addRow([new Date(a.payment_date).toLocaleDateString(), 'Advance Issued', Number(a.amount), 'Advance']);
      row.getCell(3).numFmt = '\"₹\"#,##0.00';
      row.getCell(4).font = { color: { argb: 'FFD97706' }, bold: true };
    });

    if (settlement) {
      const row = advSheet.addRow([new Date(settlement.payment_date).toLocaleDateString(), 'Final Settlement', Number(settlement.paid_amount), 'Settlement']);
      row.getCell(3).numFmt = '\"₹\"#,##0.00';
      row.getCell(4).font = { color: { argb: 'FF059669' }, bold: true };
    }

    const safeName = String(period.leader_name).replace(/\s+/g, '_');
    const filename = `Labor_Report_${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();

    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);

    return buffer;
  } catch (error: any) {
    console.error('Export labor excel error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting labor report'
    });
  }
});
