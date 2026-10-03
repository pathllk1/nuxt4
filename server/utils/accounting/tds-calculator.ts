/**
 * TDS (Tax Deducted at Source) Calculator & Grossing-Up Utility
 * Compliant with Income Tax Act, 1961:
 * - Section 194C: Payments to Contractors & Subcontractors
 * - Section 195A: Grossing-up of Tax Borne by Deductor
 * - Section 206AA: Higher Rate for Non-furnishing of PAN (20%)
 */

export interface PanValidationResult {
  isValid: boolean;
  pan: string;
  isIndividual: boolean;
  entityType: 'INDIVIDUAL' | 'COMPANY' | 'FIRM' | 'AOP_BOI' | 'TRUST' | 'HUF' | 'OTHER' | 'UNKNOWN';
  default194CRate: number; // 1% for Individual/HUF, 2% for Others, 20% for Invalid/Missing
}

export interface ThresholdCheckResult {
  singleExceeded: boolean; // Single payment > ₹30,000
  aggregateExceeded: boolean; // Aggregate in FY > ₹1,00,000
  isThresholdBreached: boolean; // Either single > 30k or aggregate > 1L
  priorYtd: number;
  newYtd: number;
  requiresCatchUp: boolean; // Crossed ₹1L threshold with this payment
  catchUpBase: number; // The prior exempt amount that now needs tax applied
}

export interface TdsComputationResult {
  netPayout: number;
  grossAmount: number;
  tdsAmount: number;
  effectiveRate: number;
  isGrossUp: boolean;
  catchUpTds: number;
  regularTds: number;
  formulaDescription: string;
}

