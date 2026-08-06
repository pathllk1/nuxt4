import { defineEventHandler, getQuery, setHeader, createError } from 'h3';
import { requireAuthSession } from '../../../../../utils/auth';
import Bill from '../../../../../models/Bill';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const firmIdObj = user.firm_id;
    const firmIdStr = String(firmIdObj);

    const query = getQuery(event);
    const startDate = query.startDate ? String(query.startDate) : '';
    const endDate = query.endDate ? String(query.endDate) : '';
    const firmGstin = query.firmGstin ? String(query.firmGstin) : '';

    const filter: any = {
      $or: [
        { firmId: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdObj },
        { firm_id: firmIdStr }
      ],
      btype: 'SALES',
      status: { $ne: 'CANCELLED' }
    };
    if (startDate && endDate) filter.bdate = { $gte: startDate, $lte: endDate };
    if (firmGstin) filter.firmGstin = firmGstin;

    const bills = await Bill.find(filter).lean();

    const gstr1ExportData = {
      gstin: firmGstin,
      fp: startDate ? startDate.substring(0, 7).replace('-', '') : '',
      b2b: bills.filter(b => b.partyGstin && b.partyGstin !== 'UNREGISTERED').map(b => ({
        ctin: b.partyGstin,
        inv: [{
          inum: b.bno,
          idt: b.bdate,
          val: b.netTotal,
          pos: b.partyStateCode || '00',
          rchrg: b.reverseCharge ? 'Y' : 'N',
          inv_typ: 'R',
          itms: [{
            num: 1,
            itm_det: {
              txval: b.grossTotal,
              rt: ((b.cgst || 0) + (b.sgst || 0) + (b.igst || 0)) > 0 ? 18 : 0,
              iamt: b.igst || 0,
              camt: b.cgst || 0,
              samt: b.sgst || 0,
              csamt: 0
            }
          }]
        }]
      })),
      b2cs: bills.filter(b => !b.partyGstin || b.partyGstin === 'UNREGISTERED').map(b => ({
        sply_ty: 'INTRA',
        pos: b.partyStateCode || '00',
        txval: b.grossTotal,
        rt: 18,
        iamt: b.igst || 0,
        camt: b.cgst || 0,
        samt: b.sgst || 0
      }))
    };

    setHeader(event, 'Content-Type', 'application/json');
    setHeader(event, 'Content-Disposition', `attachment; filename="GSTR1_${firmGstin}_${startDate}.json"`);

    return JSON.stringify(gstr1ExportData, null, 2);
  } catch (error: any) {
    console.error('Export GSTR1 JSON error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting GSTR1 JSON'
    });
  }
});
