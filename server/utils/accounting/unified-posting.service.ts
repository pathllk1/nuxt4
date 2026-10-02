import mongoose from 'mongoose';
import Ledger, { type ILedger } from '../../models/Ledger';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import VoucherSequence from '../../models/VoucherSequence';
import Party from '../../models/Party';
import BankAccount from '../../models/BankAccount';
import { enforcePeriodLock } from './period-lock.service';
import { getCurrentFinancialYear } from './bill-utils';
import {
  type IVoucherPayload,
  type IVoucherLeg,
  type IPostingResult,
  type VoucherType,
  VOUCHER_PREFIX_MAP,
  PARTY_REQUIRED_ACCOUNT_TYPES,
  DOUBLE_ENTRY_TOLERANCE,
} from '../../types/accounting';

// ─────────────────────────────────────────────────────────────────────────
// UNIFIED POSTING SERVICE
//
// The single entry point for ALL ledger write operations across the entire
// ERP system. Every module — Billing, Banking, Labor, Daybook, Year-End —
// MUST delegate to this service for any GL writes.
//
// Guarantees:
//   1. Period Lock Guard — rejects writes into frozen fiscal periods
//   2. Account Resolution — validates & auto-creates COA entries
//   3. Double-Entry Parity — asserts ΣDR === ΣCR within tolerance
//   4. Gapless Voucher Numbering — per firm, per type, per FY
//   5. Atomic Storage — all legs inserted within a single MongoDB session
//
// CAUTION: This is a financial-critical service. All changes require
// thorough review and testing against existing posting paths.
// ─────────────────────────────────────────────────────────────────────────

export class UnifiedPostingService {

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Posts a fully-formed voucher to the General Ledger.
   *
   * This is the ONLY function that should ever call Ledger.insertMany().
   * All upstream modules must construct an IVoucherPayload and call this.
   *
   * @param payload - The voucher payload following the IVoucherPayload contract
   * @param session - MongoDB client session. The caller MUST manage the
   *                  transaction lifecycle (startTransaction / commit / abort).
   *                  This service does NOT create or commit transactions — it
   *                  participates in the caller's transaction.
   * @returns IPostingResult with voucherGroupId, voucherNo, and totals
   */
  static async postVoucher(
    payload: IVoucherPayload,
    session?: mongoose.ClientSession
  ): Promise<IPostingResult> {
    const firmIdObj = this.toObjectId(payload.firmId, 'firmId');

    // ── Step 1: Period Lock Guard ──
    if (!payload._bypassPeriodLock) {
      await enforcePeriodLock(firmIdObj, payload.transactionDate, session);
    }

    // ── Step 2: Validate & Resolve Accounts ──
    const resolvedLegs = await this.resolveAndValidateLegs(
      firmIdObj,
      payload.legs,
      session
    );

    // ── Step 3: Double-Entry Parity Check ──
    const { totalDebit, totalCredit } = this.assertDoubleEntryBalance(
      resolvedLegs,
      payload.voucherType,
      payload.narration
    );

    // ── Step 4: Generate or Reuse Voucher Numbers ──
    const financialYear = this.getFinancialYearFromDate(payload.transactionDate);

    let voucherGroupId: string;
    let voucherNo: string;

    if (payload.externalVoucherGroupId && payload.externalVoucherNo) {
      // Backward-compat: caller already has IDs (e.g. legacy billing pipelines)
      voucherGroupId = payload.externalVoucherGroupId;
      voucherNo = payload.externalVoucherNo;
    } else {
      // Generate new gapless sequential numbers
      const seq = await this.getNextSequenceNumber(
        firmIdObj,
        payload.voucherType,
        financialYear,
        session
      );
      voucherGroupId = `${VOUCHER_PREFIX_MAP[payload.voucherType]}-${financialYear}-${String(seq).padStart(6, '0')}`;
      voucherNo = `${VOUCHER_PREFIX_MAP[payload.voucherType]}/${financialYear}/${String(seq).padStart(4, '0')}`;
    }

    // ── Step 5: Construct Ledger Documents ──
    const ledgerDocs = resolvedLegs.map((leg) => ({
      firmId: firmIdObj,
      transactionDate: payload.transactionDate,
      accountHead: leg.accountHead,
      accountType: leg.accountType || 'GENERAL',
      debitAmount: leg.debitAmount || 0,
      creditAmount: leg.creditAmount || 0,
      narration: leg.narration || payload.narration,
      voucherGroupId,
      voucherNo,
      voucherType: payload.voucherType,
      refType: payload.refType || 'VOUCHER',
      refId: payload.refId ? this.toObjectIdSafe(payload.refId) : null,
      partyId: leg.partyId ? this.toObjectIdSafe(leg.partyId) : null,
      bankAccountId: leg.bankAccountId ? this.toObjectIdSafe(leg.bankAccountId) : null,
      stockId: leg.stockId ? this.toObjectIdSafe(leg.stockId) : null,
      stockRegId: leg.stockRegId ? this.toObjectIdSafe(leg.stockRegId) : null,
      paymentMode: leg.paymentMode || null,
      createdBy: payload.createdBy,
    }));

    // ── Step 6: Atomic Insert ──
    await (Ledger as any).insertMany(ledgerDocs, session ? { session } : {});

    return {
      success: true,
      voucherGroupId,
      voucherNo,
      entryCount: ledgerDocs.length,
      totalDebit,
      totalCredit,
    };
  }

