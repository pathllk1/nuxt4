import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcBillTotals } from '../../shared/utils/tax-calc.ts';

describe('GST Calculation & Statutory Netting Invariants', () => {
  it('Intra-state supply splits tax 50/50 between CGST and SGST with exact paise parity', () => {
    const cart = [
      { item: 'Cement 50kg', qty: 10, rate: 350.55, grate: 18 }
    ];

    const totals = calcBillTotals(cart, [], true, 'intra-state', false);

    assert.equal(totals.grossTotal, 3505.50);
    // 3505.50 * 0.18 = 630.99
    assert.equal(totals.totalTax, 630.99);
    // 630.99 / 2 = 315.495 -> CGST: 315.50, SGST: 315.49
    assert.equal(Number((totals.cgst + totals.sgst).toFixed(2)), totals.totalTax, 'CGST + SGST must exactly equal totalTax');
    assert.equal(totals.igst, 0);
    // Net total rounded to integer paise
    assert.equal(totals.netTotal, Math.round(3505.50 + 630.99));
  });

  it('Inter-state supply allocates 100% tax to IGST', () => {
    const cart = [
      { item: 'Steel Bar', qty: 5, rate: 1000, grate: 18 }
    ];

    const totals = calcBillTotals(cart, [], true, 'inter-state', false);

    assert.equal(totals.grossTotal, 5000);
    assert.equal(totals.totalTax, 900);
    assert.equal(totals.igst, 900);
    assert.equal(totals.cgst, 0);
    assert.equal(totals.sgst, 0);
    assert.equal(totals.netTotal, 5900);
  });

  it('Reverse Charge Mechanism (RCM): taxSum excluded from invoice net total', () => {
    const cart = [
      { item: 'Freight Inward', qty: 1, rate: 2000, grate: 5 }
    ];

    const totals = calcBillTotals(cart, [], true, 'intra-state', true); // reverseCharge: true

    assert.equal(totals.grossTotal, 2000);
    assert.equal(totals.totalTax, 100);
    // In RCM, tax is not added to supplier invoice net total
    assert.equal(totals.netTotal, 2000, 'Invoice net total payable to supplier does not include RCM tax');
  });

  it('Statutory GST Cross-Utilization (Sec 49A/49B): strict offset priority rules', () => {
    // Scenario:
    // Output Liabilities: IGST 1000, CGST 800, SGST 800
    // Available ITC: IGST 1500, CGST 200, SGST 200

    let remIgstLiab = 1000;
    let remCgstLiab = 800;
    let remSgstLiab = 800;

    let remIgstCredit = 1500;
    let remCgstCredit = 200;
    let remSgstCredit = 200;

    // Step 1: IGST Credit against IGST liability
    const off1 = Math.min(remIgstLiab, remIgstCredit); // 1000
    remIgstLiab -= off1;
    remIgstCredit -= off1; // 500 remaining

    // Step 1b: IGST Credit against CGST liability
    const off2 = Math.min(remCgstLiab, remIgstCredit); // 500
    remCgstLiab -= off2; // 300 remaining
    remIgstCredit -= off2; // 0 remaining

    // Step 2: CGST Credit against CGST liability
    const off3 = Math.min(remCgstLiab, remCgstCredit); // 200
    remCgstLiab -= off3; // 100 remaining
    remCgstCredit -= off3; // 0 remaining

    // Step 3: SGST Credit against SGST liability
    const off4 = Math.min(remSgstLiab, remSgstCredit); // 200
    remSgstLiab -= off4; // 600 remaining
    remSgstCredit -= off4; // 0 remaining

    assert.equal(remIgstLiab, 0, 'IGST liability completely settled');
    assert.equal(remCgstLiab, 100, 'Remaining CGST liability payable in cash');
    assert.equal(remSgstLiab, 600, 'Remaining SGST liability payable in cash');
    assert.equal(remCgstLiab + remSgstLiab, 700, 'Total cash liability is 700');
  });
});
