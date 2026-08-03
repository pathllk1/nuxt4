import mongoose from 'mongoose';
import Party from '../../../models/Party';
import { resolveLedgerPostingAccount } from '../../../utils/accounting/ledger-account-resolver';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const partyId = event.context.params?.id;

  if (!partyId || !mongoose.Types.ObjectId.isValid(partyId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid party ID' });
  }

  const body = await readBody(event) || {};
  if (!body.name) {
    throw createError({ statusCode: 400, statusMessage: 'Party name is required' });
  }

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const name = String(body.name).trim();

  const duplicate = await (Party as any).findOne({
    firmId: firmIdObj,
    name,
    _id: { $ne: new mongoose.Types.ObjectId(partyId) }
  }).lean();
  if (duplicate) {
    throw createError({ statusCode: 400, statusMessage: 'Party with this name already exists' });
  }

  const partyType = String(body.partyType || 'CUSTOMER').toUpperCase();
  const updated = await (Party as any).findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(partyId), firmId: firmIdObj },
    {
      $set: {
        name,
        gstin: body.gstin || 'UNREGISTERED',
        contact: body.contact,
        state: body.state,
        stateCode: body.stateCode,
        address: body.address,
        pin: body.pin,
        pan: body.pan,
        gstLocations: body.gstLocations || [],
        primaryGstinIndex: Number(body.primaryGstinIndex) || 0,
        partyType,
        openingBalance: parseFloat(body.openingBalance) || 0,
        balanceType: body.balanceType || 'DR'
      }
    },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Party not found' });
  }

  await resolveLedgerPostingAccount({
    firmId: firmIdObj,
    accountHead: updated.name,
    fallbackType: partyType === 'SUPPLIER' ? 'SUNDRY_CREDITORS' : 'SUNDRY_DEBTORS',
    partyId: updated._id
  });

  return { success: true, message: 'Party updated successfully', data: updated };
});