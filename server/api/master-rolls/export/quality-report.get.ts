import { defineEventHandler, createError, setResponseHeader } from 'h3';
import MasterRoll from '../../../models/MasterRoll';
import ExcelJS from 'exceljs';
import { requireAuthSession } from '../../../utils/auth';
import { runMasterRollAudit } from '../../../utils/masterRollAudit';

/**
 * Export Comprehensive Data Quality Report endpoint
 * GET /api/master-rolls/export/quality-report
 * Generates a 5-sheet audit workbook covering Missing Data, Format Failures, Compliance, and Duplicates.
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);

    // Find all active employees (no exit date or empty exit date)
    const employees = await MasterRoll.find({ 
      firm_id: user.firm_id, 
      status: 'Active',
      $or: [
        { date_of_exit: null }, 
        { date_of_exit: '' }, 
        { date_of_exit: { $exists: false } }
      ]
    }).lean();

    if (!employees.length) {
      throw createError({ statusCode: 404, statusMessage: 'No active employees found to audit' });
    }

    const audit = runMasterRollAudit(employees);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Enterprise Master Roll Audit Engine';
    wb.created = new Date();

    // ── SHEET 1: EXECUTIVE AUDIT SUMMARY ──────────────────────────
    const wsSummary = wb.addWorksheet('Audit Executive Summary');
    wsSummary.columns = [
      { header: 'Metric Category', key: 'metric', width: 35 },
      { header: 'Score / Value', key: 'value', width: 25 },
      { header: 'Notes & Compliance Impact', key: 'notes', width: 50 },
    ];
    wsSummary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsSummary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    wsSummary.addRows([
      { metric: 'Total Active Headcount', value: audit.totalActive, notes: 'Active employee records audited' },
      { metric: 'Overall Health Score', value: `${audit.healthScore}%`, notes: 'Percentage of 100% error-free records' },
      { metric: '100% Compliant Records', value: audit.perfectRecordsCount, notes: 'Zero audit warnings or failures' },
      { metric: 'Records Requiring Remediation', value: audit.summary.affectedEmployeesCount, notes: 'Employees with one or more compliance flags' },
      { metric: 'Total Critical Severity Issues', value: audit.summary.criticalCount, notes: 'Immediate statutory/banking disbursement blockers' },
      { metric: 'Total Warning Severity Issues', value: audit.summary.warningCount, notes: 'Recommended KYC/contact updates' },
      { metric: 'Missing Data Anomalies', value: audit.missingData.length, notes: 'Incomplete employee profiles' },
      { metric: 'Format & Pattern Failures', value: audit.formatFailures.length, notes: 'Invalid Phone/Aadhaar/IFSC/PAN formats' },
      { metric: 'Statutory & Chronology Flags', value: audit.complianceIssues.length, notes: 'Age < 18, zero wage, or date sequence errors' },
      { metric: 'Duplicate Credential Clashes', value: audit.duplicates.length, notes: 'Colliding Aadhaar, Bank A/C or Phone records' },
    ]);

    // ── SHEET 2: MISSING DATA AUDIT ────────────────────────────────
    const wsMissing = wb.addWorksheet('Missing Data Audit');
    wsMissing.columns = [
      { header: 'Employee Name', key: 'name', width: 28 },
      { header: 'Project', key: 'project', width: 18 },
      { header: 'Site', key: 'site', width: 18 },
      { header: 'Missing Attributes', key: 'missing', width: 45 },
      { header: 'Critical Count', key: 'critical', width: 15 },
      { header: 'Warning Count', key: 'warning', width: 15 },
    ];
    wsMissing.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsMissing.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } };

    audit.missingData.forEach(item => {
      wsMissing.addRow({
        name: item.employee.employee_name || 'Unnamed',
        project: item.employee.project || 'N/A',
        site: item.employee.site || 'N/A',
        missing: item.missingFields.map(f => f.label).join(', '),
        critical: item.criticalCount,
        warning: item.warningCount
      });
    });

    // ── SHEET 3: FORMAT FAILURES ───────────────────────────────────
    const wsInvalid = wb.addWorksheet('Format Failures');
    wsInvalid.columns = [
      { header: 'Employee Name', key: 'name', width: 28 },
      { header: 'Project', key: 'project', width: 18 },
      { header: 'Site', key: 'site', width: 18 },
      { header: 'Target Field', key: 'field', width: 18 },
      { header: 'Detected Value', key: 'value', width: 22 },
      { header: 'Validation Rule Violated', key: 'issue', width: 35 },
      { header: 'Severity', key: 'severity', width: 12 },
    ];
    wsInvalid.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsInvalid.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE123C' } };

    audit.formatFailures.forEach(item => {
      wsInvalid.addRow({
        name: item.employee.employee_name || 'Unnamed',
        project: item.employee.project || 'N/A',
        site: item.employee.site || 'N/A',
        field: item.targetField,
        value: item.value,
        issue: item.issue,
        severity: item.severity
      });
    });

    // ── SHEET 4: STATUTORY & CHRONOLOGY ────────────────────────────
    const wsCompliance = wb.addWorksheet('Statutory & Chronology');
    wsCompliance.columns = [
      { header: 'Employee Name', key: 'name', width: 28 },
      { header: 'Project', key: 'project', width: 18 },
      { header: 'Site', key: 'site', width: 18 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Compliance Issue', key: 'issue', width: 35 },
      { header: 'Audit Detail', key: 'detail', width: 45 },
      { header: 'Severity', key: 'severity', width: 12 },
    ];
    wsCompliance.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsCompliance.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };

    audit.complianceIssues.forEach(item => {
      wsCompliance.addRow({
        name: item.employee.employee_name || 'Unnamed',
        project: item.employee.project || 'N/A',
        site: item.employee.site || 'N/A',
        category: item.category,
        issue: item.issue,
        detail: item.detail,
        severity: item.severity
      });
    });

    // ── SHEET 5: DUPLICATE RECORD SCAN ─────────────────────────────
    const wsDuplicates = wb.addWorksheet('Duplicate Scan');
    wsDuplicates.columns = [
      { header: 'Credential Field', key: 'field', width: 18 },
      { header: 'Clashing Value', key: 'value', width: 25 },
      { header: 'Colliding Headcount', key: 'count', width: 20 },
      { header: 'Involved Employees', key: 'employees', width: 50 },
    ];
    wsDuplicates.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsDuplicates.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B21A8' } };

    audit.duplicates.forEach(group => {
      const empNames = group.employees.map(e => `${e.employee_name} (${e.project || 'No Project'})`).join('; ');
      wsDuplicates.addRow({
        field: group.field,
        value: group.value,
        count: `${group.count} Employees`,
        employees: empNames
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `MasterRoll_DataQualityAudit_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    setResponseHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
    
    return buffer;
  } catch (error: any) {
    console.error('Export Quality Report error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting quality audit report'
    });
  }
});
