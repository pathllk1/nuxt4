import mongoose from 'mongoose';
import Stock from '../../models/Stock';
import type { IStock } from '../../models/Stock';
import StockReg from '../../models/StockReg';

const StockModel = Stock as any;
const StockRegModel = StockReg as any;

export class StockService {
  /**
   * Round inventory rates to 6 decimal places for precision
   */
  private static roundRate(value: number): number {
    return Number(Number(value).toFixed(6));
  }

  /**
   * Atomic stock increase (Purchase / Sales Return / Credit Note)
   */
  static async updateStockInward(params: {
    firmId: mongoose.Types.ObjectId,
    itemData: {
      stockId?: mongoose.Types.ObjectId;
      item: string;
      hsn: string;
      qty: number;
      rate: number; // Unit cost (after discount)
      grate: number;
      batch?: string;
      uom: string;
      pno?: string;
      oem?: string;
      narration?: string;
    },
    billData: { bno: string; bdate: string; supply: string; billId: mongoose.Types.ObjectId; btype: string },
    user: string,
    session?: mongoose.ClientSession
  }): Promise<IStock> {
    const { firmId, itemData, billData, user, session } = params;

    let stock = await StockModel.findOne({
      $or: [{ firm_id: firmId }, { firmId: firmId }],
      item: itemData.item
    }).session(session || null);

    if (!stock) {
      stock = new Stock({
        firm_id: firmId,
        item: itemData.item,
        pno: itemData.pno,
        oem: itemData.oem,
        hsn: itemData.hsn,
        uom: itemData.uom || 'PCS',
        qty: 0,
        rate: 0,
        total: 0,
        createdBy: user,
      });
      await stock.save({ session });
    } else {
      if (itemData.hsn && !stock.hsn) stock.hsn = itemData.hsn;
      if (itemData.pno && !stock.pno) stock.pno = itemData.pno;
      if (itemData.oem && !stock.oem) stock.oem = itemData.oem;
    }

    const currentQty = stock.qty;
    const currentTotal = stock.total;
    const incomingQty = itemData.qty;
    const lineValue = incomingQty * itemData.rate;

    const newQty = currentQty + incomingQty;
    const newTotal = currentTotal + lineValue;

    const blendedRate = newQty > 0
      ? this.roundRate(newTotal / newQty)
      : itemData.rate;

    const targetBatch = itemData.batch || null;
    const batchExists = Array.isArray(stock.batches) && stock.batches.some((b: any) => (b.batch || null) === targetBatch);

    let updateQuery: any;
    let arrayFilters: any[] = [];

    if (batchExists) {
      updateQuery = {
        $inc: {
          'qty': itemData.qty,
          'total': lineValue,
          'batches.$[elem].qty': itemData.qty
        },
        $set: {
          rate: blendedRate,
          grate: itemData.grate,
          'batches.$[elem].rate': itemData.rate,
          'batches.$[elem].grate': itemData.grate,
          user: user
        }
      };
      arrayFilters = [{ 'elem.batch': targetBatch }];
    } else {
      updateQuery = {
        $push: {
          batches: {
            batch: itemData.batch || undefined,
            qty: itemData.qty,
            uom: itemData.uom || 'PCS',
            rate: itemData.rate,
            grate: itemData.grate,
            expiry: (itemData as any).expiry || null,
            mrp: (itemData as any).mrp || 0
          }
        },
        $inc: {
          'qty': itemData.qty,
          'total': lineValue
        },
        $set: {
          rate: blendedRate,
          grate: itemData.grate,
          user: user
        }
      };
    }

    const updatedStock = await StockModel.findOneAndUpdate(
      { _id: stock._id, $or: [{ firm_id: firmId }, { firmId: firmId }] },
      updateQuery,
      { session, ...(arrayFilters.length ? { arrayFilters } : {}), returnDocument: 'after' }
    );

    if (!updatedStock) throw new Error(`Failed to update stock for item ${itemData.item}`);

    if (updatedStock.qty <= 0) {
      updatedStock.total = 0;
      await updatedStock.save({ session });
    }

    // Register movement
    await StockRegModel.create([{
      firm_id: firmId,
      type: billData.btype as any,
      bno: billData.bno,
      bdate: billData.bdate,
      supply: billData.supply,
      item: itemData.item,
      item_narration: itemData.narration,
      batch: itemData.batch || undefined,
      qty: itemData.qty,
      rate: itemData.rate,
      grate: itemData.grate,
      total: lineValue,
      cost_rate: itemData.rate,
      stock_id: updatedStock._id,
      bill_id: billData.billId,
      user,
      qtyh: updatedStock.qty,
      hsn: itemData.hsn,
      uom: itemData.uom || 'PCS'
    }], { session });

    return updatedStock;
  }

