import mongoose from 'mongoose';
import Party from '../../../models/Party';
import { resolveLedgerPostingAccount } from '../../../utils/accounting/ledger-account-resolver';
import { OpeningBalanceService } from '../../../utils/accounting/opening-balance.service';
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

  const prevParty = await (Party as any).findOne({
    _id: new mongoose.Types.ObjectId(partyId),
    firmId: firmIdObj
  }).lean();

  if (!prevParty) {
    throw createError({ statusCode: 404, statusMessage: 'Party not found' });
  }

  const duplicate = await (Party as any).findOne({
    firmId: firmIdObj,
    name,
    _id: { $ne: new mongoose.Types.ObjectId(partyId) }
  }).lean();
  if (duplicate) {
    throw createError({ statusCode: 400, statusMessage: 'Party with this name already exists' });
  }

  const partyType = String(body.partyType || prevParty.partyType || 'CUSTOMER').toUpperCase();
  const fallbackType = partyType === 'SUPPLIER' ? 'SUNDRY_CREDITORS' : 'SUNDRY_DEBTORS';

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
        balanceType: body.balanceType || prevParty.balanceType || (partyType === 'SUPPLIER' ? 'CR' : 'DR')
      }
    },
    { returnDocument: 'after', runValidators: true }
  );

  // If party name changed, rename in GL and OB
  if (prevParty.name && prevParty.name !== name) {
    await OpeningBalanceService.renameAccountHead({
      firmId: firmIdObj,
      oldHead: prevParty.name,
      newHead: name
    });
  }

  // Sync Opening Balance into GL & OpeningBalance collection
  if (body.openingBalance !== undefined) {
    const obAmount = parseFloat(body.openingBalance) || 0;
    const obBalanceType = body.balanceType || updated.balanceType || (partyType === 'SUPPLIER' ? 'CR' : 'DR');
    await OpeningBalanceService.syncOpeningBalance({
      firmId: firmIdObj,
      accountHead: updated.name,
      accountType: fallbackType,
      amount: obAmount,
      balanceType: obBalanceType,
      partyId: updated._id,
      userId: String(user._id)
    });
  }

  await resolveLedgerPostingAccount({
    firmId: firmIdObj,
    accountHead: updated.name,
    fallbackType,
    partyId: updated._id
  });

  return { success: true, message: 'Party updated successfully', data: updated };
});