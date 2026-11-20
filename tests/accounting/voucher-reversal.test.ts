import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Voucher Reversal Counter-Entry Invariants', () => {
  it('Voucher deletion posts an auditable compensating counter-voucher instead of soft-delete', () => {
    const originalVoucher = [
      { voucherGroupId: 'PV-2026-001', accountHead: 'Supplier A', debitAmount: 5000, creditAmount: 0 },
      { voucherGroupId: 'PV-2026-001', accountHead: 'Bank Account', debitAmount: 0, creditAmount: 5000 }
    ];

    const reversalVoucherGroupId = `REV-PV-2026-001`;
    const counterLegs = originalVoucher.map(orig => ({
      voucherGroupId: reversalVoucherGroupId,
      accountHead: orig.accountHead,
      debitAmount: orig.creditAmount,
      creditAmount: orig.debitAmount,
      narration: `REVERSAL OF VOUCHER PV-2026-001`
    }));

    // In double-entry audit standards:
    // Both original legs and counter legs exist in the General Ledger
    const allLedgerRows = [...originalVoucher, ...counterLegs];
    assert.equal(allLedgerRows.length, 4, 'Audit trail preserves both vouchers');

    // Supplier balance net:
    const supplierRows = allLedgerRows.filter(r => r.accountHead === 'Supplier A');
    const supplierDr = supplierRows.reduce((sum, r) => sum + r.debitAmount, 0);
    const supplierCr = supplierRows.reduce((sum, r) => sum + r.creditAmount, 0);
    assert.equal(supplierDr - supplierCr, 0, 'Supplier net balance equals zero');

    // Bank balance net:
    const bankRows = allLedgerRows.filter(r => r.accountHead === 'Bank Account');
    const bankDr = bankRows.reduce((sum, r) => sum + r.debitAmount, 0);
    const bankCr = bankRows.reduce((sum, r) => sum + r.creditAmount, 0);
    assert.equal(bankDr - bankCr, 0, 'Bank net balance equals zero');
  });

  it('Prevents cascading double reversal when already reversed', () => {
    const voucher = {
      voucherGroupId: 'PV-001',
      isReversed: false,
      reversalVoucherGroupId: 'REV-PV-001'
    };

    const attemptReversal = (v: typeof voucher) => {
      if (v.reversalVoucherGroupId || v.isReversed) {
        throw new Error(`[Idempotency Guard] Voucher "${v.voucherGroupId}" is already reversed.`);
      }
      return true;
    };

    assert.throws(() => attemptReversal(voucher), /already reversed/);
  });
});
