import mongoose from 'mongoose';
import Stock from '../../models/Stock';
import type { IStock } from '../../models/Stock';
import StockReg from '../../models/StockReg';

const StockModel = Stock as any;
const StockRegModel = StockReg as any;

function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    const itemTrimmed = (itemData.item || '').trim();
    const escapedItem = escapeRegex(itemTrimmed);

    let stock = await StockModel.findOne({
      $and: [
        { $or: [{ firm_id: firmId }, { firmId: firmId }] },
        {
          $or: [
            { item: itemTrimmed },
            { item: { $regex: `^${escapedItem}$`, $options: 'i' } }
          ]
        }
      ]
    }).session(session || null);

    if (!stock) {
      try {
        stock = new Stock({
          firm_id: firmId,
          firmId: firmId,
          item: itemTrimmed || 'Generic Item',
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
      } catch (saveErr: any) {
        if (saveErr.code === 11000 || saveErr.message?.includes('E11000')) {
          stock = await StockModel.findOne({
            $and: [
              { $or: [{ firm_id: firmId }, { firmId: firmId }] },
              {
                $or: [
                  { item: itemTrimmed },
                  { item: { $regex: `^${escapedItem}$`, $options: 'i' } }
                ]
              }
            ]
          }).session(session || null);
          if (!stock) throw saveErr;
        } else {
          throw saveErr;
        }
      }
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

      if (targetBatch) {
        updateQuery.$push = {
          batches: {
            batch: targetBatch,
            qty: itemData.qty,
            rate: itemData.rate,
            grate: itemData.grate,
            uom: itemData.uom || 'PCS',
            expiry: (itemData as any).expiry ? new Date((itemData as any).expiry) : undefined,
            mrp: (itemData as any).mrp ? Number((itemData as any).mrp) : undefined
          }
        };
      }
    }

    const updatedStock = await StockModel.findOneAndUpdate(
      { _id: stock._id },
      updateQuery,
      {
        new: true,
        session: session || null,
        arrayFilters: arrayFilters.length > 0 ? arrayFilters : undefined
      }
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
    const itemTrimmed = (itemData.item || '').trim();
    const escapedItem = escapeRegex(itemTrimmed);

    let stock = null;
    if (itemData.stockId && mongoose.Types.ObjectId.isValid(String(itemData.stockId))) {
      stock = await StockModel.findOne({
        _id: new mongoose.Types.ObjectId(String(itemData.stockId)),
        $or: [{ firm_id: firmId }, { firmId: firmId }]
      }).session(session || null);
    }

    if (!stock && itemTrimmed) {
      stock = await StockModel.findOne({
        $and: [
          { $or: [{ firm_id: firmId }, { firmId: firmId }] },
          {
            $or: [
              { item: itemTrimmed },
              { item: { $regex: `^${escapedItem}$`, $options: 'i' } }
            ]
          }
        ]
      }).session(session || null);
    }

    if (!stock) {
      try {
        // Auto-create stock entry with 0 opening stock if sold before initial inward
        stock = new StockModel({
          firm_id: firmId,
          firmId: firmId,
          item: itemTrimmed || 'Generic Item',
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
      } catch (saveErr: any) {
        if (saveErr.code === 11000 || saveErr.message?.includes('E11000')) {
          stock = await StockModel.findOne({
            $and: [
              { $or: [{ firm_id: firmId }, { firmId: firmId }] },
              {
                $or: [
                  { item: itemTrimmed },
                  { item: { $regex: `^${escapedItem}$`, $options: 'i' } }
                ]
              }
            ]
          }).session(session || null);
          if (!stock) throw saveErr;
        } else {
          throw saveErr;
        }
      }
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
      { _id: stock._id },
      {
        $inc: incQuery,
        $set: {
          user: user,
          hsn: stock.hsn || itemData.hsn || '9999',
          uom: stock.uom || itemData.uom || 'PCS'
        }
      },
      {
        new: true,
        session: session || null,
        arrayFilters: arrayFilters.length > 0 ? arrayFilters : undefined
      }
    );

    if (!updatedStock) throw new Error(`Failed to deduct stock for item ${itemData.item}`);

    // Register movement in StockReg
    await StockRegModel.create([{
      firm_id: firmId,
      type: billData.btype as any,
      bno: billData.bno,
      bdate: billData.bdate,
      supply: billData.supply,
      item: itemTrimmed || itemData.item,
      item_narration: itemData.narration,
      batch: itemData.batch || undefined,
      qty: -itemData.qty,
      rate: itemData.rate,
      grate: itemData.grate,
      total: itemData.qty * itemData.rate,
      cost_rate: wacCostRate,
      stock_id: updatedStock._id,
      bill_id: billData.billId,
      user,
      qtyh: updatedStock.qty,
      hsn: itemData.hsn || updatedStock.hsn,
      uom: itemData.uom || updatedStock.uom || 'PCS'
    }], { session });

    return {
      stock: updatedStock,
      cogsValue
    };
  }

  /**
   * Adjust stock manually
   */
  static async adjustStock(params: {
    firmId: mongoose.Types.ObjectId,
    stockId: mongoose.Types.ObjectId,
    type: 'ADD' | 'SUBTRACT' | 'SET',
    qty: number,
    rate?: number,
    narration?: string,
    user: string,
    session?: mongoose.ClientSession
  }): Promise<IStock> {
    const { firmId, stockId, type, qty, rate, narration, user, session } = params;

    const stock = await StockModel.findOne({
      _id: stockId,
      $or: [{ firm_id: firmId }, { firmId: firmId }]
    }).session(session || null);

    if (!stock) throw new Error('Stock item not found');

    let newQty = stock.qty;
    let newRate = stock.rate;

    if (type === 'ADD') {
      newQty += qty;
      if (rate !== undefined && newQty > 0) {
        const addedValue = qty * rate;
        newRate = this.roundRate((stock.total + addedValue) / newQty);
      }
    } else if (type === 'SUBTRACT') {
      newQty -= qty;
    } else if (type === 'SET') {
      newQty = qty;
      if (rate !== undefined) newRate = rate;
    }

    const newTotal = newQty * newRate;

    const updatedStock = await StockModel.findOneAndUpdate(
      { _id: stock._id },
      {
        $set: {
          qty: newQty,
          rate: newRate,
          total: newTotal,
          user: user
        }
      },
      { new: true, session: session || null }
    );

    if (!updatedStock) throw new Error('Failed to update stock');

    const diffQty = newQty - stock.qty;
    await StockRegModel.create([{
      firm_id: firmId,
      type: 'ADJUSTMENT',
      bno: 'ADJ',
      bdate: new Date().toISOString().split('T')[0],
      supply: 'Stock Adjustment',
      item: stock.item,
      item_narration: narration,
      qty: diffQty,
      rate: newRate,
      grate: stock.grate,
      total: Math.abs(diffQty) * newRate,
      cost_rate: newRate,
      stock_id: updatedStock._id,
      user,
      qtyh: updatedStock.qty,
      hsn: stock.hsn,
      uom: stock.uom
    }], { session });

    return updatedStock;
  }

  /**
   * Reverses an individual stock movement from StockReg
   */
  static async reverseMovement(
    stockRegId: mongoose.Types.ObjectId,
    user: string,
    session?: mongoose.ClientSession
  ): Promise<void> {
    const reg = await StockRegModel.findById(stockRegId).session(session || null);
    if (!reg || !reg.stock_id) return;

    const stock = await StockModel.findById(reg.stock_id).session(session || null);
    if (!stock) return;

    const reverseQty = -reg.qty;
    const newQty = stock.qty + reverseQty;
    let newTotal = stock.total;

    if (reg.qty > 0) {
      const inwardVal = reg.qty * (reg.rate || stock.rate || 0);
      newTotal = Math.max(0, stock.total - inwardVal);
    } else {
      const outwardVal = Math.abs(reg.qty) * (reg.cost_rate || stock.rate || 0);
      newTotal = stock.total + outwardVal;
    }

    const newRate = newQty > 0 ? this.roundRate(newTotal / newQty) : stock.rate;

    await StockModel.findByIdAndUpdate(
      stock._id,
      {
        $set: {
          qty: newQty,
          rate: newRate,
          total: newTotal,
          user
        }
      },
      { session: session || null }
    );

    await StockRegModel.findByIdAndDelete(stockRegId, { session: session || null });
  }

  /**
   * Rollback stock movement for edited sales or deliveries
   */
  static async rollbackStockMovement(params: {
    firmId: mongoose.Types.ObjectId;
    movementType: string;
    itemData: {
      stockId?: mongoose.Types.ObjectId;
      qty: number;
      rate?: number;
      batch?: string;
    };
    session?: mongoose.ClientSession;
  }): Promise<void> {
    if (!params.itemData.stockId) return;
    const stock = await StockModel.findById(params.itemData.stockId).session(params.session || null);
    if (!stock) return;

    const absQty = Math.abs(params.itemData.qty);
    const newQty = stock.qty + absQty;
    const addedVal = absQty * (stock.rate || params.itemData.rate || 0);
    const newTotal = stock.total + addedVal;
    const newRate = newQty > 0 ? this.roundRate(newTotal / newQty) : stock.rate;

    await StockModel.findByIdAndUpdate(
      stock._id,
      {
        $set: {
          qty: newQty,
          rate: newRate,
          total: newTotal
        }
      },
      { session: params.session || null }
    );
  }
}
