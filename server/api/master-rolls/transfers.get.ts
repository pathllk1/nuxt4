import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { defineEventHandler, getQuery, setResponseHeader, createError } from 'h3';
import EmployeeSiteTransfer from '../../models/EmployeeSiteTransfer';
import MasterRoll from '../../models/MasterRoll';
import { requireAuthSession } from '../../utils/auth';

/**
 * GET /api/master-rolls/transfers
 * Centralized audit query and export for employee site/project movements.
 * Supports filtering by fromSite, toSite, project, transferType, startDate, endDate, search.
 * Returns paginated JSON data with summary metrics or streams formatted Excel workbook.
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    if (!user?.firm_id) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const firmObjectId = new mongoose.Types.ObjectId(user.firm_id);
    const query = getQuery(event);

    const filter: Record<string, any> = {
      firm_id: firmObjectId,
      status: { $ne: 'CANCELLED' }
    };

    if (query.fromSite && typeof query.fromSite === 'string' && query.fromSite.trim()) {
      filter.from_site = query.fromSite.trim();
    }

    if (query.toSite && typeof query.toSite === 'string' && query.toSite.trim()) {
      filter.to_site = query.toSite.trim();
    }

    if (query.transferType && typeof query.transferType === 'string' && query.transferType.trim()) {
      filter.transfer_type = query.transferType.trim().toUpperCase();
    }

    const startDate = typeof query.startDate === 'string' && query.startDate.trim() ? query.startDate.trim() : null;
    const endDate = typeof query.endDate === 'string' && query.endDate.trim() ? query.endDate.trim() : null;

    if (startDate || endDate) {
      const dateCond: Record<string, any> = {};
      if (startDate) dateCond.$gte = startDate;
      if (endDate) dateCond.$lte = endDate;
      filter.effective_date = dateCond;
    }

    if (query.project && typeof query.project === 'string' && query.project.trim()) {
      const p = query.project.trim();
      const projectOr = [{ to_project: p }, { from_project: p }];
      if (filter.$and) {
        filter.$and.push({ $or: projectOr });
      } else {
        filter.$or = projectOr;
      }
    }

    if (query.search && typeof query.search === 'string' && query.search.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      const matchedEmployees = await MasterRoll.find({
        firm_id: firmObjectId,
        $or: [
          { employee_name: searchRegex },
          { aadhar: searchRegex },
          { phone_no: searchRegex }
        ]
      }).select('_id').lean();

      const employeeIds = matchedEmployees.map((e) => e._id);

      const searchOr: any[] = [
        { master_roll_id: { $in: employeeIds } },
        { transfer_order_no: searchRegex },
        { remarks: searchRegex }
      ];

      if (filter.$and) {
        filter.$and.push({ $or: searchOr });
      } else if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    // Check if client requested Excel (.xlsx) export
    const isExport = query.format === 'xlsx' || query.export === 'xlsx';

    if (isExport) {
      const allTransfers = await EmployeeSiteTransfer.find(filter)
        .sort({ effective_date: -1, createdAt: -1 })
        .populate('master_roll_id', 'employee_name aadhar phone_no category project site status')
        .populate('created_by', 'name username')
        .lean();

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Enterprise ERP - Master Roll Subsystem';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Site Movements Register', {
        pageSetup: { orientation: 'landscape', paperSize: 9 }
      });

      worksheet.columns = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Employee Name', key: 'employee_name', width: 24 },
        { header: 'Phone No', key: 'phone_no', width: 14 },
        { header: 'Aadhaar No', key: 'aadhar', width: 16 },
        { header: 'Category', key: 'category', width: 14 },
        { header: 'From Site', key: 'from_site', width: 18 },
        { header: 'From Project', key: 'from_project', width: 20 },
        { header: 'Destination Site', key: 'to_site', width: 20 },
        { header: 'Destination Project', key: 'to_project', width: 22 },
        { header: 'Effective Date', key: 'effective_date', width: 14 },
        { header: 'Transfer Nature', key: 'transfer_type', width: 16 },
        { header: 'Transfer Order Ref', key: 'transfer_order_no', width: 18 },
        { header: 'Advance Balance (₹)', key: 'advance_balance_at_transfer', width: 18 },
        { header: 'Remarks / Reason', key: 'remarks', width: 28 },
        { header: 'Recorded By', key: 'created_by', width: 16 },
        { header: 'Entry Timestamp', key: 'created_at', width: 18 }
      ];

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

      allTransfers.forEach((tr: any, idx: number) => {
        const emp = tr.master_roll_id || {};
        const createdByUser = tr.created_by?.name || tr.created_by?.username || 'System';

        const row = worksheet.addRow({
          sno: idx + 1,
          employee_name: emp.employee_name || 'N/A',
          phone_no: emp.phone_no ? String(emp.phone_no) : '',
          aadhar: emp.aadhar ? String(emp.aadhar) : '',
          category: emp.category || 'WORKER',
          from_site: tr.from_site || 'Initial Station',
          from_project: tr.from_project || '',
          to_site: tr.to_site || '',
          to_project: tr.to_project || '',
          effective_date: tr.effective_date || '',
          transfer_type: tr.transfer_type || 'PERMANENT',
          transfer_order_no: tr.transfer_order_no || '-',
          advance_balance_at_transfer: typeof tr.advance_balance_at_transfer === 'number' ? tr.advance_balance_at_transfer : 0,
          remarks: tr.remarks || '',
          created_by: createdByUser,
          created_at: tr.createdAt ? new Date(tr.createdAt).toISOString().split('T')[0] : ''
        });

        row.height = 22;
        const zebraColor = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = borderStyle;
          cell.font = { size: 10, color: { argb: 'FF1F2937' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraColor } };

          if ([1, 3, 4, 10, 11, 12, 16].includes(colNumber)) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNumber === 13) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.numFmt = '₹#,##0.00';
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
      });

      const filename = `Site_Movements_Register_${new Date().toISOString().split('T')[0]}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();

      setResponseHeader(
        event,
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
      return buffer;
    }

    // Pagination for standard JSON API response
    const page = Math.max(1, parseInt((query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const [totalCount, transfers, summaryAgg] = await Promise.all([
      EmployeeSiteTransfer.countDocuments(filter),
      EmployeeSiteTransfer.find(filter)
        .sort({ effective_date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('master_roll_id', 'employee_name aadhar phone_no category project site status date_of_joining p_day_wage')
        .populate('created_by', 'name username')
        .lean(),
      EmployeeSiteTransfer.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            permanentCount: {
              $sum: { $cond: [{ $eq: ['$transfer_type', 'PERMANENT'] }, 1, 0] }
            },
            temporaryCount: {
              $sum: { $cond: [{ $eq: ['$transfer_type', 'TEMPORARY'] }, 1, 0] }
            },
            rotationCount: {
              $sum: { $cond: [{ $eq: ['$transfer_type', 'ROTATION'] }, 1, 0] }
            },
            totalAdvanceAtTransfer: { $sum: '$advance_balance_at_transfer' },
            uniqueEmployeeIds: { $addToSet: '$master_roll_id' }
          }
        }
      ])
    ]);

    const summaryData = summaryAgg?.[0] || {
      totalCount: 0,
      permanentCount: 0,
      temporaryCount: 0,
      rotationCount: 0,
      totalAdvanceAtTransfer: 0,
      uniqueEmployeeIds: []
    };

    return {
      success: true,
      data: {
        transfers,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit) || 1
        },
        summary: {
          totalTransfers: summaryData.totalCount,
          permanent: summaryData.permanentCount,
          temporary: summaryData.temporaryCount,
          rotation: summaryData.rotationCount,
          totalAdvanceTransferred: summaryData.totalAdvanceAtTransfer,
          uniqueWorkersCount: summaryData.uniqueEmployeeIds?.length || 0
        }
      }
    };
  } catch (error: any) {
    console.error('Get site transfers error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error fetching site movement register'
    });
  }
});

