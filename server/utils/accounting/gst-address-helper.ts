export const GST_STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory'
};

export interface ExtractedGstDetails {
  gstin: string;
  tradeName: string;
  legalName: string;
  displayName: string;
  address: string;
  state: string;
  stateCode: string;
  pincode: string;
  pan: string;
  status: string;
  natureOfBusiness: string[];
}

/**
 * Robust extractor for all GST response formats (RapidAPI, standard GST API, cached docs)
 */
export function extractGstDetails(rawData: any, fallbackGstin: string = ''): ExtractedGstDetails {
  const d = rawData?.data || rawData?.result || rawData || {};
  const gstin = (d.gstin || fallbackGstin || '').toUpperCase().trim();
  const stateCode = gstin.length >= 2 ? gstin.substring(0, 2) : '';
  const pan = gstin.length >= 12 ? gstin.substring(2, 12) : '';

  const tradeName = (d.trade_name || d.tradeName || d.bnm || '').trim();
  const legalName = (d.legal_name || d.legalName || d.lgnm || '').trim();
  const displayName = tradeName || legalName || (gstin ? `Vendor (${gstin})` : 'Unknown Vendor');

  // Find address container
  const principalPob = d.place_of_business_principal || d.principal_place_of_business || {};
  const addrObj = principalPob.address || principalPob.addr || d.address || d.pradr?.addr || d.pradr || {};

  // Extract State (Authority: State Code mapping + clean address state)
  let state = (addrObj.state || addrObj.stcd || '').trim();
  const canonicalState = GST_STATE_CODE_MAP[stateCode];
  if (canonicalState) {
    state = canonicalState;
  } else if (!state || state.length <= 2 || state.toLowerCase() === 'null') {
    state = 'Other Territory';
  }

  // Extract Pincode
  let pincode = String(
    addrObj.pin_code || 
    addrObj.pncd || 
    addrObj.pincode || 
    addrObj.pin || 
    ''
  ).trim();
  if (!/^\d{6}$/.test(pincode)) {
    pincode = '';
  }

  // Format Address (clean and avoid repetition)
  const parts: string[] = [];
  const addPart = (val: any) => {
    if (!val || typeof val !== 'string') return;
    const clean = val.trim();
    if (clean && clean !== '00' && clean !== '-' && !parts.some(p => p.toLowerCase() === clean.toLowerCase())) {
      parts.push(clean);
    }
  };

  addPart(addrObj.door_num || addrObj.bno);
  addPart(addrObj.floor_num || addrObj.flno);
  addPart(addrObj.building_name || addrObj.bnm);
  addPart(addrObj.street || addrObj.st);
  addPart(addrObj.location || addrObj.loc);
  addPart(addrObj.district || addrObj.dst);
  addPart(addrObj.city || addrObj.city);

  let formattedAddress = parts.join(', ');
  if (!formattedAddress && typeof addrObj === 'string') {
    formattedAddress = addrObj;
  }

  const natureOfBusiness = Array.isArray(d.business_activity_nature) 
    ? d.business_activity_nature 
    : (Array.isArray(principalPob.nature) ? principalPob.nature : []);

  return {
    gstin,
    tradeName,
    legalName,
    displayName,
    address: formattedAddress,
    state,
    stateCode,
    pincode,
    pan,
    status: d.status || d.sts || 'Active',
    natureOfBusiness
  };
}
