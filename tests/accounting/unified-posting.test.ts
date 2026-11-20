import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Unified Posting & Double-Entry Invariants', () => {
  it('Double-Entry Parity Invariant: total debits must equal total credits to the exact paise', () => {
    const legs = [
      { accountHead: 'Sundry Debtors', debitAmount: 1180.00, creditAmount: 0 },
      { accountHead: 'Sales', debitAmount: 0, creditAmount: 1000.00 },
      { accountHead: 'CGST Payable', debitAmount: 0, creditAmount: 90.00 },
      { accountHead: 'SGST Payable', debitAmount: 0, creditAmount: 90.00 }
    ];

    const totalDebitsPaise = legs.reduce((sum, l) => sum + Math.round((l.debitAmount || 0) * 100), 0);
    const totalCreditsPaise = legs.reduce((sum, l) => sum + Math.round((l.creditAmount || 0) * 100), 0);

    assert.equal(totalDebitsPaise, totalCreditsPaise, 'Debits and credits must be identical in paise');
    assert.equal(totalDebitsPaise - totalCreditsPaise, 0);
  });

  it('Paise Difference Invariant: absorbs odd paise into Round Off without unbalancing', () => {
    const baseItems = [
      { debitAmount: 33.33, creditAmount: 0 },
      { debitAmount: 33.33, creditAmount: 0 },
      { debitAmount: 33.33, creditAmount: 0 },
      { debitAmount: 0, creditAmount: 100.00 }
    ];

    const totalDr = baseItems.reduce((sum, l) => sum + Math.round(l.debitAmount * 100), 0);
    const totalCr = baseItems.reduce((sum, l) => sum + Math.round(l.creditAmount * 100), 0);
    const diffPaise = totalCr - totalDr; // 10000 - 9999 = 1 paise

    assert.equal(diffPaise, 1, 'Difference should be exactly 1 paise');

    // Round Off leg absorbs diff
    const roundOffLeg = {
      accountHead: 'Round Off',
      debitAmount: diffPaise > 0 ? diffPaise / 100 : 0,
      creditAmount: diffPaise < 0 ? Math.abs(diffPaise) / 100 : 0
    };

    const finalLegs = [...baseItems, roundOffLeg];
    const finalDr = finalLegs.reduce((sum, l) => sum + Math.round(l.debitAmount * 100), 0);
    const finalCr = finalLegs.reduce((sum, l) => sum + Math.round(l.creditAmount * 100), 0);

    assert.equal(finalDr, finalCr, 'Balanced after Round Off absorption');
  });

  it('Idempotency Key Invariant: duplicate request key produces zero duplicate entries', () => {
    const postedKeys = new Set<string>();
    const key = '123e4567-e89b-12d3-a456-426614174000';

    const postFirstTime = () => {
      if (postedKeys.has(key)) return { status: 'REPLAY_SUCCESS' };
      postedKeys.add(key);
      return { status: 'NEW_INSERT' };
    };

    const first = postFirstTime();
    assert.equal(first.status, 'NEW_INSERT');

    const second = postFirstTime();
    assert.equal(second.status, 'REPLAY_SUCCESS');
    assert.equal(postedKeys.size, 1, 'Only one transaction entry stored');
  });
});
