import mongoose from 'mongoose';
import Firm from '../../models/Firm';
import FirmSettings from '../../models/FirmSettings';

/* ── Resolve firm location for GST ── */
export async function resolveFirmLocation(firmId: string | mongoose.Types.ObjectId, firmGstin?: string) {
  const firmDoc = await Firm.findById(firmId).lean();
  const locations = (firmDoc as any)?.locations || [];
  let firmLoc = null;

  if (firmGstin) {
    firmLoc = locations.find((l: any) => l.gst_number === firmGstin);
    if (!firmLoc) throw new Error(`Firm GSTIN ${firmGstin} not found in firm registrations`);
  } else {
    firmLoc = locations.find((l: any) => l.is_default) || locations[0] || null;
  }

  const firmStateCode = firmLoc?.state_code || firmLoc?.gst_number?.substring(0, 2) || null;
  return { firmLoc, firmStateCode };
}

/* ── Resolve party location for GST ── */
export async function resolvePartyLocation(partyDoc: any, requestedGstin?: string) {
  let partyLoc = null;
  if (requestedGstin && Array.isArray(partyDoc.gstLocations)) {
    partyLoc = partyDoc.gstLocations.find((l: any) => l.gstin === requestedGstin);
    if (!partyLoc) throw new Error(`Party GSTIN ${requestedGstin} not found`);
  }

  const gstin = partyLoc?.gstin || partyDoc.gstin || 'UNREGISTERED';
  const stateCode = partyLoc?.stateCode || partyDoc.stateCode || (gstin !== 'UNREGISTERED' ? gstin.substring(0, 2) : null);
  
  return {
    gstin,
    state: partyLoc?.state || partyDoc.state,
    stateCode,
    address: partyLoc?.address || partyDoc.address,
    pin: partyLoc?.pincode || partyDoc.pin
  };
}

export async function isGstEnabled(firmId: string | mongoose.Types.ObjectId) {
  const setting = await FirmSettings.findOne({ firmId, settingKey: 'gst_enabled' }).lean();
  return setting ? setting.settingValue === 'true' : true;
}
