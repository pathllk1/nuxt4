import ExcelJS from 'exceljs';
import { defineEventHandler, setResponseHeader, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';

/**
 * GET /api/master-rolls/export/template
 * Generates an Excel template file with required and optional columns
 * for bulk importing employees into Master Roll.
 */
export default defineEventHandler(async (event) => {
  try {
    await requireAuthSession(event);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Enterprise Master Roll System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Employee Import Template');

    worksheet.columns = [
      { header: 'Employee Name', key: 'employee_name', width: 24 },
      { header: 'Father/Husband Name', key: 'father_husband_name', width: 24 },
      { header: 'Date of Birth', key: 'date_of_birth', width: 16 },
      { header: 'Aadhar', key: 'aadhar', width: 18 },
      { header: 'Phone No', key: 'phone_no', width: 16 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'Bank', key: 'bank', width: 18 },
      { header: 'Account No', key: 'account_no', width: 20 },
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
      { header: 'Remarks', key: 'doe_rem', width: 24 },
      { header: 'Notice Period (Days)', key: 'resignation_notice_period', width: 22 }
    ];

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' } // Teal-700
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Sample row
    const sampleRow = worksheet.addRow({
      employee_name: 'Rajesh Kumar',
      father_husband_name: 'Ram Kumar',
      date_of_birth: '1990-05-15',
      aadhar: '123456789012',
      phone_no: '9876543210',
      address: 'Plot 12, Sector 5, Industrial Area',
      bank: 'State Bank of India',
      account_no: '12345678901',
      ifsc: 'SBIN0001234',
      branch: 'Main Branch',
      date_of_joining: '2024-01-10',
      status: 'Active',
      pan: 'ABCDE1234F',
      uan: '100123456789',
      esic_no: '11001234560001001',
      s_kalyan_no: 'SK98765',
      category: 'SKILLED',
      p_day_wage: 650,
      project: 'Metro Line 3',
      site: 'Station 4',
      date_of_exit: '',
      doe_rem: '',
      resignation_notice_period: 30
    });

    sampleRow.height = 22;
    sampleRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { size: 10, italic: true, color: { argb: 'FF6B7280' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    setResponseHeader(
      event,
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    setResponseHeader(event, 'Content-Disposition', 'attachment; filename="MasterRoll_Template.xlsx"');

    return buffer;
  } catch (error: any) {
    console.error('Export template error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting template'
    });
  }
});
