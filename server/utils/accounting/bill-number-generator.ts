import mongoose from 'mongoose';
import BillSequence from '../../models/BillSequence';

export class BillNumberGenerator {
  static async getNextBillNumber(
    firmId: mongoose.Types.ObjectId,
    btype: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PROFORMA' | 'DELIVERY_NOTE'
  ): Promise<string> {
    const d = new Date();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const financialYear = month >= 4
      ? `${year}-${String(year + 1).slice(-2)}`
      : `${year - 1}-${String(year).slice(-2)}`;

    const sequence = await BillSequence.findOneAndUpdate(
      { firmId, btype } as any,
      { $inc: { lastNo: 1 } },
      { new: true, upsert: true }
    );

    const prefixMap: any = { SALES: 'SI', PURCHASE: 'PI', CREDIT_NOTE: 'CN', DEBIT_NOTE: 'DN', PROFORMA: 'PFI', DELIVERY_NOTE: 'DC' };
    const prefix = sequence.prefix || prefixMap[btype] || btype.slice(0, 2);
    const paddedNo = sequence.lastNo.toString().padStart(4, '0');
    
    return `${prefix}/${financialYear}/${paddedNo}`;
  }
}