export const TdsCalculator = {
  /**
   * Validates Indian Income Tax PAN format (5 letters, 4 digits, 1 letter)
   * 4th character determines the entity type:
   *   P: Individual, C: Company, F: Firm/LLP, H: HUF, A: AOP, T: Trust
   */
  validatePan(rawPan?: string | null): PanValidationResult {
    const pan = (rawPan || '').trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    if (!pan || !panRegex.test(pan)) {
      return {
        isValid: false,
        pan: pan || '',
        isIndividual: false,
        entityType: 'UNKNOWN',
        default194CRate: 20 // Sec 206AA higher rate
      };
    }

    const fourthChar = pan.charAt(3);
    let isIndividual = false;
    let entityType: PanValidationResult['entityType'] = 'OTHER';
    let default194CRate = 2; // Default for non-individuals

    switch (fourthChar) {
      case 'P':
        isIndividual = true;
        entityType = 'INDIVIDUAL';
        default194CRate = 1; // 1% u/s 194C
        break;
      case 'H':
        isIndividual = true;
        entityType = 'HUF';
        default194CRate = 1; // 1% u/s 194C
        break;
      case 'C':
        entityType = 'COMPANY';
        default194CRate = 2; // 2% u/s 194C
        break;
      case 'F':
        entityType = 'FIRM';
        default194CRate = 2; // 2% u/s 194C
        break;
      case 'T':
        entityType = 'TRUST';
        default194CRate = 2;
        break;
      case 'A':
      case 'B':
        entityType = 'AOP_BOI';
        default194CRate = 2;
        break;
      default:
        entityType = 'OTHER';
        default194CRate = 2;
    }

    return {
      isValid: true,
      pan,
      isIndividual,
      entityType,
      default194CRate
    };
  },

  /**
   * Evaluates Section 194C(5) statutory thresholds:
   * 1. Single payment <= ₹30,000
   * 2. Aggregate in financial year <= ₹1,00,000
   */
  check194CThreshold(priorYtd: number, currentPayment: number): ThresholdCheckResult {
    const prior = Math.max(0, Number(priorYtd) || 0);
    const curr = Math.max(0, Number(currentPayment) || 0);
    const newYtd = prior + curr;

    const singleExceeded = curr > 30000;
    const aggregateExceeded = newYtd > 100000;
    const wasAlreadyExceeded = prior > 100000;

    // Catch-up applies if aggregate crosses ₹1,00,000 with THIS payment,
    // and prior payments did not already have TDS applied.
    const requiresCatchUp = aggregateExceeded && !wasAlreadyExceeded && prior > 0;
    const catchUpBase = requiresCatchUp ? prior : 0;

    return {
      singleExceeded,
      aggregateExceeded,
      isThresholdBreached: singleExceeded || aggregateExceeded,
      priorYtd: Number(prior.toFixed(2)),
      newYtd: Number(newYtd.toFixed(2)),
      requiresCatchUp,
      catchUpBase: Number(catchUpBase.toFixed(2))
    };
  },

  /**
   * Computes statutory TDS under Section 194C or Section 195A (Grossing Up)
   */
  computeTds(params: {
    netAmount: number;
    ratePercent: number;
    isGrossUp: boolean;
    catchUpBaseAmount?: number;
  }): TdsComputationResult {
    const net = Math.max(0, Number(params.netAmount) || 0);
    const rate = Math.max(0, Number(params.ratePercent) || 0);
    const catchUpBase = Math.max(0, Number(params.catchUpBaseAmount) || 0);

    const r = rate / 100;

    if (r <= 0 || r >= 1) {
      return {
        netPayout: net,
        grossAmount: net,
        tdsAmount: 0,
        effectiveRate: 0,
        isGrossUp: false,
        catchUpTds: 0,
        regularTds: 0,
        formulaDescription: 'Zero TDS (Rate is 0%)'
      };
    }

    if (params.isGrossUp) {
      // ── Grossing-Up Formula (Sec 195A) ──
      // G = N / (1 - r)
      // If there is a catch-up base (prior exempt payments in current FY),
      // we gross up the total cumulative net (catchUpBase + net), then subtract catchUpBase.
      if (catchUpBase > 0) {
        const totalNet = catchUpBase + net;
        const totalGross = totalNet / (1 - r);
        const totalTds = totalGross - totalNet;

        // Current incremental gross to book
        const incrementalGross = totalGross - catchUpBase;
        const catchUpTds = catchUpBase * (r / (1 - r));
        const regularTds = totalTds - catchUpTds;

        return {
          netPayout: Number(net.toFixed(2)),
          grossAmount: Number(incrementalGross.toFixed(2)),
          tdsAmount: Number(totalTds.toFixed(2)),
          effectiveRate: rate,
          isGrossUp: true,
          catchUpTds: Number(catchUpTds.toFixed(2)),
          regularTds: Number(regularTds.toFixed(2)),
          formulaDescription: `Gross-Up with Catch-Up: Total FY Net (₹${totalNet.toFixed(2)}) / (1 - ${r}) = ₹${totalGross.toFixed(2)}; Total TDS = ₹${totalTds.toFixed(2)}`
        };
      } else {
        const gross = net / (1 - r);
        const tds = gross - net;

        return {
          netPayout: Number(net.toFixed(2)),
          grossAmount: Number(gross.toFixed(2)),
          tdsAmount: Number(tds.toFixed(2)),
          effectiveRate: rate,
          isGrossUp: true,
          catchUpTds: 0,
          regularTds: Number(tds.toFixed(2)),
          formulaDescription: `Gross-Up: Net Payout (₹${net.toFixed(2)}) / (1 - ${r}) = Gross ₹${gross.toFixed(2)} @ ${rate}% TDS`
        };
      }
    } else {
      // ── Standard Deduction (Payee Borne) ──
      // User entered Gross Amount as net
      // G is the base, T = G * r, Net = G - T
      const gross = net;
      const regularTds = gross * r;
      const catchUpTds = catchUpBase > 0 ? catchUpBase * r : 0;
      const totalTds = regularTds + catchUpTds;
      const netPayout = Math.max(0, gross - totalTds);

      return {
        netPayout: Number(netPayout.toFixed(2)),
        grossAmount: Number(gross.toFixed(2)),
        tdsAmount: Number(totalTds.toFixed(2)),
        effectiveRate: rate,
        isGrossUp: false,
        catchUpTds: Number(catchUpTds.toFixed(2)),
        regularTds: Number(regularTds.toFixed(2)),
        formulaDescription: `Standard Deduction: Gross ₹${gross.toFixed(2)} - TDS (${rate}%) = Net ₹${netPayout.toFixed(2)}`
      };
    }
  }
};
