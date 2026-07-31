import { defineEventHandler, createError, getHeader, setResponseHeader } from 'h3';
import MasterRoll from '../../../models/MasterRoll';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';

/**
 * Export Data Quality Report endpoint
 * GET /api/master-rolls/export/quality-report
 * Generates an audit report showing missing data and validation failures
 */
export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    // Find all active employees (no exit date or empty exit date)
    const employees = await MasterRoll.find({ 
      firm_id: new mongoose.Types.ObjectId(firmId as string), 
      status: 'Active',
      $or: [
        { date_of_exit: null }, 
        { date_of_exit: '' }, 
        { date_of_exit: { $exists: false } }
      ]
    }).lean();

    if (!employees.length) {
      throw createError({ statusCode: 404, statusMessage: 'No active employees found' });
    }

    const wb = new ExcelJS.Workbook();
    
    // --- Sheet 1: Missing Data ---
    const wsMissing = wb.addWorksheet('Missing Data Audit');
    wsMissing.columns = [
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Project', key: 'project', width: 15 },
      { header: 'Site', key: 'site', width: 15 },
      { header: 'Missing Attributes', key: 'missing', width: 40 },
      { header: 'Severity', key: 'severity', width: 10 },
    ];
    
    // --- Sheet 2: Validation Failures ---
    const wsInvalid = wb.addWorksheet('Validation Failures');
    wsInvalid.columns = [
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Project', key: 'project', width: 15 },
      { header: 'Site', key: 'site', width: 15 },
      { header: 'Target Field', key: 'field', width: 15 },
      { header: 'Detected Value', key: 'value', width: 20 },
      { header: 'Validation Logic', key: 'issue', width: 30 },
    ];

    wsMissing.getRow(1).font = { bold: true };
    wsInvalid.getRow(1).font = { bold: true };

    const AUDIT_FIELDS = [
      { key: 'phone_no', label: 'Phone' },
      { key: 'pan', label: 'PAN' },
      { key: 'aadhar', label: 'Aadhar' },
      { key: 'uan', label: 'UAN' },
      { key: 'project', label: 'Project' },
      { key: 'site', label: 'Site' }
    ];

    const isFieldValMissing = (key: string, value: any): boolean => {
      if (value === undefined || value === null) return true;
      const str = String(value).trim();
      if (str === '') return true;

      const lower = str.toLowerCase();
      if (lower === 'n/a' || lower === 'none' || lower === 'null' || lower === 'undefined') return true;

      if (key === 'phone_no') {
        if (str === '0' || /^0+$/.test(str)) return true;
        if (/^(\d)\1{9}$/.test(str)) return true;
        if ('0123456789876543210'.includes(str)) return true;
      }

      if (key === 'aadhar') {
        if (str === '0' || /^0+$/.test(str)) return true;
        if (/^(\d)\1{11}$/.test(str)) return true;
      }

      if (key === 'uan') {
        if (str === '0' || /^0+$/.test(str)) return true;
      }

      return false;
    };

    employees.forEach(emp => {
      const name = emp.employee_name || 'Unnamed';
      const project = emp.project || 'N/A';
      const site = emp.site || 'N/A';

      // 1. Missing Data
      const missing = AUDIT_FIELDS.filter(f => isFieldValMissing(f.key, (emp as any)[f.key]));
      if (missing.length > 0) {
        wsMissing.addRow({
          name: name,
          project: project,
          site: site,
          missing: missing.map(m => m.label).join(', '),
          severity: missing.length
        });
      }

      // 2. Validation Failures
      // Phone
      if ((emp as any).phone_no && !isFieldValMissing('phone_no', (emp as any).phone_no)) {
        const val = String((emp as any).phone_no).trim();
        if (!/^\d{10}$/.test(val)) {
          wsInvalid.addRow({ 
            name, 
            project, 
            site, 
            field: 'Phone', 
            value: val, 
            issue: 'Must be 10 digits' 
          });
        } else {
          const allSame = /^(\d)\1{9}$/.test(val);
          const sequential = '0123456789876543210'.includes(val);
          if (allSame || sequential) {
            wsInvalid.addRow({ 
              name, 
              project, 
              site, 
              field: 'Phone', 
              value: val, 
              issue: 'FAKE/PATTERN DETECTED' 
            });
          }
        }
      }

      // Aadhar
      if ((emp as any).aadhar && !isFieldValMissing('aadhar', (emp as any).aadhar)) {
        const val = String((emp as any).aadhar).trim();
        if (!/^\d{12}$/.test(val)) {
          wsInvalid.addRow({ 
            name, 
            project, 
            site, 
            field: 'Aadhar', 
            value: val, 
            issue: 'Must be 12 digits' 
          });
        } else if (/^(\d)\1{11}$/.test(val)) {
          wsInvalid.addRow({ 
            name, 
            project, 
            site, 
            field: 'Aadhar', 
            value: val, 
            issue: 'FAKE PATTERN' 
          });
        }
      }

      // PAN
      if ((emp as any).pan && !isFieldValMissing('pan', (emp as any).pan)) {
        const val = String((emp as any).pan).trim().toUpperCase();
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) {
          wsInvalid.addRow({ 
            name, 
            project, 
            site, 
            field: 'PAN', 
            value: val, 
            issue: 'Invalid Format (ABCDE1234F)' 
          });
        }
      }
    });

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `ActiveForce_AuditReport_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
    
    return buffer;
  } catch (error: any) {
    console.error('Export Quality Report error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting quality report'
    });
  }
});
