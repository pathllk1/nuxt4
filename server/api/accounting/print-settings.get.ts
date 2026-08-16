import mongoose from 'mongoose';
import FirmSettings from '../../models/FirmSettings';
import BankAccount from '../../models/BankAccount';
import Firm from '../../models/Firm';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));

  // 1. Fetch all active bank accounts for this firm
  const bankAccounts = await BankAccount.find({
    $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
    status: 'ACTIVE'
  }).select('_id account_name account_holder_name bank_name branch_name account_number ifsc_code upi_id is_default').lean();

  // 2. Fetch firm details
  const firm = await Firm.findById(firmIdObj).select('name city state gstin').lean();

  // 3. Fetch saved print settings from FirmSettings
  const settingDocs = await FirmSettings.find({
    firmId: firmIdObj,
    settingKey: { $regex: '^print_' }
  }).lean();

  const settingsMap: Record<string, string> = {};
  settingDocs.forEach(s => {
    settingsMap[s.settingKey.replace('print_', '')] = s.settingValue;
  });

  // Default values
  const defaultBank = bankAccounts.find(b => b.is_default) || bankAccounts[0] || null;
  const defaultJurisdiction = firm?.city ? `Subject to ${firm.city} Jurisdiction only.` : 'Subject to local jurisdiction only.';

  const printConfig = {
    showHsn: settingsMap.showHsn !== 'false',
    showQty: settingsMap.showQty !== 'false',
    showUom: settingsMap.showUom !== 'false',
    showRate: settingsMap.showRate !== 'false',
    showDisc: settingsMap.showDisc !== 'false',
    showGst: settingsMap.showGst !== 'false',
    showBatch: settingsMap.showBatch !== 'false',
    showNarration: settingsMap.showNarration !== 'false',
    showBank: settingsMap.showBank !== 'false',
    defaultBankAccountId: settingsMap.defaultBankAccountId || (defaultBank ? String(defaultBank._id) : ''),
    jurisdiction: settingsMap.jurisdiction || defaultJurisdiction,
    terms: settingsMap.terms ? JSON.parse(settingsMap.terms) : [
      '1. Goods once sold will not be taken back.',
      '2. Subject to local jurisdiction only.',
      '3. E. & O.E.'
    ],
    declaration: settingsMap.declaration || 'Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged.',
    signatoryTitle: settingsMap.signatoryTitle || `For ${firm?.name || 'Company Name'} — Authorised Signatory`,
    defaultCopyType: settingsMap.defaultCopyType || 'ORIGINAL FOR RECIPIENT',
  };

  return {
    success: true,
    data: {
      printConfig,
      bankAccounts,
      firm
    }
  };
});
