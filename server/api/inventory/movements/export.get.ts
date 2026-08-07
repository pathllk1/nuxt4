import { defineEventHandler, getQuery, setHeader } from 'h3';
import StockReg from '../../../models/StockReg';
import { requireAuthSession } from '../../../utils/auth';
import { exportStockMovementsToExcel } from '../../../utils/accounting/export-utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const filter: any = {
    $or: [{ firmId: session.firm_id }, { firm_id: session.firm_id as any }]
  };
  if (query.stockId) filter.stockId = query.stockId;
  if (query.type) filter.type = query.type;

  const movements = await StockReg.find(filter).sort({ bdate: -1, createdAt: -1 }).lean();
  const buffer = await exportStockMovementsToExcel(movements);

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  setHeader(event, 'Content-Disposition', 'attachment; filename="Stock_Movements.xlsx"');
  return buffer;
});
