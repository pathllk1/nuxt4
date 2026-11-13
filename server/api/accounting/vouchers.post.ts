import mongoose from 'mongoose';
import Ledger from '../../models/Ledger';
import BankAccount from '../../models/BankAccount';
import { UnifiedPostingService } from '../../utils/accounting/unified-posting.service';
import { convertVoucherInputToLegs, mapLegacyVoucherType } from '../../utils/accounting/posting-adapter';
import { requireAuthSession } from '../../utils/auth';
import { connectDB } from '../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = (await readBody(event)) || {};
  const { vtype, vdate, narration = '', entries, mainAccount, summary } = body;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Voucher must contain at least one entry' });
  }

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
  const transactionDate = vdate || new Date().toISOString().split('T')[0];

  const executeSave = async (session?: mongoose.ClientSession) => {
    let resolvedMainAccountName = mainAccount;
    let resolvedBankAccountId: mongoose.Types.ObjectId | null = null;

    if (mainAccount && mongoose.Types.ObjectId.isValid(mainAccount)) {
      const bankAccount = await BankAccount.findOne(
        {
          _id: mainAccount,
          $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }]
        },
        null,
        session ? { session } : {}
      ).lean();

      if (bankAccount) {
        resolvedMainAccountName = bankAccount.account_name;
        resolvedBankAccountId = bankAccount._id as mongoose.Types.ObjectId;
      }
    }

    const legs = convertVoucherInputToLegs({
      vtype,
      entries,
      mainAccount: (mainAccount && summary) ? resolvedMainAccountName : undefined,
      bankAccountId: resolvedBankAccountId,
      narration,
    });

    const mappedType = mapLegacyVoucherType(vtype);

    return await UnifiedPostingService.postVoucher(
      {
        firmId: firmIdObj,
        voucherType: mappedType,
        transactionDate,
        narration,
        legs,
        createdBy: user.username || user.email || 'system',
        refType: 'VOUCHER',
      },
      session
    );
  };

  let session: mongoose.ClientSession | null = null;
  let postResult: any;

  try {
    session = await mongoose.connection.startSession();
    session.startTransaction();
    postResult = await executeSave(session);
    await session.commitTransaction();
  } catch (err: any) {
    if (session) {
      try { await session.abortTransaction(); } catch (_) {}
    }

    const isDev = process.env.NODE_ENV !== 'production';
    if (
      isDev && (
        err.message?.includes('ClientSession must be from the same MongoClient') ||
        err.message?.includes('replica set') ||
        err.message?.includes('Transaction numbers')
      )
    ) {
      console.warn('[Vouchers Post] DEV ONLY: Local MongoDB lacks replica set. Retrying without transaction session:', err.message);
      try {
        postResult = await executeSave(undefined);
      } catch (retryErr: any) {
        console.error('[Vouchers Post] Standalone retry error:', retryErr);
        throw createError({
          statusCode: retryErr.statusCode || 500,
          statusMessage: retryErr.message
        });
      }
    } else {
      console.error('[Vouchers Post] Error:', err);
      throw createError({
        statusCode: err.statusCode || 500,
        statusMessage: `Financial voucher posting failed: ${err.message}`
      });
    }
  } finally {
    if (session) {
      try { session.endSession(); } catch (_) {}
    }
  }

  // Cross-module sync: If payment voucher is linked to a Labor Period, record in labor_advances
  if (vtype === 'PAYMENT' && postResult?.voucherGroupId) {
    try {
      const { getSql, connectPostgres } = await import('../../utils/pg.config');
      let sql = getSql();
      if (!sql) sql = await connectPostgres();
      if (sql) {
        const tdsPayableEntry = entries.find((e: any) => (e.accountHead || '').toLowerCase().includes('tds payable'));
        const tdsBorneEntry = entries.find((e: any) => (e.accountHead || '').toLowerCase().includes('tds borne by company'));
        let tdsMode: string | null = null;
        let tdsAmount: number | null = null;

        if (tdsPayableEntry) {
          tdsAmount = Math.abs(Number(tdsPayableEntry.amount || tdsPayableEntry.creditAmount) || 0);
          if (tdsBorneEntry || (body.narration || '').includes('Grossed-up')) {
            tdsMode = 'GROSS_UP';
          } else {
            tdsMode = 'DEDUCT';
          }
        }

        const advancesToInsert: any[] = [];
        for (let idx = 0; idx < entries.length; idx++) {
          const entry = entries[idx];
          const periodId = entry.laborPeriodId || body.laborPeriodId;
          const head = (entry.accountHead || '').toLowerCase();
          // Ignore tax / deduction lines
          if (head.includes('tds payable') || head.includes('tds borne by company')) continue;

          if (periodId && (entry.amount > 0 || entry.debitAmount > 0)) {
            const baseAmount = Number(entry.amount || entry.debitAmount) || 0;
            // For GROSS_UP (TDS on firm's head), the leader's wage bill is deducted ONLY by net payout
            const periodAdvanceAmount = baseAmount;
            const currentGrossAmount = tdsMode === 'GROSS_UP' ? (baseAmount + (tdsAmount || 0)) : (tdsMode === 'DEDUCT' ? baseAmount : null);
            const paidFromBankId = postResult.bankAccountId ? String(postResult.bankAccountId) : null;
            advancesToInsert.push({
              firmId: String(user.firm_id),
              periodId,
              amount: periodAdvanceAmount,
              paymentDate: transactionDate,
              paidFromBankId,
              voucherGroupId: postResult.voucherGroupId,
              tdsMode,
              tdsAmount,
              grossAmount: currentGrossAmount,
              legIndex: idx
            });
          }
        }

        if (advancesToInsert.length > 0) {
          await sql.begin(async (tx: any) => {
            for (const adv of advancesToInsert) {
              // Idempotent insertion guard: check if advance row already exists for this exact source line (F-06)
              const existing = await tx`
                SELECT id, amount FROM labor_advances
                WHERE firm_id = ${adv.firmId}
                  AND period_id = ${adv.periodId}
                  AND ledger_voucher_group_id = ${adv.voucherGroupId}
                  AND leg_index = ${adv.legIndex}
                LIMIT 1
              `;
              if (existing.length === 0) {
                await tx`
                  INSERT INTO labor_advances (
                    firm_id, period_id, amount, payment_date, paid_from_bank_account_id, ledger_voucher_group_id,
                    tds_mode, tds_amount, gross_amount, leg_index
                  ) VALUES (
                    ${adv.firmId}, ${adv.periodId}, ${adv.amount}, ${adv.paymentDate}, ${adv.paidFromBankId}, ${adv.voucherGroupId},
                    ${adv.tdsMode}, ${adv.tdsAmount}, ${adv.grossAmount}, ${adv.legIndex}
                  )
                `;
              } else {
                // Assert payload equality on idempotent retry (F-06)
                const existingAmt = Number(existing[0].amount) || 0;
                if (Math.abs(existingAmt - adv.amount) > 0.01) {
                  throw new Error(
                    `[Labor Idempotency Conflict] Existing advance row amount ₹${existingAmt} does not match replay payload ₹${adv.amount}`
                  );
                }
              }
            }
          });
        }
      }
    } catch (laborSyncErr: any) {
      console.error('[Dual-DB Sync Failure] Post-voucher labor advance sync error:', laborSyncErr.message);
      // If the caller explicitly bound this voucher to a labor period, roll back MongoDB voucher (A-04, F-07)
      const hasLaborPeriod = entries.some((e: any) => e.laborPeriodId) || body.laborPeriodId;
      if (hasLaborPeriod && postResult?.voucherGroupId) {
        let compSuccess = false;
        let compErrorMsg = '';
        try {
          const firmOid = new mongoose.Types.ObjectId(String(user.firm_id));
          const compResult = await Ledger.updateMany(
            {
              voucherGroupId: postResult.voucherGroupId,
              $or: [{ firmId: firmOid }, { firm_id: firmOid }]
            },
            {
              $set: {
                isReversed: true,
                reversedAt: new Date(),
                reversalReason: `Compensating cancellation: PostgreSQL labor advance write failed (${laborSyncErr.message || 'Error'})`
              }
            }
          );
          compSuccess = (compResult?.modifiedCount || 0) > 0;
        } catch (revErr: any) {
          compErrorMsg = revErr.message;
          console.error('[Dual-DB Compensation Failure] Could not reverse orphaned MongoDB voucher:', revErr.message);
        }

        if (compSuccess) {
          throw createError({
            statusCode: 500,
            statusMessage: `PostgreSQL labor synchronization failed: ${laborSyncErr.message || 'Database error'}. General Ledger voucher "${postResult.voucherGroupId}" was successfully voided via compensating transaction.`
          });
        } else {
          throw createError({
            statusCode: 500,
            statusMessage: `CRITICAL INTEGRITY ALERT: PostgreSQL labor synchronization failed: ${laborSyncErr.message || 'Database error'}. Compensating void of General Ledger voucher "${postResult.voucherGroupId}" FAILED (${compErrorMsg || '0 documents modified'}). Manual reconciliation required.`
          });
        }
      }
    }
  }

  return {
    success: true,
    message: `${vtype} voucher created successfully`,
    data: {
      voucherId: postResult.voucherGroupId,
      voucherNo: postResult.voucherNo,
      status: 'POSTED'
    }
  };
});
