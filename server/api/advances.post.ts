import mongoose, { PipelineStage } from 'mongoose';
import Advance from '../models/Advance';
import { postAdvanceLedger } from '../utils/advance-ledger-helper';
import { requireAuthSession } from '../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event);
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { masterRollId, amount, date, paymentMode, remarks, bankAccountId, type } = body;
    const finalType = type || 'ADVANCE';

    if (!masterRollId || !amount || !date) {
      throw new Error('Missing required fields');
    }

    const numAmount = parseFloat(amount);

    if (finalType === 'REPAYMENT') {
      const pipeline: PipelineStage[] = [
        { $match: { firm_id: new mongoose.Types.ObjectId(user.firm_id as string), master_roll_id: new mongoose.Types.ObjectId(masterRollId) } },
        {
          $group: {
            _id: '$master_roll_id',
            balance: {
              $sum: { $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', { $subtract: [0, '$amount'] }] }
            }
          }
        }
      ];
      const balResult = await Advance.aggregate(pipeline).session(session);
      const currentBalance = balResult.length > 0 ? balResult[0].balance : 0;

      if (numAmount > currentBalance) {
        throw new Error(`Repayment exceeds outstanding balance (₹${currentBalance.toFixed(2)})`);
      }
    }

    const doc = new Advance({
      firm_id: user.firm_id,
      master_roll_id: masterRollId,
      type: finalType,
      amount: numAmount,
      date,
      payment_mode: paymentMode || 'CASH',
      bank_account_id: bankAccountId,
      remarks,
      created_by: user._id,
      updated_by: user._id
    });

    await doc.save({ session });

    const voucherId = await postAdvanceLedger(doc, session);
    doc.voucher_group_id = voucherId;
    await doc.save({ session });

    await session.commitTransaction();
    return doc;
  } catch (err: any) {
    await session.abortTransaction();
    throw createError({
      statusCode: 500,
      message: err.message
    });
  } finally {
    session.endSession();
  }
});
