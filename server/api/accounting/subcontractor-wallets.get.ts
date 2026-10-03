import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import User from '../../models/User';
import Ledger from '../../models/Ledger';
import SubcontractorExpense from '../../models/SubcontractorExpense';

/**
 * GET /api/accounting/subcontractor-wallets
 * Allows Firm Owners, Admins, and Managers to view all Subcontractors in the firm,
 * their payouts from the firm, their statutory TDS withheld, their actual site burn,
 * and their live wallet balance.
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));

  // Verify Owner, Admin, Manager, or Superadmin
  const currentUser = await User.findById(authSession._id).lean() as any;
  const currentAssignment = (currentUser?.firms || []).find((f: any) =>
    String(f.firm?._id || f.firm) === String(firmIdObj)
  );
  const isAuthorized = currentUser?.role === 'superadmin' || 
    ['Owner', 'Admin', 'Manager'].includes(currentAssignment?.grade || '');

  if (!isAuthorized) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Insufficient permissions: Owner, Admin, or Manager privileges required'
    });
  }

  // 1. Find all Subcontractors assigned to this firm
  const subcontractors = await User.find({
    'firms.firm': firmIdObj,
    'firms.grade': 'Subcontractor'
  }).select('name email firms').lean();

  if (subcontractors.length === 0) {
    return {
      success: true,
      subcontractors: [],
      summary: {
        totalSubcontractors: 0,
        totalGrossPaid: 0,
        totalTdsWithheld: 0,
        totalNetPaid: 0,
        totalSiteExpenses: 0,
        netFloatRemaining: 0
      }
    };
  }

  // 2. Fetch all GL payout entries for all subcontractor Direct Expense heads in this firm
  const linkedHeads: string[] = subcontractors
    .map(s => {
      const assignment = s.firms.find((f: any) => String(f.firm) === String(firmIdObj));
      return assignment?.linkedLedgerHead;
    })
    .filter((h): h is string => typeof h === 'string' && h.length > 0);

  const [glPayouts, allExpenses] = await Promise.all([
    Ledger.find({
      firmId: firmIdObj,
      accountHead: { $in: linkedHeads },
      debitAmount: { $gt: 0 }
    }).lean(),
    SubcontractorExpense.find({
      firmId: firmIdObj
    }).lean()
  ]);

  // Fetch all voucher legs for these payout voucherGroupIds to extract exact TDS and Net
  const vgIds: string[] = glPayouts
    .map(p => p.voucherGroupId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  let allVoucherLegs: any[] = [];
  if (vgIds.length > 0) {
    allVoucherLegs = await Ledger.find({
      firmId: firmIdObj,
      voucherGroupId: { $in: vgIds }
    }).lean();
  }

  let firmTotalGross = 0;
  let firmTotalTds = 0;
  let firmTotalNet = 0;
  let firmTotalExpenses = 0;

  const resultList = subcontractors.map(sub => {
    const assignment = sub.firms.find((f: any) => String(f.firm) === String(firmIdObj));
    const ledgerHead = assignment?.linkedLedgerHead || '';
    const panNumber = assignment?.panNumber || '';

    // Payouts for this subcontractor
    const subPayouts = glPayouts.filter(p => p.accountHead === ledgerHead);
    let grossPaid = 0;
    let tdsWithheld = 0;
    let netPaid = 0;

    for (const p of subPayouts) {
      grossPaid += p.debitAmount;
      const legs = allVoucherLegs.filter(l => l.voucherGroupId === p.voucherGroupId);
      const tdsLeg = legs.find(l => l.accountHead?.toLowerCase().includes('tds') && l.creditAmount > 0);
      const tdsVal = tdsLeg ? tdsLeg.creditAmount : 0;
      tdsWithheld += tdsVal;

      const payoutLeg = legs.find(l => ['BANK', 'CASH'].includes(l.accountType) && l.creditAmount > 0);
      const netVal = payoutLeg ? payoutLeg.creditAmount : (p.debitAmount - tdsVal);
      netPaid += netVal;
    }

    // Site expenses for this subcontractor
    const subExpenses = allExpenses.filter(e => e.subcontractorUserId.toString() === sub._id.toString());
    const totalSiteExpense = subExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    const liveFloat = netPaid - totalSiteExpense;

    firmTotalGross += grossPaid;
    firmTotalTds += tdsWithheld;
    firmTotalNet += netPaid;
    firmTotalExpenses += totalSiteExpense;

    return {
      subcontractorId: sub._id,
      name: sub.name,
      email: sub.email,
      panNumber,
      linkedLedgerHead: ledgerHead,
      assignedProjectIds: assignment?.assignedProjectIds || [],
      grossPaid,
      tdsWithheld,
      netPaid,
      totalSiteExpense,
      liveFloat,
      isDeficit: liveFloat < 0,
      slipsCount: subExpenses.length
    };
  });

  return {
    success: true,
    subcontractors: resultList,
    summary: {
      totalSubcontractors: resultList.length,
      totalGrossPaid: firmTotalGross,
      totalTdsWithheld: firmTotalTds,
      totalNetPaid: firmTotalNet,
      totalSiteExpenses: firmTotalExpenses,
      netFloatRemaining: firmTotalNet - firmTotalExpenses
    }
  };
});
