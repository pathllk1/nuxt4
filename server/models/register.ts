import mongoose from 'mongoose';

import './Advance';
import './BankAccount';
import './Bill';
import './BillSequence';
import './ChartOfAccounts';
import './Contact';
import './Firm';
import './FirmSettings';
import './GstinCache';
import './Ledger';
import './MasterRoll';
import './OpeningBalance';
import './Party';
import './SecurityLog';
import './Session';
import './Stock';
import './StockReg';
import './TokenBlacklist';
import './User';
import './VoucherSequence';
import './Wage';
import './WageJob';

export const registerModels = (): Record<string, mongoose.Model<any>> => mongoose.models;

export default registerModels;
