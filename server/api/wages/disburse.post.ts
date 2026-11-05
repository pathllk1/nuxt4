import mongoose from 'mongoose';
import Wage from '../../models/Wage';
import { postWageDisbursement } from '../../utils/wages-ledger-helper';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const body = await readBody(event);
  const ids: string[] = (body.wageIds || (body.wageId ? [body.wageId] : []))
    .filter((id: any) => id && mongoose.isValidObjectId(id));

  if (ids.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'At least one valid wage ID is required in wageIds or wageId',
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const results = [];
    for (const id of ids) {
      const wage = await Wage.findOne({ _id: id, firm_id: user.firm_id }).session(session);
      if (!wage) {
        results.push({ wageId: id, status: 'NOT_FOUND', message: 'Wage record not found' });
        continue;
      }

      if (wage.payment_status === 'PAID') {
        results.push({
          wageId: id,
          status: 'ALREADY_PAID',
          voucherGroupId: wage.payment_voucher_group_id,
        });
        continue;
      }

      if (wage.net_salary <= 0) {
        wage.payment_status = 'PAID';
        await wage.save({ session });
        results.push({
          wageId: id,
          status: 'PAID',
          message: 'Zero net salary; marked paid with no cash disbursement required',
        });
        continue;
      }

      if (body.paid_date) wage.paid_date = body.paid_date;
      if (body.payment_mode) wage.payment_mode = body.payment_mode;
      if (body.bank_account_id) wage.bank_account_id = new mongoose.Types.ObjectId(body.bank_account_id);
      if (body.cheque_no) wage.cheque_no = String(body.cheque_no).trim();
      wage.updated_by = user._id;

      const voucherGroupId = await postWageDisbursement(wage, session);
      results.push({
        wageId: id,
        status: 'PAID',
        voucherGroupId,
      });
    }

    await session.commitTransaction();
    return {
      success: true,
      message: `Processed disbursement for ${results.length} wage records`,
      results,
    };
  } catch (err: any) {
    await session.abortTransaction();
    if (err.statusCode) throw err;
    throw createError({
      statusCode: 500,
      message: `Wage disbursement failed: ${err.message}`,
    });
  } finally {
    session.endSession();
  }
});

