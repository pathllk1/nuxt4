import { defineEventHandler, createError, readBody, setHeader } from 'h3';
import { requireSuperAdmin } from '../../../utils/admin-guard';
import mongoose from 'mongoose';
import { connectDB } from '../../../utils/db';
import ExcelJS from 'exceljs';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  try {
    const { collection: collectionName, filter = {}, format = 'json' } = await readBody(event);
    if (!collectionName) {
      throw createError({ statusCode: 400, statusMessage: 'Collection name is required' });
    }

    if (!mongoose.connection.db) {
      throw createError({ statusCode: 503, statusMessage: 'MongoDB connection not ready' });
    }

    const collection = mongoose.connection.db.collection(collectionName);
    const docs = await collection.find(filter).toArray();

    if (format === 'json') {
      setHeader(event, 'Content-Type', 'application/json');
      setHeader(event, 'Content-Disposition', `attachment; filename=mongo_export_${collectionName}_${Date.now()}.json`);
      return JSON.stringify(docs, null, 2);
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(collectionName);
      
      if (docs.length > 0) {
        const columns = Object.keys(docs[0]!).map(key => ({ header: key, key }));
        worksheet.columns = columns;
        worksheet.addRows(docs.map((doc: any) => {
          const row: Record<string, any> = {};
          for (const [k, v] of Object.entries(doc)) {
            row[k] = typeof v === 'object' ? JSON.stringify(v) : v;
          }
          return row;
        }));
      }
      
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
      setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      setHeader(event, 'Content-Disposition', `attachment; filename=mongo_export_${collectionName}_${Date.now()}.xlsx`);
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
