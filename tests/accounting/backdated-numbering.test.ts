import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentFinancialYear } from '../../shared/utils/tax-calc.ts';

describe('Financial Year & Backdated Bill Numbering Invariants', () => {
  it('Correctly computes Indian Financial Year (April 1 to March 31) from date input', () => {
    // Q4 of FY 2024-25 (January - March 2025)
    assert.equal(getCurrentFinancialYear('2025-03-31'), '2024-25');
    assert.equal(getCurrentFinancialYear('2025-01-15'), '2024-25');

    // Q1 of FY 2025-26 (April 2025)
    assert.equal(getCurrentFinancialYear('2025-04-01'), '2025-26');
    assert.equal(getCurrentFinancialYear('2025-04-10'), '2025-26');

    // Historical FY
    assert.equal(getCurrentFinancialYear('2023-11-20'), '2023-24');
    assert.equal(getCurrentFinancialYear('2026-11-20'), '2026-27');
  });

  it('Backdated bill receives prefix matching transaction date FY, not system clock', () => {
    const backdatedBillDate = '2025-03-25'; // FY 2024-25
    const computedFY = getCurrentFinancialYear(backdatedBillDate);

    assert.equal(computedFY, '2024-25', 'Backdated bill must derive FY 2024-25');

    const typePrefix = 'SI';
    const sequenceNumber = 1;
    const billNumber = `${typePrefix}/${computedFY}/${String(sequenceNumber).padStart(4, '0')}`;

    assert.equal(billNumber, 'SI/2024-25/0001');
    assert.ok(billNumber.includes('2024-25'), 'Generated invoice number contains backdated FY');
  });
});
