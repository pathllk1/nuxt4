import mongoose from 'mongoose';
import Party from '../../models/Party';
import { resolveLedgerPostingAccount } from '../../utils/accounting/ledger-account-resolver';
import { OpeningBalanceService } from '../../utils/accounting/opening-balance.service';
import { requireAuthSession } from '../../utils/auth';
import { GST_STATE_CODE_MAP } from '../../utils/accounting/gst-address-helper';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};

  if (!body.name) {
    throw createError({ statusCode: 400, statusMessage: 'Party name is required' });
  }

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));

  const existing = await Party.findOne({ firmId: firmIdObj, name: body.name.trim() }).lean();
  if (existing) {
    throw createError({ statusCode: 400, statusMessage: 'Party with this name already exists' });
  }

  const partyType = (body.partyType || 'CUSTOMER').toUpperCase();
  const fallbackType = partyType === 'SUPPLIER' ? 'SUNDRY_CREDITORS' : 'SUNDRY_DEBTORS';

  const rawGstin = (body.gstin || 'UNREGISTERED').toUpperCase().trim();
  const pSc = rawGstin && /^\d{2}/.test(rawGstin) && rawGstin !== 'UNREGISTERED' ? rawGstin.substring(0, 2) : '';
  const pState = (pSc && GST_STATE_CODE_MAP[pSc]) ? GST_STATE_CODE_MAP[pSc] : body.state;
  const pStateCode = pSc || body.stateCode;

  const cleanGstLocations = (body.gstLocations || []).map((loc: any) => {
    const locGstin = (loc.gstin || '').toUpperCase().trim();
    if (locGstin && /^\d{2}/.test(locGstin) && locGstin !== 'UNREGISTERED') {
      const sc = locGstin.substring(0, 2);
      return {
        ...loc,
        gstin: locGstin,
        stateCode: sc,
        state: GST_STATE_CODE_MAP[sc] || loc.state
      };
    }
    return loc;
  });

  const party = await Party.create({
    firmId: firmIdObj,
    name: body.name.trim(),
    gstin: rawGstin,
    contact: body.contact,
    state: pState,
    stateCode: pStateCode,
    address: body.address,
    pin: body.pin,
    pan: body.pan,
    gstLocations: cleanGstLocations,
    partyType,
    openingBalance: parseFloat(body.openingBalance) || 0,
    balanceType: body.balanceType || 'DR',
    createdBy: user.username || user.email || 'system'
  });

  // Provision in Chart of Accounts
  await resolveLedgerPostingAccount({
    firmId: firmIdObj,
    accountHead: party.name,
    fallbackType,
    partyId: party._id
  });

  // Sync Opening Balance into GL & OpeningBalance collection
  const openingBalance = parseFloat(body.openingBalance) || 0;
  if (openingBalance > 0) {
    const defaultBalanceType = partyType === 'SUPPLIER' ? 'CR' : 'DR';
    await OpeningBalanceService.syncOpeningBalance({
      firmId: firmIdObj,
      accountHead: party.name,
      accountType: fallbackType,
      amount: openingBalance,
      balanceType: body.balanceType || defaultBalanceType,
      partyId: party._id,
      userId: String(user._id)
    });
  }

  return {
    success: true,
    message: 'Party created and registered in Chart of Accounts',
    data: party
  };
});
