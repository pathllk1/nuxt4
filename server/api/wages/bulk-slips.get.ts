import Wage from '../../models/Wage';
import Firm from '../../models/Firm';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';
import { connectDB } from '../../plugins/mongodb';
import { generateWageSlipPDF, safeFilenamePart } from '../../utils/wages/wage-slip-pdf';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const query = getQuery(event);
  const month = query.month as string;

  if (!month) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Salary month is required'
    });
  }

  await connectDB();

  const wages = await Wage.find({ firm_id: user.firm_id, salary_month: month })
    .populate(
      'master_roll_id',
      'employee_name father_husband_name aadhar pan bank account_no ifsc uan esic_no category project site date_of_joining p_day_wage'
    )
    .lean();

  if (wages.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `No wage records found for ${month}`
    });
  }

  const firm = await Firm.findById(user.firm_id).lean();

  // Dynamic import of archiver to prevent bundling issues
  const archiverModule = (await import('archiver')) as any;
  const archiver = archiverModule.default || archiverModule;

  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];

  archive.on('data', (chunk: Buffer) => chunks.push(chunk));

  const safeMonth = safeFilenamePart(month, 'month');
  for (const wage of wages) {
    const empName = (wage as any).master_roll_id?.employee_name || 'employee';
    const safeName = safeFilenamePart(empName, 'employee');
    const workerSuffix = (wage as any).master_roll_id?._id
      ? String((wage as any).master_roll_id._id).slice(-4)
      : String(wage._id).slice(-4);
    const pdfBuffer = await generateWageSlipPDF(wage, firm);
    archive.append(pdfBuffer, { name: `WageSlip_${safeName}_${workerSuffix}_${safeMonth}.pdf` });
  }

  await archive.finalize();
  const zipBuffer = Buffer.concat(chunks);

  setResponseHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="WageSlips_${safeMonth}.zip"`,
    'Content-Length': String(zipBuffer.length),
  });

  return zipBuffer;
});
