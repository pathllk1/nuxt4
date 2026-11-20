import { defineEventHandler, getQuery, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../../../utils/auth';
import Bill from '../../../../models/Bill';
import Ledger from '../../../../models/Ledger';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
    const firmIdStr = String(user.firm_id);

    const query = getQuery(event);
    const startDate = query.startDate ? String(query.startDate) : '';
    const endDate = query.endDate ? String(query.endDate) : '';
    const firmGstin = query.firmGstin ? String(query.firmGstin) : '';

    if (!startDate || !endDate) {
      throw createError({ statusCode: 400, statusMessage: 'startDate and endDate are required' });
    }

    const filter: any = {
      $or: [
        { firmId: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdObj },
        { firm_id: firmIdStr }
      ],
      status: { $ne: 'CANCELLED' },
      bdate: { $gte: startDate, $lte: endDate }
    };

    if (firmGstin) filter.firmGstin = firmGstin;

    const bills = await Bill.find(filter).lean();
    const salesBills = bills.filter(b => b.btype === 'SALES');
    const purchaseBills = bills.filter(b => b.btype === 'PURCHASE');

    // ─── 3.1 Tax on Outward and Reverse Charge Inward Supplies ───
    // 3.1(a) Outward taxable supplies (excluding zero rated, nil rated, and reverse charge sales)
    const normalSalesBills = salesBills.filter(b => !b.reverseCharge);
    const salesTaxable = Number(normalSalesBills.reduce((acc, b) => acc + (b.grossTotal || 0), 0).toFixed(2));
    const salesCgst = Number(normalSalesBills.reduce((acc, b) => acc + (b.cgst || 0), 0).toFixed(2));
    const salesSgst = Number(normalSalesBills.reduce((acc, b) => acc + (b.sgst || 0), 0).toFixed(2));
    const salesIgst = Number(normalSalesBills.reduce((acc, b) => acc + (b.igst || 0), 0).toFixed(2));

    // 3.1(b) Outward taxable supplies (zero rated)
    const zeroRatedSales = salesBills.filter(b => String(b.supplyType || '').toUpperCase() === 'ZERO_RATED');
    const zeroRatedTaxable = Number(zeroRatedSales.reduce((acc, b) => acc + (b.grossTotal || 0), 0).toFixed(2));

    // 3.1(d) Inward supplies liable to reverse charge (Purchases under RCM)
    const rcmPurchaseBills = purchaseBills.filter(b => Boolean(b.reverseCharge));
    const rcmTaxable = Number(rcmPurchaseBills.reduce((acc, b) => acc + (b.grossTotal || 0), 0).toFixed(2));
    const rcmCgst = Number(rcmPurchaseBills.reduce((acc, b) => acc + (b.cgst || 0), 0).toFixed(2));
    const rcmSgst = Number(rcmPurchaseBills.reduce((acc, b) => acc + (b.sgst || 0), 0).toFixed(2));
    const rcmIgst = Number(rcmPurchaseBills.reduce((acc, b) => acc + (b.igst || 0), 0).toFixed(2));

    // ─── 4. Eligible & Ineligible Input Tax Credit (ITC) ───
    // Ineligible ITC under section 17(5)
    const ineligiblePurchases = purchaseBills.filter(b => Boolean(b.ineligibleItc));
    const ineligibleCgst = Number(ineligiblePurchases.reduce((acc, b) => acc + (b.cgst || 0), 0).toFixed(2));
    const ineligibleSgst = Number(ineligiblePurchases.reduce((acc, b) => acc + (b.sgst || 0), 0).toFixed(2));
    const ineligibleIgst = Number(ineligiblePurchases.reduce((acc, b) => acc + (b.igst || 0), 0).toFixed(2));

    // Eligible regular purchases (Table 4(A)(5) - All other ITC)
    const eligibleNormalPurchases = purchaseBills.filter(b => !b.reverseCharge && !b.ineligibleItc);
    const eligibleTaxable = Number(eligibleNormalPurchases.reduce((acc, b) => acc + (b.grossTotal || 0), 0).toFixed(2));
    const normalPurchaseCgst = Number(eligibleNormalPurchases.reduce((acc, b) => acc + (b.cgst || 0), 0).toFixed(2));
    const normalPurchaseSgst = Number(eligibleNormalPurchases.reduce((acc, b) => acc + (b.sgst || 0), 0).toFixed(2));
    const normalPurchaseIgst = Number(eligibleNormalPurchases.reduce((acc, b) => acc + (b.igst || 0), 0).toFixed(2));

    // Total Available ITC: All other ITC + Inward RCM ITC
    const totalItcCgst = Number((normalPurchaseCgst + rcmCgst).toFixed(2));
    const totalItcSgst = Number((normalPurchaseSgst + rcmSgst).toFixed(2));
    const totalItcIgst = Number((normalPurchaseIgst + rcmIgst).toFixed(2));

    // ─── Statutory Tax Liability & Cross-Utilization (Sec 49A / 49B) ───
    // Total gross liabilities: Outward regular tax + Inward RCM tax
    const totalLiabIgst = Number((salesIgst + rcmIgst).toFixed(2));
    const totalLiabCgst = Number((salesCgst + rcmCgst).toFixed(2));
    const totalLiabSgst = Number((salesSgst + rcmSgst).toFixed(2));

    let remIgstLiab = totalLiabIgst;
    let remCgstLiab = totalLiabCgst;
    let remSgstLiab = totalLiabSgst;

    let remIgstCredit = totalItcIgst;
    let remCgstCredit = totalItcCgst;
    let remSgstCredit = totalItcSgst;

    // 1. IGST Credit offset against IGST liability, then CGST liability, then SGST liability
    const igstAgainstIgst = Math.min(remIgstLiab, remIgstCredit);
    remIgstLiab = Number((remIgstLiab - igstAgainstIgst).toFixed(2));
    remIgstCredit = Number((remIgstCredit - igstAgainstIgst).toFixed(2));

    const igstAgainstCgst = Math.min(remCgstLiab, remIgstCredit);
    remCgstLiab = Number((remCgstLiab - igstAgainstCgst).toFixed(2));
    remIgstCredit = Number((remIgstCredit - igstAgainstCgst).toFixed(2));

    const igstAgainstSgst = Math.min(remSgstLiab, remIgstCredit);
    remSgstLiab = Number((remSgstLiab - igstAgainstSgst).toFixed(2));
    remIgstCredit = Number((remIgstCredit - igstAgainstSgst).toFixed(2));

    // 2. CGST Credit offset against CGST liability, then IGST liability (never against SGST)
    const cgstAgainstCgst = Math.min(remCgstLiab, remCgstCredit);
    remCgstLiab = Number((remCgstLiab - cgstAgainstCgst).toFixed(2));
    remCgstCredit = Number((remCgstCredit - cgstAgainstCgst).toFixed(2));

    const cgstAgainstIgst = Math.min(remIgstLiab, remCgstCredit);
    remIgstLiab = Number((remIgstLiab - cgstAgainstIgst).toFixed(2));
    remCgstCredit = Number((remCgstCredit - cgstAgainstIgst).toFixed(2));

    // 3. SGST Credit offset against SGST liability, then IGST liability (never against CGST)
    const sgstAgainstSgst = Math.min(remSgstLiab, remSgstCredit);
    remSgstLiab = Number((remSgstLiab - sgstAgainstSgst).toFixed(2));
    remSgstCredit = Number((remSgstCredit - sgstAgainstSgst).toFixed(2));

    const sgstAgainstIgst = Math.min(remIgstLiab, remSgstCredit);
    remIgstLiab = Number((remIgstLiab - sgstAgainstIgst).toFixed(2));
    remSgstCredit = Number((remSgstCredit - sgstAgainstIgst).toFixed(2));

    const netTaxPayable = {
      cgst: remCgstLiab,
      sgst: remSgstLiab,
      igst: remIgstLiab,
      total: Number((remCgstLiab + remSgstLiab + remIgstLiab).toFixed(2))
    };

    const itcClosingBalance = {
      cgst: remCgstCredit,
      sgst: remSgstCredit,
      igst: remIgstCredit,
      total: Number((remCgstCredit + remSgstCredit + remIgstCredit).toFixed(2))
    };

    // ─── General Ledger Tax Reconciliation ───
    const glTaxLegs = await Ledger.find({
      $or: [
        { firmId: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdObj },
        { firm_id: firmIdStr }
      ],
      isReversed: { $ne: true },
      transactionDate: { $gte: startDate, $lte: endDate },
      accountHead: {
        $in: [
          'CGST Payable', 'SGST Payable', 'IGST Payable', 'CGST Payable (RCM)', 'SGST Payable (RCM)', 'IGST Payable (RCM)',
          'CGST Input Credit', 'SGST Input Credit', 'IGST Input Credit'
        ]
      }
    }).lean();

    let glOutputTax = 0;
    let glInputItc = 0;
    for (const leg of glTaxLegs) {
      const head = String(leg.accountHead).toUpperCase();
      if (head.includes('PAYABLE')) {
        glOutputTax += (leg.creditAmount || 0) - (leg.debitAmount || 0);
      } else if (head.includes('INPUT CREDIT')) {
        glInputItc += (leg.debitAmount || 0) - (leg.creditAmount || 0);
      }
    }

    const glReconciliation = {
      gl_output_liability: Number(glOutputTax.toFixed(2)),
      gl_input_itc: Number(glInputItc.toFixed(2)),
      report_output_liability: Number((totalLiabCgst + totalLiabSgst + totalLiabIgst).toFixed(2)),
      report_eligible_itc: Number((totalItcCgst + totalItcSgst + totalItcIgst).toFixed(2)),
      isReconciled: Math.abs(glOutputTax - (totalLiabCgst + totalLiabSgst + totalLiabIgst)) < 1.00
    };

    const report = {
      period: { startDate, endDate },
      firmGstin,
      table_3_1_outward_supplies: {
        table_3_1_a_outward_taxable_supplies: {
          taxable_value: salesTaxable,
          cgst: salesCgst,
          sgst: salesSgst,
          igst: salesIgst,
          cess: 0
        },
        table_3_1_b_outward_zero_rated: {
          taxable_value: zeroRatedTaxable,
          cgst: 0,
          sgst: 0,
          igst: 0,
          cess: 0
        },
        table_3_1_d_inward_reverse_charge: {
          taxable_value: rcmTaxable,
          cgst: rcmCgst,
          sgst: rcmSgst,
          igst: rcmIgst,
          cess: 0
        }
      },
      table_4_eligible_itc: {
        table_4_a_3_inward_reverse_charge: {
          cgst: rcmCgst,
          sgst: rcmSgst,
          igst: rcmIgst,
          cess: 0
        },
        table_4_a_5_all_other_itc: {
          taxable_value: eligibleTaxable,
          cgst: normalPurchaseCgst,
          sgst: normalPurchaseSgst,
          igst: normalPurchaseIgst,
          cess: 0
        },
        table_4_c_net_itc_available: {
          cgst: totalItcCgst,
          sgst: totalItcSgst,
          igst: totalItcIgst,
          cess: 0
        },
        table_4_d_ineligible_itc_17_5: {
          cgst: ineligibleCgst,
          sgst: ineligibleSgst,
          igst: ineligibleIgst,
          cess: 0
        }
      },
      tax_liability: {
        gross_liability: {
          cgst: totalLiabCgst,
          sgst: totalLiabSgst,
          igst: totalLiabIgst,
          total: Number((totalLiabCgst + totalLiabSgst + totalLiabIgst).toFixed(2))
        },
        offsets: {
          igst_against_igst: igstAgainstIgst,
          igst_against_cgst: igstAgainstCgst,
          igst_against_sgst: igstAgainstSgst,
          cgst_against_cgst: cgstAgainstCgst,
          cgst_against_igst: cgstAgainstIgst,
          sgst_against_sgst: sgstAgainstSgst,
          sgst_against_igst: sgstAgainstIgst
        },
        net_payable_cash: netTaxPayable,
        itc_balance_carried_forward: itcClosingBalance
      },
      gl_reconciliation: glReconciliation
    };

    return {
      success: true,
      data: report
    };
  } catch (error: any) {
    console.error('GSTR3B report error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error generating GSTR-3B report'
    });
  }
});
