// utils/taxCalculator.js
(function (global) {
  'use strict';

  const TaxCalculator = {
    DEFAULT_FIRM_STATE_CODE: '27', // Maharashtra (standard default)

    calculateItemTax(qty, rate, discPercent = 0, gstRate = 18, isInterState = false) {
      const q = Math.max(0, Number(qty) || 0);
      const r = Math.max(0, Number(rate) || 0);
      const d = Math.min(100, Math.max(0, Number(discPercent) || 0));
      const g = Math.max(0, Number(gstRate) || 0);

      const gross = q * r;
      const discount = gross * (d / 100);
      const taxable = Math.round((gross - discount) * 100) / 100;

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterState) {
        igst = Math.round((taxable * (g / 100)) * 100) / 100;
      } else {
        const halfRate = g / 2;
        cgst = Math.round((taxable * (halfRate / 100)) * 100) / 100;
        sgst = Math.round((taxable * (halfRate / 100)) * 100) / 100;
      }

      const totalTax = cgst + sgst + igst;
      const lineTotal = Math.round((taxable + totalTax) * 100) / 100;

      return {
        gross,
        discount,
        taxable,
        cgst,
        sgst,
        igst,
        totalTax,
        lineTotal
      };
    },

    calculateBillTotals(items = [], isInterState = false) {
      let grossTotal = 0;
      let totalTaxable = 0;
      let cgstTotal = 0;
      let sgstTotal = 0;
      let igstTotal = 0;

      items.forEach((item) => {
        const calc = this.calculateItemTax(
          item.qty,
          item.rate,
          item.disc || 0,
          item.grate || 18,
          isInterState
        );
        grossTotal += calc.gross;
        totalTaxable += calc.taxable;
        cgstTotal += calc.cgst;
        sgstTotal += calc.sgst;
        igstTotal += calc.igst;
      });

      const totalTax = cgstTotal + sgstTotal + igstTotal;
      const unroundedNet = totalTaxable + totalTax;
      const roundedNet = Math.round(unroundedNet);
      const roundOff = Math.round((roundedNet - unroundedNet) * 100) / 100;

      return {
        grossTotal: Math.round(grossTotal * 100) / 100,
        taxableTotal: Math.round(totalTaxable * 100) / 100,
        cgst: Math.round(cgstTotal * 100) / 100,
        sgst: Math.round(sgstTotal * 100) / 100,
        igst: Math.round(igstTotal * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        roundOff,
        netTotal: roundedNet
      };
    }
  };

  global.TaxCalculator = TaxCalculator;
})(window);