  /**
   * Atomic stock decrease (Sale / Purchase Return / Debit Note / Delivery Note)
   */
  static async updateStockOutward(params: {
    firmId: mongoose.Types.ObjectId,
    itemData: {
      stockId?: mongoose.Types.ObjectId | string;
      item: string;
      qty: number;
      rate: number; // Selling price
      grate: number;
      batch?: string;
      narration?: string;
      hsn?: string;
      uom?: string;
      pno?: string;
      oem?: string;
    },
    billData: { bno: string; bdate: string; supply: string; billId: mongoose.Types.ObjectId; btype: string },
    user: string,
    session?: mongoose.ClientSession
  }): Promise<{ stock: IStock, cogsValue: number }> {
    const { firmId, itemData, billData, user, session } = params;

    let stock = null;
    if (itemData.stockId && mongoose.Types.ObjectId.isValid(String(itemData.stockId))) {
      stock = await StockModel.findOne({
        _id: new mongoose.Types.ObjectId(String(itemData.stockId)),
        $or: [{ firm_id: firmId }, { firmId: firmId }]
      }).session(session || null);
    }

    if (!stock && itemData.item) {
      stock = await StockModel.findOne({
        item: { $regex: new RegExp(`^${itemData.item.trim()}$`, 'i') },
        $or: [{ firm_id: firmId }, { firmId: firmId }]
      }).session(session || null);
    }

    if (!stock) {
      // Auto-create stock entry with 0 opening stock if sold before initial inward
      stock = new StockModel({
        firm_id: firmId,
        item: itemData.item || 'Generic Item',
        pno: itemData.pno || '',
        oem: itemData.oem || '',
        hsn: itemData.hsn || '9999',
        uom: itemData.uom || 'PCS',
        qty: 0,
        rate: itemData.rate || 0,
        grate: itemData.grate || 18,
        total: 0,
        batches: itemData.batch ? [{ batch: itemData.batch, qty: 0, uom: itemData.uom || 'PCS', rate: itemData.rate || 0, grate: itemData.grate || 18 }] : [],
        user: user
      });
      await stock.save({ session });
    }

    const wacCostRate = stock.rate || itemData.rate || 0;
    const cogsValue = itemData.qty * wacCostRate;

    const targetBatch = itemData.batch || null;
    const batchExists = Array.isArray(stock.batches) && stock.batches.some((b: any) => (b.batch || null) === targetBatch);

    const incQuery: any = {
      'qty': -itemData.qty,
      'total': -cogsValue
    };
    let arrayFilters: any[] = [];
    if (batchExists) {
      incQuery['batches.$[elem].qty'] = -itemData.qty;
      arrayFilters = [{ 'elem.batch': targetBatch }];
    }

    const updatedStock = await StockModel.findOneAndUpdate(
      { _id: stock._id, $or: [{ firm_id: firmId }, { firmId: firmId }] },
      {
        $inc: incQuery,
        $set: { user }
      },
      { 
        session, 
        ...(arrayFilters.length ? { arrayFilters } : {}),
        returnDocument: 'after' 
      }
    );

    if (!updatedStock) throw new Error(`Failed to update stock for item ${stock.item}.`);

    if (updatedStock.qty <= 0) {
      updatedStock.total = 0;
      await updatedStock.save({ session });
    }

    // Register movement
    await StockRegModel.create([{
      firm_id: firmId,
      type: billData.btype as any,
      bno: billData.bno,
      bdate: billData.bdate,
      supply: billData.supply,
      item: stock.item,
      item_narration: itemData.narration,
      batch: itemData.batch || undefined,
      qty: -itemData.qty,
      rate: itemData.rate,
      grate: itemData.grate,
      total: itemData.qty * itemData.rate,
      cost_rate: wacCostRate,
      stock_id: stock._id,
      bill_id: billData.billId,
      user,
      qtyh: updatedStock.qty,
      hsn: stock.hsn,
      uom: stock.uom
    }], { session });

    return { stock: updatedStock, cogsValue };
  }

