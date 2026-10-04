import { defineEventHandler, getQuery } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import { connectDB } from '../../plugins/mongodb';
import Ledger from '../../models/Ledger';
import Stock from '../../models/Stock';
import Bill from '../../models/Bill';
import MasterRoll from '../../models/MasterRoll';
import PeriodLock from '../../models/PeriodLock';
import { getCurrentFinancialYear } from '../../utils/accounting/bill-utils';

export default defineEventHandler(async (event) => {
  await connectDB();
  const user = await requireAuthSession(event);
  const query = getQuery(event);

  const rawFirmId = String(query.firmId || user.firm_id || '');
  if (!rawFirmId || !mongoose.Types.ObjectId.isValid(rawFirmId)) {
    return {
      success: false,
      message: 'A valid firmId is required',
      data: null
    };
  }

  const firmIdObj = new mongoose.Types.ObjectId(rawFirmId);
  const fy = String(query.financialYear || getCurrentFinancialYear());

  // 1. Concurrent Aggregations
  const [
    debtorsAgg,
    creditorsAgg,
    taxesAgg,
    revenueAgg,
    stockDocs,
    billsCount,
    workersCount,
    recentLedgers,
    periodLockDoc,
    trialCheck
  ] = await Promise.all([
    // Debtors (Receivables)
    Ledger.aggregate([
      {
        $match: {
          $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
          accountType: { $in: ['SUNDRY_DEBTORS', 'DEBTOR'] }
        }
      },
      {
        $group: {
          _id: null,
          totalDr: { $sum: '$debitAmount' },
          totalCr: { $sum: '$creditAmount' }
        }
      }
    ]),

    // Creditors (Payables)
    Ledger.aggregate([
      {
        $match: {
          $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
          accountType: { $in: ['SUNDRY_CREDITORS', 'CREDITOR'] }
        }
      },
      {
        $group: {
          _id: null,
          totalDr: { $sum: '$debitAmount' },
          totalCr: { $sum: '$creditAmount' }
        }
      }
    ]),

    // Duties and Taxes (TDS + GST)
    Ledger.aggregate([
      {
        $match: {
          $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
          accountType: 'DUTIES_AND_TAXES'
        }
      },
      {
        $group: {
          _id: null,
          totalDr: { $sum: '$debitAmount' },
          totalCr: { $sum: '$creditAmount' },
          tdsCr: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$accountHead', regex: /TDS/i } },
                { $subtract: ['$creditAmount', '$debitAmount'] },
                0
              ]
            }
          },
          gstCr: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$accountHead', regex: /GST/i } },
                { $subtract: ['$creditAmount', '$debitAmount'] },
                0
              ]
            }
          }
        }
      }
    ]),

    // Revenue / Sales
    Ledger.aggregate([
      {
        $match: {
          $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
          accountType: { $in: ['INCOME', 'DIRECT_INCOME', 'INDIRECT_INCOME'] }
        }
      },
      {
        $group: {
          _id: null,
          totalDr: { $sum: '$debitAmount' },
          totalCr: { $sum: '$creditAmount' }
        }
      }
    ]),

    // Inventory stock items
    Stock.find({
      $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }, { firm_id: rawFirmId }, { firmId: rawFirmId }]
    }, 'qty rate total').lean(),

    // Active bills count
    Bill.countDocuments({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }, { firmId: rawFirmId }]
    }),

    // Active muster roll workers
    MasterRoll.countDocuments({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      status: { $ne: 'INACTIVE' }
    }),

    // Recent 8 financial voucher entries
    Ledger.find({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      voucherType: { $ne: 'OPENING_BALANCE' }
    })
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(8)
      .lean(),

    // Period Lock status
    PeriodLock.findOne({
      firmId: firmIdObj,
      financialYear: fy,
      isLocked: true
    }).lean(),

    // Double Entry Check
    Ledger.aggregate([
      {
        $match: {
          $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }]
        }
      },
      {
        $group: {
          _id: null,
          sumDr: { $sum: '$debitAmount' },
          sumCr: { $sum: '$creditAmount' }
        }
      }
    ])
  ]);

  // 2. Computed Metrics
  const receivables = Math.max(0, (debtorsAgg[0]?.totalDr || 0) - (debtorsAgg[0]?.totalCr || 0));
  const payables = Math.max(0, (creditorsAgg[0]?.totalCr || 0) - (creditorsAgg[0]?.totalDr || 0));
  const statutoryNet = (taxesAgg[0]?.totalCr || 0) - (taxesAgg[0]?.totalDr || 0);
  const tdsDue = Math.max(0, taxesAgg[0]?.tdsCr || 0);
  const gstDue = Math.max(0, taxesAgg[0]?.gstCr || 0);
  const grossRevenue = Math.max(0, (revenueAgg[0]?.totalCr || 0) - (revenueAgg[0]?.totalDr || 0));

  const totalStockValuation = (stockDocs || []).reduce((sum: number, s: any) => {
    return sum + (Number(s.total) || ((Number(s.qty) || 0) * (Number(s.rate) || 0)));
  }, 0);

  const sumDr = trialCheck[0]?.sumDr || 0;
  const sumCr = trialCheck[0]?.sumCr || 0;
  const isBalanced = Math.abs(sumDr - sumCr) < 0.05;

  return {
    success: true,
    data: {
      financialYear: fy,
      metrics: {
        revenue: grossRevenue,
        receivables,
        payables,
        stockValue: Math.round(totalStockValuation),
        statutoryTax: Math.max(0, statutoryNet),
        tdsDue,
        gstDue,
        activeWorkers: workersCount,
        activeBillsCount: billsCount
      },
      recentVouchers: (recentLedgers || []).map((l: any) => ({
        _id: String(l._id),
        voucherNo: l.voucherNo || l.voucherNumber || 'VOUCHER',
        voucherType: l.voucherType || 'JOURNAL',
        accountHead: l.accountHead,
        accountType: l.accountType,
        debitAmount: Number(l.debitAmount) || 0,
        creditAmount: Number(l.creditAmount) || 0,
        transactionDate: l.transactionDate ? new Date(l.transactionDate).toISOString().split('T')[0] : '',
        narration: l.narration || ''
      })),
      compliance: {
        isPeriodLocked: !!periodLockDoc,
        isBalanced,
        balanceDiff: Math.abs(sumDr - sumCr)
      }
    }
  };
});
