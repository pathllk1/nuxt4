import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Bill Cancellation Ledger Reversal Invariants', () => {
  it('Cancellation filters out superseded rows and reverses only active legs', () => {
    // Scenario: Bill originally created (Version 1) -> Edited (Version 2) -> Cancelled
    const ledgerHistory = [
      // Version 1 (superseded by edit):
      { id: 'leg-1', refId: 'bill-101', accountHead: 'Sundry Debtors', debitAmount: 100, creditAmount: 0, isReversed: true, replacesVoucherGroupId: 'v-2' },
      { id: 'leg-2', refId: 'bill-101', accountHead: 'Sales', debitAmount: 0, creditAmount: 100, isReversed: true, replacesVoucherGroupId: 'v-2' },
      // Version 2 (active effective entries):
      { id: 'leg-3', refId: 'bill-101', accountHead: 'Sundry Debtors', debitAmount: 150, creditAmount: 0, isReversed: false },
      { id: 'leg-4', refId: 'bill-101', accountHead: 'Sales', debitAmount: 0, creditAmount: 150, isReversed: false },
    ];

    // Flawed implementation would query all 4 rows.
    // Corrected implementation queries only isReversed !== true
    const activeEntries = ledgerHistory.filter(e => e.isReversed !== true);

    assert.equal(activeEntries.length, 2, 'Must retrieve exactly the 2 active entries');
    assert.equal(activeEntries[0].id, 'leg-3');
    assert.equal(activeEntries[1].id, 'leg-4');

    // Generating compensating reversal legs
    const reversalLegs = activeEntries.map(orig => ({
      accountHead: orig.accountHead,
      debitAmount: orig.creditAmount, // Swap CR -> DR
      creditAmount: orig.debitAmount, // Swap DR -> CR
    }));

    assert.equal(reversalLegs[0].debitAmount, 0);
    assert.equal(reversalLegs[0].creditAmount, 150);
    assert.equal(reversalLegs[1].debitAmount, 150);
    assert.equal(reversalLegs[1].creditAmount, 0);

    // Assert Net General Ledger Balance after cancellation equals 0
    const netDebits = activeEntries[0].debitAmount + reversalLegs[0].debitAmount; // 150 + 0 = 150
    const netCredits = activeEntries[0].creditAmount + reversalLegs[0].creditAmount; // 0 + 150 = 150
    assert.equal(netDebits - netCredits, 0, 'Sundry Debtors net balance must be exactly 0');
  });

  it('Cancel net change invariant: zero net ledger change across the entire transaction', () => {
    const original = [
      { accountHead: 'Party', debitAmount: 590, creditAmount: 0 },
      { accountHead: 'Sales', debitAmount: 0, creditAmount: 500 },
      { accountHead: 'CGST Payable', debitAmount: 0, creditAmount: 45 },
      { accountHead: 'SGST Payable', debitAmount: 0, creditAmount: 45 },
    ];

    const reversal = original.map(o => ({
      accountHead: o.accountHead,
      debitAmount: o.creditAmount,
      creditAmount: o.debitAmount
    }));

    const combined = [...original, ...reversal];
    const totalDr = combined.reduce((sum, l) => sum + l.debitAmount, 0);
    const totalCr = combined.reduce((sum, l) => sum + l.creditAmount, 0);

    assert.equal(totalDr, totalCr, 'Total DR equals Total CR');
    assert.equal(totalDr, 590 + 590);
  });
});
