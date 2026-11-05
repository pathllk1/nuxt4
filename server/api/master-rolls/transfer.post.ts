import mongoose from 'mongoose';
import MasterRoll from '../../models/MasterRoll';
import EmployeeSiteTransfer from '../../models/EmployeeSiteTransfer';
import Advance from '../../models/Advance';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const body = await readBody(event);
  const {
    masterRollId,
    toSite,
    toProject,
    effectiveDate,
    transferType,
    returnExpectedDate,
    transferOrderNo,
    remarks,
  } = body;

  if (!masterRollId || !mongoose.isValidObjectId(masterRollId)) {
    throw createError({ statusCode: 400, message: 'Valid masterRollId is required' });
  }

  if (!toSite || typeof toSite !== 'string' || !toSite.trim()) {
    throw createError({ statusCode: 400, message: 'Target destination site (toSite) is required' });
  }

  if (!effectiveDate || !DATE_REGEX.test(effectiveDate)) {
    throw createError({ statusCode: 400, message: 'Valid effectiveDate in YYYY-MM-DD format is required' });
  }

  if (returnExpectedDate && !DATE_REGEX.test(returnExpectedDate)) {
    throw createError({ statusCode: 400, message: 'Invalid returnExpectedDate format (expected YYYY-MM-DD)' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employee = await MasterRoll.findOne({
      _id: new mongoose.Types.ObjectId(masterRollId),
      firm_id: user.firm_id,
    }).session(session);

    if (!employee) {
      throw createError({ statusCode: 404, message: 'Employee not found' });
    }

    const fromSite = employee.site || null;
    const fromProject = employee.project || null;
    const cleanToSite = toSite.trim();
    const cleanToProject = (toProject && typeof toProject === 'string' && toProject.trim())
      ? toProject.trim()
      : (fromProject || 'General');

    // Query employee's live advance loan balance for transfer handover audit
    const advResult = await Advance.aggregate([
      {
        $match: {
          firm_id: user.firm_id,
          master_roll_id: employee._id,
        },
      },
      {
        $group: {
          _id: '$master_roll_id',
          balance: {
            $sum: {
              $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', { $subtract: [0, '$amount'] }],
            },
          },
        },
      },
    ]).session(session);

    const liveAdvanceBalance = advResult.length > 0 ? (advResult[0].balance || 0) : 0;

    const [transferDoc] = await EmployeeSiteTransfer.create(
      [
        {
          firm_id: user.firm_id,
          master_roll_id: employee._id,
          from_project: fromProject,
          from_site: fromSite,
          to_project: cleanToProject,
          to_site: cleanToSite,
          effective_date: effectiveDate,
          transfer_type: transferType || 'PERMANENT',
          return_expected_date: returnExpectedDate || null,
          transfer_order_no: transferOrderNo ? String(transferOrderNo).trim() : null,
          advance_balance_at_transfer: Math.max(0, liveAdvanceBalance),
          remarks: remarks ? String(remarks).trim() : null,
          status: 'COMPLETED',
          created_by: user._id,
          updated_by: user._id,
        },
      ],
      { session }
    );

    // Update active Master Roll record
    employee.project = cleanToProject;
    employee.site = cleanToSite;
    employee.updated_by = user._id;
    await employee.save({ session });

    await session.commitTransaction();

    return {
      success: true,
      message: `Employee ${employee.employee_name} successfully transferred from ${fromSite || 'Unassigned'} to ${cleanToSite}`,
      data: {
        transfer: transferDoc,
        employee: {
          _id: employee._id,
          employee_name: employee.employee_name,
          project: employee.project,
          site: employee.site,
          advance_balance: liveAdvanceBalance,
        },
      },
    };
  } catch (err: any) {
    await session.abortTransaction();
    if (err.statusCode) throw err;
    throw createError({
      statusCode: 500,
      message: `Site transfer failed: ${err.message}`,
    });
  } finally {
    session.endSession();
  }
});

