import mongoose from 'mongoose';
import Party from '../../models/Party';
import { resolveLedgerPostingAccount } from '../../utils/accounting/ledger-account-resolver';
import { requireAuthSession } from '../../utils/auth';

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

  const party = await Party.create({
    firmId: firmIdObj,
    name: body.name.trim(),
    gstin: body.gstin || 'UNREGISTERED',
    contact: body.contact,
    state: body.state,
    stateCode: body.stateCode,
    address: body.address,
    pin: body.pin,
    pan: body.pan,
    gstLocations: body.gstLocations || [],
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

  return {
    success: true,
    message: 'Party created and registered in Chart of Accounts',
    data: party
  };
});
