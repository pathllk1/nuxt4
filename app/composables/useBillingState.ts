import { reactive, ref, computed } from 'vue';
import { useApi } from '@/utils/api';

export interface FirmLocation {
  gst_number: string;
  state: string;
  state_code: string;
  address: string;
  is_default: boolean;
}

export interface PartyLocation {
  gstin: string;
  state: string;
  stateCode: string;
  address: string;
  pincode: string;
  contact?: string;
  isPrimary: boolean;
}

export interface BillingState {
  stocks: any[];
  parties: any[];
  cart: any[];
  selectedParty: any | null;
  selectedPartyGstin: string | null;
  selectedPartyLocation: PartyLocation | null;
  selectedConsignee: any | null;
  consigneeSameAsBillTo: boolean;
  meta: {
    billNo: string;
    billDate: string;
    billType: 'intra-state' | 'inter-state';
    reverseCharge: boolean;
    referenceNo: string;
    vehicleNo: string;
    dispatchThrough: string;
    narration: string;
    supplierBillNo?: string;
    btype: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'PROFORMA' | 'DELIVERY_NOTE';
  };
  otherCharges: any[];
  currentFirmName: string;
  gstEnabled: boolean;
  firmLocations: FirmLocation[];
  activeFirmLocation: FirmLocation | null;
  isReturnMode: boolean;
  returnFromBillId: string | null;
  currentBill: any | null;
}

import { GST_STATE_CODE_MAP } from '@/utils/gst-address-helper';

export const INDIA_STATE_CODES: Record<string, string> = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03', 'chandigarh': '04',
  'uttarakhand': '05', 'haryana': '06', 'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09',
  'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12', 'nagaland': '13', 'manipur': '14',
  'mizoram': '15', 'tripura': '16', 'meghalaya': '17', 'assam': '18', 'west bengal': '19',
  'jharkhand': '20', 'odisha': '21', 'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
  'dadra and nagar haveli and daman and diu': '26', 'maharashtra': '27', 'andhra pradesh': '28',
  'karnataka': '29', 'goa': '30', 'lakshadweep': '31', 'kerala': '32', 'tamil nadu': '33',
  'puducherry': '34', 'andaman and nicobar islands': '35', 'telangana': '36', 'ladakh': '38',
  'other territory': '97'
};

export function extractGstStateCode(
  gstin?: string | null,
  stateCode?: string | null,
  stateName?: string | null
): string | null {
  // 1. Statutory Authority: First 2 digits of valid GSTIN
  if (gstin && gstin !== 'UNREGISTERED') {
    const clean = String(gstin).trim().toUpperCase();
    const match = clean.match(/^(\d{2})/);
    if (match) return match[1];
  }
  // 2. Explicit 2-digit state code
  if (stateCode) {
    const cleanCode = String(stateCode).trim();
    if (/^\d{1,2}$/.test(cleanCode)) return cleanCode.padStart(2, '0');
    const fromMap = INDIA_STATE_CODES[cleanCode.toLowerCase()];
    if (fromMap) return fromMap;
  }
  // 3. From State Name
  if (stateName) {
    const cleanName = String(stateName).trim().toLowerCase();
    const fromMap = INDIA_STATE_CODES[cleanName];
    if (fromMap) return fromMap;
  }
  return null;
}

export function normalizePartyGstInfo(p: any) {
  if (!p) return p;
  if (p.gstin && /^\d{2}/.test(p.gstin.trim()) && p.gstin !== 'UNREGISTERED') {
    const sc = p.gstin.trim().substring(0, 2);
    p.stateCode = sc;
    if (!p.state || p.state === '-' || p.state.toLowerCase() === 'null') {
      p.state = GST_STATE_CODE_MAP[sc] || p.state;
    }
  }
  if (Array.isArray(p.gstLocations)) {
    p.gstLocations.forEach((loc: any) => {
      if (loc.gstin && /^\d{2}/.test(loc.gstin.trim()) && loc.gstin !== 'UNREGISTERED') {
        const sc = loc.gstin.trim().substring(0, 2);
        loc.stateCode = sc;
        loc.state = GST_STATE_CODE_MAP[sc] || loc.state;
      }
    });
  }
  return p;
}