  /**
   * Creates a reversal voucher that mirrors an existing voucher with
   * flipped DR/CR amounts. Used for cancellations and corrections.
   *
   * This creates a NEW voucher — the original voucher is NOT deleted.
   * This preserves full audit trail.
   *
   * @param originalVoucherGroupId - The voucherGroupId to reverse
   * @param firmId - Firm isolation key
   * @param reason - Narration explaining the reversal
   * @param createdBy - Username performing the reversal
   * @param session - MongoDB client session (caller manages transaction)
   * @returns IPostingResult for the reversal voucher
   */
  static async reverseVoucher(params: {
    originalVoucherGroupId: string;
    firmId: mongoose.Types.ObjectId | string;
    reason: string;
    createdBy: string;
    reversalDate?: string;
    session?: mongoose.ClientSession;
  }): Promise<IPostingResult> {
    const { originalVoucherGroupId, firmId, reason, createdBy, session } = params;
    const firmIdObj = this.toObjectId(firmId, 'firmId');

    // Fetch the original voucher entries
    const originalEntries = await Ledger.find(
      { firmId: firmIdObj, voucherGroupId: originalVoucherGroupId },
      null,
      session ? { session } : {}
    ).lean();

    if (!originalEntries || originalEntries.length === 0) {
      throw new Error(
        `Cannot reverse: No ledger entries found for voucherGroupId "${originalVoucherGroupId}"`
      );
    }

    // Determine the voucher type and date from the original
    const firstEntry = originalEntries[0]!;
    const originalType = (firstEntry.voucherType || 'JOURNAL') as VoucherType;
    const reversalDate: string = params.reversalDate ||
      firstEntry.transactionDate ||
      (new Date().toISOString().split('T')[0] as string);

    // Construct reversed legs — flip DR ↔ CR
    const reversedLegs: IVoucherLeg[] = originalEntries.map((entry) => ({
      accountHead: entry.accountHead,
      accountType: entry.accountType,
      debitAmount: entry.creditAmount || 0,    // Flipped
      creditAmount: entry.debitAmount || 0,    // Flipped
      partyId: entry.partyId || null,
      bankAccountId: entry.bankAccountId || null,
      stockId: entry.stockId || null,
      stockRegId: entry.stockRegId || null,
      narration: `REVERSAL: ${reason} | Original: ${originalVoucherGroupId}`,
      paymentMode: entry.paymentMode || undefined,
    }));

    // Post the reversal through the standard pipeline (which will
    // enforce period lock, parity check, and assign new voucher numbers)
    return this.postVoucher(
      {
        firmId: firmIdObj,
        voucherType: originalType,
        transactionDate: reversalDate,
        narration: `REVERSAL: ${reason} | Original Voucher: ${originalVoucherGroupId}`,
        legs: reversedLegs,
        createdBy,
        refType: 'REVERSAL',
        tags: { reversedVoucherGroupId: originalVoucherGroupId },
      },
      session
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNAL — Account Resolution & Validation
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Resolves and validates each voucher leg:
   * 1. Normalizes accountHead whitespace
   * 2. Validates partyId is present for party-linked account types
   * 3. Ensures the account exists in ChartOfAccounts (auto-creates if missing)
   * 4. Resolves the canonical accountHead and accountType from COA
   */
  private static async resolveAndValidateLegs(
    firmId: mongoose.Types.ObjectId,
    legs: IVoucherLeg[],
    session?: mongoose.ClientSession
  ): Promise<IVoucherLeg[]> {
    if (!legs || legs.length === 0) {
      throw new Error('Voucher must contain at least one leg');
    }

    const resolved: IVoucherLeg[] = [];

    for (const leg of legs) {
      // Skip zero-amount legs
      const dr = Number(leg.debitAmount) || 0;
      const cr = Number(leg.creditAmount) || 0;
      if (dr === 0 && cr === 0) continue;

      // Normalize account head
      const rawHead = String(leg.accountHead || '').trim().replace(/\s+/g, ' ');
      if (!rawHead) {
        throw new Error('Voucher leg is missing accountHead');
      }

      const fallbackType = (leg.accountType || 'GENERAL').toUpperCase();

      // Resolve from ChartOfAccounts — auto-create if not found
      const { accountHead, accountType } = await this.resolveAccountInCOA(
        firmId,
        rawHead,
        fallbackType,
        session
      );

      let partyId = leg.partyId || null;
      let bankAccountId = leg.bankAccountId || null;

      // Auto-resolve partyId by accountHead if missing on debtor/creditor accounts
      if (!partyId && PARTY_REQUIRED_ACCOUNT_TYPES.has(accountType)) {
        const escaped = rawHead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matchedParty = await Party.findOne(
          {
            $or: [{ firmId }, { firm_id: firmId }],
            name: { $regex: `^${escaped}$`, $options: 'i' },
          },
          '_id',
          { session }
        ).lean();
        if (matchedParty) {
          partyId = matchedParty._id as any;
        }
      }

      // Enforce partyId for party-linked account types (both fallback and COA resolved)
      if ((PARTY_REQUIRED_ACCOUNT_TYPES.has(accountType) || PARTY_REQUIRED_ACCOUNT_TYPES.has(fallbackType)) && !partyId) {
        throw new Error(
          `Account type "${accountType}" requires a registered party. ` +
          `Cannot post to "${rawHead}" without linking to a registered party in Party Master.`
        );
      }

      // Auto-resolve bankAccountId by accountHead if missing on BANK accounts
      if (!bankAccountId && accountType === 'BANK') {
        const escaped = rawHead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matchedBank = await BankAccount.findOne(
          {
            $or: [{ firm_id: firmId }, { firmId: firmId }],
            account_name: { $regex: `^${escaped}$`, $options: 'i' },
          },
          '_id',
          { session }
        ).lean();
        if (matchedBank) {
          bankAccountId = matchedBank._id as any;
        }
      }

      resolved.push({
        ...leg,
        accountHead,
        accountType,
        partyId,
        bankAccountId,
        debitAmount: dr,
        creditAmount: cr,
      });
    }

    if (resolved.length === 0) {
      throw new Error('Voucher has no non-zero legs after processing');
    }

    return resolved;
  }

  /**
   * Looks up an account in ChartOfAccounts. If not found, auto-creates it.
   * Returns the canonical (case-preserved) accountHead and accountType.
   */
  private static async resolveAccountInCOA(
    firmId: mongoose.Types.ObjectId,
    accountHead: string,
    fallbackType: string,
    session?: mongoose.ClientSession
  ): Promise<{ accountHead: string; accountType: string }> {
    // Try to find existing COA entry (case-insensitive, firm-scoped)
    const escapedHead = accountHead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await ChartOfAccounts.findOne(
      {
        $or: [{ firm_id: firmId }, { firmId: firmId }],
        account_name: { $regex: `^${escapedHead}$`, $options: 'i' },
        is_active: true,
      },
      'account_name account_type',
      { session }
    ).lean();

    if (existing) {
      return {
        accountHead: existing.account_name,
        accountType: existing.account_type,
      };
    }

    // Auto-create the COA entry if it doesn't exist
    try {
      const created = await (ChartOfAccounts as any).create(
        [
          {
            firm_id: firmId,
            firmId: firmId,
            account_name: accountHead,
            account_type: fallbackType,
            is_system: false,
            is_active: true,
          },
        ],
        { session }
      );

      return {
        accountHead: created[0].account_name,
        accountType: created[0].account_type,
      };
    } catch (createErr: any) {
      // Handle race condition: another process may have created it concurrently
      if (createErr.code === 11000) {
        const retry = await ChartOfAccounts.findOne(
          {
            $or: [{ firm_id: firmId }, { firmId: firmId }],
            account_name: { $regex: `^${escapedHead}$`, $options: 'i' },
          },
          'account_name account_type',
          { session }
        ).lean();

        if (retry) {
          return {
            accountHead: retry.account_name,
            accountType: retry.account_type,
          };
        }
      }

      // If we still can't resolve, use the raw input as-is
      console.error(`[UnifiedPostingService] Failed to auto-create COA for "${accountHead}":`, createErr.message);
      return { accountHead, accountType: fallbackType };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNAL — Double-Entry Enforcement
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Asserts that the total debits equal the total credits within tolerance.
   * Throws an error with full diagnostic information if the voucher is unbalanced.
   */
  private static assertDoubleEntryBalance(
    legs: IVoucherLeg[],
    voucherType: string,
    narration: string
  ): { totalDebit: number; totalCredit: number } {
    const totalDebit = legs.reduce((sum, leg) => sum + (Number(leg.debitAmount) || 0), 0);
    const totalCredit = legs.reduce((sum, leg) => sum + (Number(leg.creditAmount) || 0), 0);

    const diff = Math.abs(totalDebit - totalCredit);

    if (diff > DOUBLE_ENTRY_TOLERANCE) {
      // Build detailed error message for debugging
      const legDetails = legs
        .map(
          (leg, i) =>
            `  Leg ${i + 1}: ${leg.accountHead} | DR: ${(leg.debitAmount || 0).toFixed(2)} | CR: ${(leg.creditAmount || 0).toFixed(2)}`
        )
        .join('\n');

      throw new Error(
        `Double-entry parity violation in ${voucherType} voucher.\n` +
        `Total Debit: ₹${totalDebit.toFixed(2)}\n` +
        `Total Credit: ₹${totalCredit.toFixed(2)}\n` +
        `Difference: ₹${diff.toFixed(2)} (tolerance: ₹${DOUBLE_ENTRY_TOLERANCE})\n` +
        `Narration: "${narration}"\n` +
        `Legs:\n${legDetails}`
      );
    }

    return { totalDebit, totalCredit };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNAL — Gapless Voucher Sequence Generator
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Atomically increments and returns the next sequence number for a given
   * firm + voucher type + financial year combination.
   *
   * Uses MongoDB's findOneAndUpdate with $inc for atomic increment,
   * which is safe under concurrency (no gaps, no duplicates).
   */
  private static async getNextSequenceNumber(
    firmId: mongoose.Types.ObjectId,
    vtype: VoucherType,
    financialYear: string,
    session?: mongoose.ClientSession
  ): Promise<number> {
    const seq = await VoucherSequence.findOneAndUpdate(
      { firmId, vtype, financialYear },
      { $inc: { lastNo: 1 } },
      { returnDocument: 'after', upsert: true, ...(session ? { session } : {}) }
    );

    if (!seq || !seq.lastNo) {
      throw new Error(`Failed to generate sequence number for ${vtype}/${financialYear}`);
    }

    return seq.lastNo;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNAL — Utility Helpers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Converts a string or ObjectId to mongoose.Types.ObjectId.
   * Throws a clear error if the value is invalid.
   */
  private static toObjectId(value: any, fieldName: string): mongoose.Types.ObjectId {
    const str = String(value);
    if (!mongoose.Types.ObjectId.isValid(str)) {
      throw new Error(`Invalid ${fieldName}: "${str}" is not a valid ObjectId`);
    }
    return new mongoose.Types.ObjectId(str);
  }

  /**
   * Safe ObjectId conversion — returns null for invalid/empty values.
   */
  private static toObjectIdSafe(value: any): mongoose.Types.ObjectId | null {
    if (!value) return null;
    const str = String(value);
    if (!mongoose.Types.ObjectId.isValid(str)) return null;
    return new mongoose.Types.ObjectId(str);
  }

  /**
   * Derives the Indian financial year from a transaction date.
   * e.g. '2026-05-15' → '2026-27', '2027-02-10' → '2026-27'
   */
  private static getFinancialYearFromDate(dateStr: string): string {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // Fallback to current FY if date is malformed
      return getCurrentFinancialYear();
    }

    const parts = dateStr.split('-');
    const year = parseInt(parts[0] || '2026', 10);
    const month = parseInt(parts[1] || '4', 10);

    // Indian FY: April (month 4) to March (month 3)
    if (month >= 4) {
      return `${year}-${String(year + 1).slice(-2)}`;
    } else {
      return `${year - 1}-${String(year).slice(-2)}`;
    }
  }
}
