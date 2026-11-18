import mongoose from 'mongoose';
import Firm from '../../models/Firm';
import FirmSettings from '../../models/FirmSettings';
import { GST_STATE_CODE_MAP } from './gst-address-helper';

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

  const rawGst = firmLoc?.gst_number || firmGstin;
  const firmStateCode = (rawGst && /^\d{2}/.test(rawGst.trim()))
    ? rawGst.trim().substring(0, 2)
    : (firmLoc?.state_code || null);
  return { firmLoc, firmStateCode };
}

/* ── Resolve party location for GST ── */
export async function resolvePartyLocation(partyDoc: any, requestedGstin?: string) {
  let partyLoc = null;
  const locations: any[] = Array.isArray(partyDoc.gstLocations) ? partyDoc.gstLocations : [];

  if (requestedGstin && requestedGstin !== 'UNREGISTERED' && locations.length > 0) {
    partyLoc = locations.find((l: any) => l.gstin?.trim()?.toUpperCase() === requestedGstin.trim().toUpperCase());
  }

  if (!partyLoc && locations.length > 0) {
    partyLoc = locations.find((l: any) => l.isPrimary) || locations[0];
  }

  const gstin = partyLoc?.gstin || partyDoc.gstin || 'UNREGISTERED';
  let stateCode: string | null = null;
  let state: string | null = null;

  if (gstin && gstin !== 'UNREGISTERED' && /^\d{2}/.test(gstin.trim())) {
    stateCode = gstin.trim().substring(0, 2);
    state = (stateCode ? GST_STATE_CODE_MAP[stateCode] : null) || partyLoc?.state || partyDoc?.state || null;
  } else {
    stateCode = partyLoc?.stateCode || partyDoc?.stateCode || null;
    state = partyLoc?.state || partyDoc?.state || null;
  }
  
  return {
    name: partyDoc?.name || '',
    gstin,
    state,
    stateCode,
    address: partyLoc?.address || partyDoc?.address || '',
    pin: partyLoc?.pincode || partyDoc?.pin || ''
  };
}

export async function isGstEnabled(firmId: string | mongoose.Types.ObjectId) {
  const setting = await FirmSettings.findOne({ firmId, settingKey: 'gst_enabled' }).lean();
  return setting ? setting.settingValue === 'true' : true;
}