export const useBillingState = () => {
  const api = useApi();
  const state = reactive<BillingState>({
    stocks: [],
    parties: [],
    cart: [],
    selectedParty: null,
    selectedPartyGstin: null,
    selectedPartyLocation: null,
    selectedConsignee: null,
    consigneeSameAsBillTo: true,
    meta: {
      billNo: '',
      billDate: new Date().toISOString().split('T')[0] || '',
      billType: 'intra-state',
      reverseCharge: false,
      referenceNo: '',
      vehicleNo: '',
      dispatchThrough: '',
      narration: '',
      btype: 'SALES'
    },
    otherCharges: [],
    currentFirmName: 'Loading...',
    gstEnabled: true,
    firmLocations: [],
    activeFirmLocation: null,
    isReturnMode: false,
    returnFromBillId: null,
    currentBill: null
  });

  const loading = ref(false);

  const determineGstBillType = () => {
    // 1. Seller State Code
    const firmGstin = state.activeFirmLocation?.gst_number || state.firmLocations?.[0]?.gst_number;
    const firmCode = extractGstStateCode(
      firmGstin,
      state.activeFirmLocation?.state_code,
      state.activeFirmLocation?.state
    );

    // 2. Buyer State Code (GSTIN prefix is authoritative)
    const partyGstin = state.selectedPartyLocation?.gstin || state.selectedPartyGstin || state.selectedParty?.gstin;
    const partyCode = extractGstStateCode(
      partyGstin,
      state.selectedPartyLocation?.stateCode || state.selectedParty?.stateCode,
      state.selectedPartyLocation?.state || state.selectedParty?.state
    );

    // 3. Place of Supply / Consignee destination if different ship-to
    let destCode = partyCode;
    if (!state.consigneeSameAsBillTo && state.selectedConsignee) {
      destCode = extractGstStateCode(
        state.selectedConsignee.gstin,
        state.selectedConsignee.stateCode,
        state.selectedConsignee.state
      ) || partyCode;
    }

    if (firmCode && destCode) {
      if (firmCode.toString().padStart(2, '0') === destCode.toString().padStart(2, '0')) {
        state.meta.billType = 'intra-state';
      } else {
        state.meta.billType = 'inter-state';
      }
    }
  };

  const populateConsigneeFromBillTo = () => {
    if (!state.consigneeSameAsBillTo || !state.selectedParty) return;
    
    const party = state.selectedParty;
    const loc = state.selectedPartyLocation;

    const gstin = loc?.gstin || party.gstin || 'UNREGISTERED';
    const stateCode = extractGstStateCode(gstin, loc?.stateCode || party.stateCode, loc?.state || party.state) || '';
    const stateName = (stateCode && GST_STATE_CODE_MAP[stateCode])
      ? GST_STATE_CODE_MAP[stateCode]
      : (loc?.state || party.state || '');

    state.selectedConsignee = {
      name: party.name || party.firm || '',
      gstin,
      address: loc?.address || party.address || '',
      state: stateName,
      stateCode,
      pin: loc?.pincode || party.pin || '',
      contact: loc?.contact || party.contact || '',
      deliveryInstructions: state.selectedConsignee?.deliveryInstructions || ''
    };
  };

  const setBillToLocation = (location: PartyLocation | null) => {
    if (location && location.gstin && /^\d{2}/.test(location.gstin.trim()) && location.gstin !== 'UNREGISTERED') {
      const sc = location.gstin.trim().substring(0, 2);
      location.stateCode = sc;
      if (GST_STATE_CODE_MAP[sc]) {
        location.state = GST_STATE_CODE_MAP[sc];
      }
    }
    state.selectedPartyLocation = location;
    state.selectedPartyGstin = location?.gstin || state.selectedParty?.gstin || 'UNREGISTERED';
    determineGstBillType();
    if (state.consigneeSameAsBillTo) {
      populateConsigneeFromBillTo();
    }
  };

  const setConsigneeFromLocation = (location: PartyLocation | null) => {
    if (!state.selectedParty || !location) return;
    state.selectedConsignee = {
      name: state.selectedParty.name || state.selectedParty.firm || '',
      gstin: location.gstin || 'UNREGISTERED',
      address: location.address || '',
      state: location.state || '',
      stateCode: location.stateCode || (location.gstin && location.gstin.length >= 2 ? location.gstin.substring(0, 2) : ''),
      pin: location.pincode || '',
      contact: location.contact || state.selectedParty.contact || '',
      deliveryInstructions: state.selectedConsignee?.deliveryInstructions || ''
    };
  };

  const totals = computed(() => {
    let itemsGrossTotal = 0;
    let itemsTaxTotal = 0;

    state.cart.forEach((item) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const disc = parseFloat(item.disc) || 0;
      const grate = parseFloat(item.grate) || 0;

      const lineVal = Number((qty * rate * (1 - disc / 100)).toFixed(2));
      if (state.gstEnabled) {
        itemsTaxTotal += Number(((lineVal * grate) / 100).toFixed(2));
      }
      itemsGrossTotal += lineVal;
    });

    itemsGrossTotal = Number(itemsGrossTotal.toFixed(2));
    itemsTaxTotal = Number(itemsTaxTotal.toFixed(2));

    let otherChargesTotal = 0;
    let otherChargesGstTotal = 0;
    if (state.otherCharges && state.otherCharges.length > 0) {
      for (const charge of state.otherCharges) {
        const amt = Number((parseFloat(charge.amount) || 0).toFixed(2));
        const grate = parseFloat(charge.grate || charge.gstRate) || 0;
        otherChargesTotal += amt;
        if (state.gstEnabled) {
          otherChargesGstTotal += Number(((amt * grate) / 100).toFixed(2));
        }
      }
    }
    otherChargesTotal = Number(otherChargesTotal.toFixed(2));
    otherChargesGstTotal = Number(otherChargesGstTotal.toFixed(2));

    const grossTotal = Number((itemsGrossTotal + otherChargesTotal).toFixed(2));
    const totalTax = Number((itemsTaxTotal + otherChargesGstTotal).toFixed(2));

    let cgst = 0, sgst = 0, igst = 0;
    if (state.gstEnabled && state.meta.billType === 'intra-state') {
      const halfTax = Number((totalTax / 2).toFixed(2));
      cgst = halfTax;
      sgst = Number((totalTax - halfTax).toFixed(2));
    } else if (state.gstEnabled) {
      igst = totalTax;
    }

    const taxSum = state.meta.reverseCharge ? 0 : Number((cgst + sgst + igst).toFixed(2));
    const netTotalBeforeRoundOff = Number((grossTotal + taxSum).toFixed(2));
    const netTotal = Math.round(netTotalBeforeRoundOff);
    const roundOff = Number((netTotal - netTotalBeforeRoundOff).toFixed(2));

    return {
      grossTotal,
      totalTax,
      otherChargesTotal,
      otherChargesGstTotal,
      cgst,
      sgst,
      igst,
      netTotal,
      roundOff
    };
  });

  const fetchData = async () => {
    loading.value = true;
    try {
      const [stocksRes, partiesRes, firmRes] = await Promise.all([
        api.get('/inventory/stock').catch(() => ({ success: false, data: [] })),
        api.get('/accounting/parties').catch(() => ({ success: false, data: [] })),
        api.get('/firms/current').catch(() => ({ success: false, data: null }))
      ]);

      if (stocksRes.success) state.stocks = stocksRes.data || [];
      if (partiesRes.success) state.parties = (partiesRes.data || []).map((p: any) => normalizePartyGstInfo(p));
      
      if (firmRes.success && firmRes.data) {
        const firm = firmRes.data;
        state.currentFirmName = firm.name || 'Firm';
        state.firmLocations = firm.locations || [];
        state.activeFirmLocation = state.firmLocations.find(l => l.is_default) || state.firmLocations[0] || null;
        state.gstEnabled = firm.gst_enabled !== false;
        determineGstBillType();
      }
    } catch (err) {
      console.warn('Failed to load state dependencies:', err);
    } finally {
      loading.value = false;
    }
  };

  const fetchNextBillNo = async (type = 'SALES') => {
    try {
      const res = await api.get('/accounting/bills/get-next-number', { params: { type } });
      if (res.success && res.data?.bno) {
        state.meta.billNo = res.data.bno;
      }
    } catch (err) {
      console.warn('Failed to preview next bill number', err);
    }
  };

  return {
    state,
    totals,
    loading,
    determineGstBillType,
    populateConsigneeFromBillTo,
    setBillToLocation,
    setConsigneeFromLocation,
    normalizePartyGstInfo,
    extractGstStateCode,
    fetchData,
    fetchNextBillNo
  };
};
