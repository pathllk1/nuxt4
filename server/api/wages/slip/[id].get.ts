import Wage from '../../../models/Wage';
import Firm from '../../../models/Firm';
import { requireAuthSession } from '../../../utils/auth';
import { requireWageRole } from '../../../utils/wage-authz';
import { connectDB } from '../../../plugins/mongodb';
import { generateWageSlipPDF, safeFilenamePart } from '../../../utils/wages/wage-slip-pdf';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Wage record ID is required'
    });
  }

  await connectDB();

  const wage = await Wage.findOne({ _id: id, firm_id: user.firm_id })
    .populate(
      'master_roll_id',
      'employee_name father_husband_name aadhar pan bank account_no ifsc uan esic_no category project site date_of_joining p_day_wage'
    )
    .lean();

  if (!wage) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Wage record not found'
    });
  }

  const firm = await Firm.findById(user.firm_id).lean();
  const pdfBuffer = await generateWageSlipPDF(wage, firm);

  const safeName = safeFilenamePart((wage as any).master_roll_id?.employee_name, 'employee');
  const safeMonth = safeFilenamePart(wage.salary_month, 'month');

  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="wage-slip-${safeName}-${safeMonth}.pdf"`,
    'Content-Length': String(pdfBuffer.length),
  });

  return pdfBuffer;
});