  /**
   * Reverse a stock movement (Bill Cancellation / Bill Edit)
   */
  static async reverseMovement(stockRegId: mongoose.Types.ObjectId, user: string, session?: mongoose.ClientSession) {
    const reg = await StockRegModel.findById(stockRegId).session(session || null);
    if (!reg) return;

    const stock = await StockModel.findById(reg.stock_id).session(session || null);
    const targetBatch = reg.batch || null;
    const batchExists = stock && Array.isArray(stock.batches) && stock.batches.some((b: any) => (b.batch || null) === targetBatch);

    if (['PURCHASE', 'CREDIT_NOTE'].includes(reg.type)) {
      // Was an increase, now decrease
      const costValue = reg.qty * (reg.cost_rate || 0);
      const incQuery: any = { 'qty': -reg.qty, 'total': -costValue };
      let arrayFilters: any[] = [];
      if (batchExists) {
        incQuery['batches.$[elem].qty'] = -reg.qty;
        arrayFilters = [{ 'elem.batch': targetBatch }];
      }

      const updated = await StockModel.findOneAndUpdate(
        { _id: reg.stock_id, $or: [{ firm_id: reg.firm_id }, { firmId: reg.firm_id }] },
        { $inc: incQuery, $set: { user } },
        { session, ...(arrayFilters.length ? { arrayFilters } : {}), returnDocument: 'after' }
      );
      if (updated && updated.qty <= 0) {
        updated.total = 0;
        await updated.save({ session });
      }
    } else if (['SALE', 'DEBIT_NOTE', 'DELIVERY_NOTE'].includes(reg.type)) {
      // Was a decrease, now increase
      const cogsValue = Math.abs(reg.qty) * (reg.cost_rate || 0);
      const incQuery: any = { 'qty': Math.abs(reg.qty), 'total': cogsValue };
      let arrayFilters: any[] = [];
      if (batchExists) {
        incQuery['batches.$[elem].qty'] = Math.abs(reg.qty);
        arrayFilters = [{ 'elem.batch': targetBatch }];
      }

      await StockModel.findOneAndUpdate(
        { _id: reg.stock_id, $or: [{ firm_id: reg.firm_id }, { firmId: reg.firm_id }] },
        { $inc: incQuery, $set: { user } },
        { session, ...(arrayFilters.length ? { arrayFilters } : {}), returnDocument: 'after' }
      );
    }

    await StockRegModel.findByIdAndDelete(stockRegId).session(session || null);
  }

  /**
   * Helper to rollback a specific stock movement by parameters
   */
  static async rollbackStockMovement(params: {
    firmId: mongoose.Types.ObjectId;
    movementType: 'SALE' | 'PURCHASE';
    itemData: {
      stockId: mongoose.Types.ObjectId;
      qty: number;
      rate: number;
      batch?: string;
    };
    session?: mongoose.ClientSession;
  }) {
    const { firmId, movementType, itemData, session } = params;
    const stock = await StockModel.findOne({ _id: itemData.stockId, $or: [{ firm_id: firmId }, { firmId: firmId }] }).session(session || null);
    if (!stock) return;

    const targetBatch = itemData.batch || null;
    const batchExists = Array.isArray(stock.batches) && stock.batches.some((b: any) => (b.batch || null) === targetBatch);

    if (movementType === 'SALE') {
      const cogsValue = itemData.qty * (stock.rate || itemData.rate || 0);
      const incQuery: any = { 'qty': itemData.qty, 'total': cogsValue };
      let arrayFilters: any[] = [];
      if (batchExists) {
        incQuery['batches.$[elem].qty'] = itemData.qty;
        arrayFilters = [{ 'elem.batch': targetBatch }];
      }

      await StockModel.findOneAndUpdate(
        { _id: stock._id, $or: [{ firm_id: firmId }, { firmId: firmId }] },
        { $inc: incQuery },
        { session, ...(arrayFilters.length ? { arrayFilters } : {}), returnDocument: 'after' }
      );
    } else if (movementType === 'PURCHASE') {
      const lineValue = itemData.qty * itemData.rate;
      const incQuery: any = { 'qty': -itemData.qty, 'total': -lineValue };
      let arrayFilters: any[] = [];
      if (batchExists) {
        incQuery['batches.$[elem].qty'] = -itemData.qty;
        arrayFilters = [{ 'elem.batch': targetBatch }];
      }

      const updated = await StockModel.findOneAndUpdate(
        { _id: stock._id, $or: [{ firm_id: firmId }, { firmId: firmId }] },
        { $inc: incQuery },
        { session, ...(arrayFilters.length ? { arrayFilters } : {}), returnDocument: 'after' }
      );

      if (updated && updated.qty <= 0) {
        updated.total = 0;
        await updated.save({ session });
      }
    }
  }
}
