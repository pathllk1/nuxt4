import { defineEventHandler, createError, readBody, setHeader } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import { getSql } from '~~/server/utils/pg.config';
import ExcelJS from 'exceljs';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  try {
    const { table, query, format = 'json' } = await readBody(event);

    if (!table && !query) {
      throw createError({ statusCode: 400, statusMessage: 'Table name or query is required' });
    }

    const sql = getSql();
    if (!sql) {
      throw createError({ statusCode: 503, statusMessage: 'PostgreSQL connection not ready' });
    }

    let rows: any[] = [];
    if (table) {
      if (!/^[a-zA-Z0-9_-]+$/.test(table)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid table name' });
      }
      rows = await sql.unsafe(`SELECT * FROM "${table}"`);
    } else {
      rows = await sql.unsafe(query);
    }

    if (format === 'json') {
      setHeader(event, 'Content-Type', 'application/json');
      setHeader(event, 'Content-Disposition', `attachment; filename=pg_export_${Date.now()}.json`);
      return JSON.stringify(rows, null, 2);
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('PG Export');
      
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]!).map(key => ({ header: key, key }));
        worksheet.columns = columns;
        worksheet.addRows(rows);
      }
      
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
      setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      setHeader(event, 'Content-Disposition', `attachment; filename=pg_export_${Date.now()}.xlsx`);
      return buffer;
    } else {
      throw createError({ statusCode: 400, statusMessage: `Unsupported format: ${format}` });
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Export failed'
    });
  }
});
