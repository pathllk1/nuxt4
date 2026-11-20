/**
 * Canonical Isomorphic Invoice & Tax Calculation Engine
 *
 * Single source of truth for both Vue frontend billing composables and
 * Nitro backend bill / ledger handlers.
 *
 * Guarantees exact paise rounding (cgst + sgst === totalTax to the cent),
 * deterministic round-off computation, and unified reverse-charge treatment.
 */

export interface IBillItemCalculationInput {
  qty?: number | string;
  rate?: number | string;
  amount?: number | string;
  disc?: number | string;
  grate?: number | string;
  gstRate?: number | string;
  [key: string]: any;
}

export interface IOtherChargeCalculationInput {
  amount?: number | string;
  grate?: number | string;
  gstRate?: number | string;
  [key: string]: any;
}

export interface ICanonicalBillTotals {
  grossTotal: number;
  totalTax: number;
  otherChargesTotal: number;
  otherChargesGstTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  netTotal: number;
  roundOff: number;
  itemsGrossTotal?: number;
  itemsTaxTotal?: number;
}

export function calcBillTotals(
  cart: IBillItemCalculationInput[],
  otherCharges: IOtherChargeCalculationInput[] = [],
  gstEnabled: boolean = true,
  billType: string = 'intra-state',
  reverseCharge: boolean = false,
  qtyFn?: (item: any) => number
): ICanonicalBillTotals {
  const getQty = qtyFn || ((item: any) => {
    const q = parseFloat(item?.qty);
    return Number.isFinite(q) && q > 0 ? q : 1;
  });

  let itemsGrossTotal = 0;
  let itemsTaxTotal = 0;

  if (Array.isArray(cart)) {
    for (const item of cart) {
      // Handle both goods (qty * rate * (1 - disc)) and service (item.amount) inputs
      const qty = item.amount !== undefined && item.qty === undefined ? 1 : getQty(item);
      const rate = item.amount !== undefined && item.rate === undefined ? (parseFloat(String(item.amount)) || 0) : (parseFloat(String(item.rate)) || 0);
      const disc = parseFloat(String(item.disc)) || 0;
      const lineVal = Number((qty * rate * (1 - disc / 100)).toFixed(2));

      if (gstEnabled) {
        const grate = parseFloat(String(item.grate ?? item.gstRate)) || 0;
        itemsTaxTotal += Number(((lineVal * grate) / 100).toFixed(2));
      }
      itemsGrossTotal += lineVal;
    }
  }

  itemsGrossTotal = Number(itemsGrossTotal.toFixed(2));
  itemsTaxTotal = Number(itemsTaxTotal.toFixed(2));

  let otherChargesTotal = 0;
  let otherChargesGstTotal = 0;
  if (Array.isArray(otherCharges) && otherCharges.length > 0) {
    for (const charge of otherCharges) {
      const amt = Number((parseFloat(String(charge.amount)) || 0).toFixed(2));
      otherChargesTotal += amt;
      if (gstEnabled) {
        const crate = parseFloat(String(charge.grate ?? charge.gstRate)) || 0;
        otherChargesGstTotal += Number(((amt * crate) / 100).toFixed(2));
      }
    }
  }
  otherChargesTotal = Number(otherChargesTotal.toFixed(2));
  otherChargesGstTotal = Number(otherChargesGstTotal.toFixed(2));

  const grossTotal = Number((itemsGrossTotal + otherChargesTotal).toFixed(2));
  const totalTax = Number((itemsTaxTotal + otherChargesGstTotal).toFixed(2));

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  const isIntraState = String(billType).toLowerCase() === 'intra-state';
  if (gstEnabled && isIntraState) {
    const halfTax = Number((totalTax / 2).toFixed(2));
    cgst = halfTax;
    sgst = Number((totalTax - halfTax).toFixed(2)); // Guarantees cgst + sgst === totalTax to the exact paise
  } else if (gstEnabled) {
    igst = totalTax;
  }

  const taxSum = reverseCharge ? 0 : Number((cgst + sgst + igst).toFixed(2));
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
    roundOff,
    itemsGrossTotal,
    itemsTaxTotal
  };
}

export const calculateCanonicalBillTotals = calcBillTotals;

export function getCurrentFinancialYear(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const month = validDate.getMonth() + 1;
  const year = validDate.getFullYear();
  return month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;
}
