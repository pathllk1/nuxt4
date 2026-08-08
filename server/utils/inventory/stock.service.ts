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
      if (itemData.pno && !stock.pno) stock.pno = itemData.pno;
      if (itemData.oem && !stock.oem) stock.oem = itemData.oem;
      if (itemData.hsn) stock.hsn = itemData.hsn;
      if (itemData.uom) stock.uom = itemData.uom;
      await stock.save({ session });
    }

    const lineValue = itemData.qty * itemData.rate;
    const newQty = stock.qty + itemData.qty;
    const newTotal = stock.total + lineValue;
    const blendedRate = newQty > 0 ? this.roundRate(newTotal / newQty) : stock.rate;

    const targetBatch = itemData.batch || null;
    const batchExists = Array.isArray(stock.batches) && stock.batches.some((b: any) => (b.batch || null) === targetBatch);

    let updateQuery: any;
    let arrayFilters: any[] = [];

    if (batchExists) {
      updateQuery = {
        $inc: {
          'batches.$[elem].qty': itemData.qty,
          'qty': itemData.qty,
          'total': lineValue
        },
        $set: {
          'batches.$[elem].expiry': (itemData as any).expiry || null,
          'batches.$[elem].mrp': (itemData as any).mrp || 0,
          rate: blendedRate,
          grate: itemData.grate,
          user: user
        }
      };
      arrayFilters = [{ 'elem.batch': targetBatch }];
    } else {
      updateQuery = {
        $push: {
          batches: {
            batch: targetBatch,
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
      { _id: stock._id, firm_id: firmId },
      updateQuery,
      { session, ...(arrayFilters.length ? { arrayFilters } : {}), new: true }
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
      stockId: mongoose.Types.ObjectId;
      qty: number;
      rate: number; // Selling price
      grate: number;
      batch?: string;
      narration?: string;
    },
    billData: { bno: string; bdate: string; supply: string; billId: mongoose.Types.ObjectId; btype: string },
    user: string,
    session?: mongoose.ClientSession
  }): Promise<{ stock: IStock, cogsValue: number }> {
    const { firmId, itemData, billData, user, session } = params;

    const stock = await StockModel.findOne({ _id: itemData.stockId, firm_id: firmId }).session(session || null);
    if (!stock) throw new Error(`Stock record not found for ID: ${itemData.stockId}`);

    const wacCostRate = stock.rate;
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
      { _id: stock._id, firm_id: firmId },
      {
        $inc: incQuery,
        $set: { user }
      },
      { 
        session, 
        ...(arrayFilters.length ? { arrayFilters } : {}),
        new: true 
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
        { _id: reg.stock_id, firm_id: reg.firm_id },
        { $inc: incQuery, $set: { user } },
        { session, ...(arrayFilters.length ? { arrayFilters } : {}), new: true }
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
        { _id: reg.stock_id, firm_id: reg.firm_id },
        { $inc: incQuery, $set: { user } },
        { session, ...(arrayFilters.length ? { arrayFilters } : {}) }
      );
    }
  }
}
