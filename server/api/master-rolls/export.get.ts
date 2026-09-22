import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { defineEventHandler, getQuery, setResponseHeader, createError } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import { requireAuthSession } from '../../utils/auth';

/**
 * GET /api/master-rolls/export
 * Exports Master Roll employees to Excel (.xlsx) or CSV format.
 * Supports filtering by selectedIds, status, project, site, category, bank, search.
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    if (!user?.firm_id) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const query = getQuery(event);
    const filter: Record<string, any> = {
      firm_id: new mongoose.Types.ObjectId(user.firm_id)
    };

    // Apply selectedIds if provided
    if (query.selectedIds) {
      const ids = String(query.selectedIds)
        .split(',')
        .map((id) => id.trim())
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (ids.length > 0) {
        filter._id = { $in: ids };
      }
    } else {
      // Standard list filters
      if (query.status) filter.status = query.status;
      if (query.project) filter.project = query.project;
      if (query.site) filter.site = query.site;
      if (query.category) filter.category = query.category;
      if (query.bank) filter.bank = query.bank;

      const dojStart = typeof query.doj_start === 'string' && query.doj_start.trim() ? query.doj_start.trim() : null;
      const dojEnd = typeof query.doj_end === 'string' && query.doj_end.trim() ? query.doj_end.trim() : null;

      if (dojStart || dojEnd) {
        const dojConditions: any[] = [];
        const strCond: Record<string, any> = {};
        if (dojStart) strCond.$gte = dojStart;
        if (dojEnd) strCond.$lte = `${dojEnd}\uffff`;
        dojConditions.push(strCond);

        const dateCond: Record<string, any> = {};
        if (dojStart) dateCond.$gte = new Date(`${dojStart}T00:00:00.000Z`);
        if (dojEnd) dateCond.$lte = new Date(`${dojEnd}T23:59:59.999Z`);
        dojConditions.push(dateCond);

        const dojOr = dojConditions.map((c) => ({ date_of_joining: c }));
        if (filter.$and) {
          filter.$and.push({ $or: dojOr });
        } else {
          filter.$and = [{ $or: dojOr }];
        }
      }

      if (query.search) {
        const escapedSearch = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedSearch, 'i');
        filter.$or = [
          { employee_name: searchRegex },
          { aadhar: searchRegex },
          { phone_no: searchRegex }
        ];
      }
    }

    const sortField = (query.sortBy as string) || 'employee_name';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    const employees = await MasterRoll.find(filter)
      .sort({ [sortField]: sortOrder })
      .lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nuxt Master Roll System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Master Roll');

    // Column definitions matching MasterRoll schema and Import specifications
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Employee Name', key: 'employee_name', width: 26 },
      { header: 'Father/Husband Name', key: 'father_husband_name', width: 24 },
      { header: 'Date of Birth', key: 'date_of_birth', width: 15 },
      { header: 'Aadhar', key: 'aadhar', width: 18 },
      { header: 'Phone No', key: 'phone_no', width: 16 },
      { header: 'Address', key: 'address', width: 32 },
      { header: 'Bank', key: 'bank', width: 18 },
      { header: 'Account No', key: 'account_no', width: 22 },
      { header: 'IFSC', key: 'ifsc', width: 16 },
      { header: 'Branch', key: 'branch', width: 18 },
      { header: 'Date of Joining', key: 'date_of_joining', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'PAN', key: 'pan', width: 16 },
      { header: 'UAN', key: 'uan', width: 18 },
      { header: 'ESIC No', key: 'esic_no', width: 18 },
      { header: 'S. Kalyan No', key: 's_kalyan_no', width: 18 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Daily Wage', key: 'p_day_wage', width: 16 },
      { header: 'Project', key: 'project', width: 20 },
      { header: 'Site', key: 'site', width: 20 },
      { header: 'Date of Exit', key: 'date_of_exit', width: 16 },
      { header: 'Remarks', key: 'doe_rem', width: 26 },
      { header: 'Notice Period (Days)', key: 'resignation_notice_period', width: 20 },
      { header: 'Card Valid Until', key: 'card_valid_until', width: 18 }
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate-800
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const borderStyle: any = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // Add employee rows
    employees.forEach((emp: any, index: number) => {
      const row = worksheet.addRow({
        sno: index + 1,
        employee_name: emp.employee_name || '',
        father_husband_name: emp.father_husband_name || '',
        date_of_birth: emp.date_of_birth || '',
        aadhar: emp.aadhar ? String(emp.aadhar) : '',
        phone_no: emp.phone_no ? String(emp.phone_no) : '',
        address: emp.address || '',
        bank: emp.bank || '',
        account_no: emp.account_no ? String(emp.account_no) : '',
        ifsc: emp.ifsc || '',
        branch: emp.branch || '',
        date_of_joining: emp.date_of_joining || '',
        status: emp.status || 'Active',
        pan: emp.pan || '',
        uan: emp.uan ? String(emp.uan) : '',
        esic_no: emp.esic_no ? String(emp.esic_no) : '',
        s_kalyan_no: emp.s_kalyan_no || '',
        category: emp.category || 'UNSKILLED',
        p_day_wage: typeof emp.p_day_wage === 'number' ? emp.p_day_wage : '',
        project: emp.project || '',
        site: emp.site || '',
        date_of_exit: emp.date_of_exit || '',
        doe_rem: emp.doe_rem || '',
        resignation_notice_period: typeof emp.resignation_notice_period === 'number' ? emp.resignation_notice_period : '',
        card_valid_until: emp.card_valid_until || ''
      });

      row.height = 22;
      const zebraColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = borderStyle;
        cell.font = { size: 10, color: { argb: 'FF1F2937' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraColor } };

        // S.No, Dates, Codes, Status -> Center align
        if (
          colNumber === 1 ||  // S.No
          colNumber === 4 ||  // DOB
          colNumber === 5 ||  // Aadhar
          colNumber === 6 ||  // Phone
          colNumber === 9 ||  // Account No
          colNumber === 10 || // IFSC
          colNumber === 12 || // DOJ
          colNumber === 13 || // Status
          colNumber === 14 || // PAN
          colNumber === 15 || // UAN
          colNumber === 16 || // ESIC
          colNumber === 22 || // DOE
          colNumber === 25    // Card valid until
        ) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 19 || colNumber === 24) {
          // Daily Wage, Notice Period -> Right align
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (colNumber === 19 && typeof cell.value === 'number') {
            cell.numFmt = '₹#,##0.00';
          }
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    const isCsv = query.format === 'csv';
    const filename = `MasterRoll_Export_${new Date().toISOString().split('T')[0]}.${isCsv ? 'csv' : 'xlsx'}`;

    if (isCsv) {
      const buffer = await workbook.csv.writeBuffer();
      setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
      setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
      return buffer;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    setResponseHeader(
      event,
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
    return buffer;
  } catch (error: any) {
    console.error('Export master-rolls error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error exporting employees'
    });
  }
});