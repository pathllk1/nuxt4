import { defineEventHandler, getQuery, createError } from 'h3';
import { requireAuthSession } from '../../../../utils/auth';
import Bill from '../../../../models/Bill';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const firmIdObj = user.firm_id;
    const firmIdStr = String(firmIdObj);

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

    // 3.1 Outward supplies (Sales)
    const salesTaxable = salesBills.reduce((acc, b) => acc + (b.grossTotal || 0), 0);
    const salesCgst = salesBills.reduce((acc, b) => acc + (b.cgst || 0), 0);
    const salesSgst = salesBills.reduce((acc, b) => acc + (b.sgst || 0), 0);
    const salesIgst = salesBills.reduce((acc, b) => acc + (b.igst || 0), 0);

    // 4. Eligible ITC (Purchases)
    const purchaseTaxable = purchaseBills.reduce((acc, b) => acc + (b.grossTotal || 0), 0);
    const purchaseCgst = purchaseBills.reduce((acc, b) => acc + (b.cgst || 0), 0);
    const purchaseSgst = purchaseBills.reduce((acc, b) => acc + (b.sgst || 0), 0);
    const purchaseIgst = purchaseBills.reduce((acc, b) => acc + (b.igst || 0), 0);

    const report = {
      period: { startDate, endDate },
      firmGstin,
      table_3_1_outward_supplies: {
        taxable_value: salesTaxable,
        cgst: salesCgst,
        sgst: salesSgst,
        igst: salesIgst,
        cess: 0
      },
      table_4_eligible_itc: {
        taxable_value: purchaseTaxable,
        cgst: purchaseCgst,
        sgst: purchaseSgst,
        igst: purchaseIgst,
        cess: 0
      },
      tax_liability: {
        cgst_net: Math.max(0, salesCgst - purchaseCgst),
        sgst_net: Math.max(0, salesSgst - purchaseSgst),
        igst_net: Math.max(0, salesIgst - purchaseIgst),
        total_payable: Math.max(0, (salesCgst + salesSgst + salesIgst) - (purchaseCgst + purchaseSgst + purchaseIgst))
      }
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
