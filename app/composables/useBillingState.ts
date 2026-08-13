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

export const INDIA_STATE_CODES: Record<string, string> = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', 'punjab': '03', 'chandigarh': '04',
  'uttarakhand': '05', 'haryana': '06', 'delhi': '07', 'rajasthan': '08', 'uttar pradesh': '09',
  'bihar': '10', 'sikkim': '11', 'arunachal pradesh': '12', 'nagaland': '13', 'manipur': '14',
  'mizoram': '15', 'tripura': '16', 'meghalaya': '17', 'assam': '18', 'west bengal': '19',
  'jharkhand': '20', 'odisha': '21', 'chhattisgarh': '22', 'madhya pradesh': '23', 'gujarat': '24',
  'maharashtra': '27', 'andhra pradesh': '28', 'karnataka': '29', 'goa': '30', 'kerala': '32',
  'tamil nadu': '33', 'telangana': '36'
};

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
    const firmCode = state.activeFirmLocation?.state_code || state.activeFirmLocation?.gst_number?.substring(0, 2);
    
    const partyCode = state.selectedPartyLocation?.stateCode || 
                     state.selectedParty?.stateCode ||
                     (state.selectedPartyGstin && state.selectedPartyGstin !== 'UNREGISTERED' && state.selectedPartyGstin.length >= 2 ? state.selectedPartyGstin.substring(0, 2) : null) ||
                     (state.selectedParty?.state ? INDIA_STATE_CODES[state.selectedParty.state.toLowerCase()] : null);

    if (firmCode && partyCode) {
      if (firmCode.toString().padStart(2, '0') === partyCode.toString().padStart(2, '0')) {
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

    state.selectedConsignee = {
      name: party.name || party.firm || '',
      gstin: loc?.gstin || party.gstin || 'UNREGISTERED',
      address: loc?.address || party.address || '',
      state: loc?.state || party.state || '',
      stateCode: loc?.stateCode || party.stateCode || (loc?.gstin && loc.gstin !== 'UNREGISTERED' && loc.gstin.length >= 2 ? loc.gstin.substring(0, 2) : ''),
      pin: loc?.pincode || party.pin || '',
      contact: loc?.contact || party.contact || '',
      deliveryInstructions: state.selectedConsignee?.deliveryInstructions || ''
    };
  };

  const setBillToLocation = (location: PartyLocation | null) => {
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
    let grossTotal = 0;
    let totalTax = 0;

    state.cart.forEach((item) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const disc = parseFloat(item.disc) || 0;
      const grate = parseFloat(item.grate) || 0;

      const lineVal = qty * rate * (1 - disc / 100);
      if (state.gstEnabled) {
        totalTax += lineVal * (grate / 100);
      }
      grossTotal += lineVal;
    });

    let otherChargesTotal = 0;
    let otherChargesGstTotal = 0;
    if (state.otherCharges && state.otherCharges.length > 0) {
      for (const charge of state.otherCharges) {
        const amt = parseFloat(charge.amount) || 0;
        const grate = parseFloat(charge.grate || charge.gstRate) || 0;
        otherChargesTotal += amt;
        if (state.gstEnabled) {
          otherChargesGstTotal += (amt * grate) / 100;
        }
      }
    }
    grossTotal += otherChargesTotal;

    let cgst = 0, sgst = 0, igst = 0;
    if (state.gstEnabled && state.meta.billType === 'intra-state') {
      cgst = (totalTax / 2) + (otherChargesGstTotal / 2);
      sgst = (totalTax / 2) + (otherChargesGstTotal / 2);
    } else if (state.gstEnabled) {
      igst = totalTax + otherChargesGstTotal;
    }

    const netTotalBeforeRoundOff = grossTotal + (state.meta.reverseCharge ? 0 : cgst + sgst + igst);
    const netTotal = Math.round(netTotalBeforeRoundOff);
    const roundOff = netTotal - netTotalBeforeRoundOff;

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
      if (partiesRes.success) state.parties = partiesRes.data || [];
      
      if (firmRes.success && firmRes.data) {
        const firm = firmRes.data;
        state.currentFirmName = firm.name || 'Firm';
        state.firmLocations = firm.locations || [];
        state.activeFirmLocation = state.firmLocations.find(l => l.is_default) || state.firmLocations[0] || null;
        state.gstEnabled = firm.gst_enabled !== false;
      }
    } catch (err) {
      console.warn('Failed to load state dependencies:', err);
    } finally {
      loading.value = false;
    }
  };

  const fetchNextBillNo = async (type = 'SALES') => {
    try {
      const res = await api.get('/accounting/bills/get-next-number', { type });
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
    fetchData,
    fetchNextBillNo
  };
};
