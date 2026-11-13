import mongoose from 'mongoose';
import Ledger, { type ILedger } from '../../models/Ledger';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import VoucherSequence from '../../models/VoucherSequence';
import Party from '../../models/Party';
import BankAccount from '../../models/BankAccount';
import { enforcePeriodLock, acquirePostingBarrier, verifyPostingBarrier } from './period-lock.service';
import { getCurrentFinancialYear } from './bill-utils';
import {
  type IVoucherPayload,
  type IVoucherLeg,
  type IPostingResult,
  type VoucherType,
  VOUCHER_PREFIX_MAP,
  PARTY_REQUIRED_ACCOUNT_TYPES,
  DOUBLE_ENTRY_TOLERANCE,
  PNL_ACCOUNT_TYPES,
  BALANCE_SHEET_ACCOUNT_TYPES,
  classifyAccountType,
  toPaise,
  fromPaise,
  ACCOUNT_CODE_MAP,
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
    // ── Multi-Leg Transaction Enforcement (F-01, F-08) ──
    // Require transactions for all multi-leg writes. If caller did not provide a session,
    // start an internal transaction and hold the distributed barrier ticket through commit.
    if (!session && payload.legs && payload.legs.length > 1) {
      const firmIdObj = this.toObjectId(payload.firmId, 'firmId');
      const barrierToken = !payload._bypassPeriodLock && !payload._bypassBarrier
        ? await acquirePostingBarrier(firmIdObj, payload.transactionDate, null)
        : null;
      const internalSession = await mongoose.startSession();
      internalSession.startTransaction();
      try {
        const result = await this.postVoucher({ ...payload, _bypassBarrier: true }, internalSession);
        await internalSession.commitTransaction();
        return result;
      } catch (internalErr) {
        await internalSession.abortTransaction();
        throw internalErr;
      } finally {
        internalSession.endSession();
        barrierToken?.release();
      }
    }

    const firmIdObj = this.toObjectId(payload.firmId, 'firmId');

    // ── Step 0: Strict Calendar Date Validation ──
    if (!payload.transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.transactionDate)) {
      throw new Error(`Invalid transactionDate format "${payload.transactionDate}". Expected YYYY-MM-DD.`);
    }
    const parsedDate = new Date(`${payload.transactionDate}T00:00:00Z`);
    if (isNaN(parsedDate.getTime())) {
      throw new Error(`Invalid calendar date "${payload.transactionDate}".`);
    }

    // ── Step 1: Period Lock Guard & In-Flight Posting Barrier (F-01) ──
    const barrierToken = !payload._bypassPeriodLock && !payload._bypassBarrier
      ? await acquirePostingBarrier(firmIdObj, payload.transactionDate, session)
      : null;

    if (session && barrierToken) {
      // Hold barrier ticket until caller actually commits or aborts their session (F-01)
      const origCommit = session.commitTransaction.bind(session);
      const origAbort = session.abortTransaction.bind(session);
      const origEnd = session.endSession ? session.endSession.bind(session) : null;
      let released = false;
      const safeRelease = () => {
        if (!released) {
          released = true;
          barrierToken.release();
        }
      };

      session.commitTransaction = async function (...args: any[]) {
        try {
          return await origCommit(...args);
        } finally {
          safeRelease();
        }
      };

      session.abortTransaction = async function (...args: any[]) {
        try {
          return await origAbort(...args);
        } finally {
          safeRelease();
        }
      };

      if (origEnd) {
        session.endSession = async function (...args: any[]) {
          try {
            return await origEnd(...args);
          } finally {
            safeRelease();
          }
        };
      }
    }

    try {
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
        // Guard against cross-tenant collisions and active duplicate postings (A-11)
        const existing = await Ledger.findOne({
          voucherGroupId: payload.externalVoucherGroupId
        }).session(session || null).lean();

        if (existing) {
          const existingFirmId = String(existing.firmId || existing.firm_id);
          if (existingFirmId !== String(firmIdObj)) {
            throw new Error(
              `[ERP Security Violation] Voucher group ID "${payload.externalVoucherGroupId}" belongs to another firm.`
            );
          }
          if (!existing.isReversed) {
            throw new Error(
              `[ERP Accounting Invariant] Active voucher group "${payload.externalVoucherGroupId}" already exists for this firm. Use updateVoucher or reverseVoucher instead of duplicate posting.`
            );
          }
        }

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
      const isWage = Boolean(payload.tags?.isWageEntry || payload.refType === 'WAGE' || payload.refType === 'WAGE_PAYOUT');
      const masterRollId = payload.tags?.masterRollId ? this.toObjectIdSafe(payload.tags.masterRollId) : null;

      const ledgerDocs = resolvedLegs.map((leg, index) => {
        // Strict Statutory Scoping (F-04):
        // Only attach statutory tax metadata if explicitly defined on this leg,
        // OR if payload.tags.statutory is present and this leg is a tax liability leg (DUTIES_AND_TAXES with CR > 0).
        // NEVER copy statutory tax metadata onto bank, cash, or expense legs!
        const isTaxLiabilityLeg = leg.accountType === 'DUTIES_AND_TAXES' && (leg.creditAmount || 0) > 0;
        const statutory = (leg as any).statutory || (isTaxLiabilityLeg && payload.tags?.statutory?.isTds ? payload.tags.statutory : null);

        return {
          firmId: firmIdObj,
          firm_id: firmIdObj, // Canonical dual-identity mirror
          legIndex: index,
          transactionDate: payload.transactionDate,
          accountHead: leg.accountHead,
          accountType: leg.accountType,
          accountCode: (leg as any).accountCode || ACCOUNT_CODE_MAP[leg.accountType || ''] || null,
          debitAmount: leg.debitAmount || 0,
          creditAmount: leg.creditAmount || 0,
          narration: leg.narration || payload.narration,
          voucherGroupId,
          voucherNo,
          voucherType: payload.voucherType,
          refType: payload.refType || 'VOUCHER',
          refId: (leg as any).refId ? this.toObjectIdSafe((leg as any).refId) : (payload.refId ? this.toObjectIdSafe(payload.refId) : null),
          partyId: leg.partyId ? this.toObjectIdSafe(leg.partyId) : null,
          bankAccountId: leg.bankAccountId ? this.toObjectIdSafe(leg.bankAccountId) : null,
          stockId: leg.stockId ? this.toObjectIdSafe(leg.stockId) : null,
          stockRegId: leg.stockRegId ? this.toObjectIdSafe(leg.stockRegId) : null,
          paymentMode: leg.paymentMode || null,
          isWageEntry: isWage || Boolean((leg as any).isWageEntry),
          masterRollId: (leg as any).masterRollId ? this.toObjectIdSafe((leg as any).masterRollId) : masterRollId,
          replacesVoucherGroupId: payload.tags?.replacesVoucherGroupId || null,
          statutory,
          isReversed: false,
          createdBy: payload.createdBy,
        };
      });

      // ── Step 6: Atomic Insert with Pre-Write Fence & Idempotency Guard (F-01, F-07, F-08) ──
      if (!payload._bypassPeriodLock) {
        // Fresh read immediately before writing documents to block if a close worker acquired the lock during resolution
        await verifyPostingBarrier(firmIdObj, payload.transactionDate);
      }

      try {
        await (Ledger as any).insertMany(ledgerDocs, session ? { session } : {});
      } catch (insertError: any) {
        if (insertError.code === 11000) {
          // F-08: If duplicate key occurs within an active caller-managed transaction,
          // the transaction has been invalidated in MongoDB driver. We must NOT return success
          // because the caller's transaction cannot be committed. Fail closed immediately.
          if (session && session.inTransaction()) {
            const dupErr: any = new Error(
              `[ERP Concurrency Violation] Duplicate key collision on voucher "${payload.externalVoucherGroupId || voucherGroupId}" inside an active caller transaction. Caller transaction has been invalidated and cannot be committed.`
            );
            dupErr.code = 11000;
            dupErr.statusCode = 409;
            dupErr.voucherGroupId = payload.externalVoucherGroupId || voucherGroupId;
            throw dupErr;
          }

          // Concurrency idempotency: if duplicate key hit for voucherGroupId without active session,
          // query existing committed entries to verify exact payload equivalence (F-08)
          const targetVoucherGroupId = payload.externalVoucherGroupId || voucherGroupId;
          const existingDocs = await Ledger.find({
            $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
            voucherGroupId: targetVoucherGroupId,
            isReversed: { $ne: true }
          }).lean();

          if (existingDocs && existingDocs.length > 0) {
            // Sort existing documents strictly by legIndex
            const sortedExisting = [...existingDocs].sort((a, b) => (Number(a.legIndex) || 0) - (Number(b.legIndex) || 0));

            // 1. Verify exact leg count match
            if (sortedExisting.length !== ledgerDocs.length) {
              throw new Error(
                `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg count mismatch. Existing committed: ${sortedExisting.length} legs, Retry requested: ${ledgerDocs.length} legs.`
              );
            }

            // 2. Verify voucher-level header identity (F-08)
            const firstEx = sortedExisting[0]!;
            if (firstEx.voucherType !== payload.voucherType) {
              throw new Error(
                `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": voucherType mismatch. Existing: "${firstEx.voucherType}", Requested: "${payload.voucherType}".`
              );
            }
            if (firstEx.transactionDate !== payload.transactionDate) {
              throw new Error(
                `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": transactionDate mismatch. Existing: "${firstEx.transactionDate}", Requested: "${payload.transactionDate}".`
              );
            }
            if ((firstEx.refType || 'VOUCHER') !== (payload.refType || 'VOUCHER')) {
              throw new Error(
                `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": refType mismatch. Existing: "${firstEx.refType}", Requested: "${payload.refType}".`
              );
            }
            const exRefId = firstEx.refId ? String(firstEx.refId) : '';
            const reqRefId = payload.refId ? String(payload.refId) : '';
            if (exRefId !== reqRefId) {
              throw new Error(
                `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": refId mismatch. Existing: "${exRefId}", Requested: "${reqRefId}".`
              );
            }

            // 3. Verify complete canonical per-leg payload identity (F-08)
            for (let i = 0; i < ledgerDocs.length; i++) {
              const exLeg = sortedExisting[i]!;
              const reqLeg = ledgerDocs[i]!;

              const exHead = (exLeg.accountHead || '').trim().toLowerCase();
              const reqHead = (reqLeg.accountHead || '').trim().toLowerCase();
              if (exHead !== reqHead) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} accountHead mismatch. Existing: "${exLeg.accountHead}", Requested: "${reqLeg.accountHead}".`
                );
              }

              if (exLeg.accountType !== reqLeg.accountType) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} accountType mismatch. Existing: "${exLeg.accountType}", Requested: "${reqLeg.accountType}".`
                );
              }

              const drDiff = Math.abs((Number(exLeg.debitAmount) || 0) - (Number(reqLeg.debitAmount) || 0));
              const crDiff = Math.abs((Number(exLeg.creditAmount) || 0) - (Number(reqLeg.creditAmount) || 0));
              if (drDiff > 0.01 || crDiff > 0.01) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} amount mismatch. Existing: DR ${exLeg.debitAmount}/CR ${exLeg.creditAmount}, Requested: DR ${reqLeg.debitAmount}/CR ${reqLeg.creditAmount}.`
                );
              }

              const exParty = exLeg.partyId ? String(exLeg.partyId) : '';
              const reqParty = reqLeg.partyId ? String(reqLeg.partyId) : '';
              if (exParty !== reqParty) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} partyId mismatch. Existing: "${exParty}", Requested: "${reqParty}".`
                );
              }

              const exBank = exLeg.bankAccountId ? String(exLeg.bankAccountId) : '';
              const reqBank = reqLeg.bankAccountId ? String(reqLeg.bankAccountId) : '';
              if (exBank !== reqBank) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} bankAccountId mismatch. Existing: "${exBank}", Requested: "${reqBank}".`
                );
              }

              const exStock = exLeg.stockId ? String(exLeg.stockId) : '';
              const reqStock = reqLeg.stockId ? String(reqLeg.stockId) : '';
              if (exStock !== reqStock) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} stockId mismatch. Existing: "${exStock}", Requested: "${reqStock}".`
                );
              }

              const exStockReg = exLeg.stockRegId ? String(exLeg.stockRegId) : '';
              const reqStockReg = reqLeg.stockRegId ? String(reqLeg.stockRegId) : '';
              if (exStockReg !== reqStockReg) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} stockRegId mismatch. Existing: "${exStockReg}", Requested: "${reqStockReg}".`
                );
              }

              const exPayMode = exLeg.paymentMode || '';
              const reqPayMode = reqLeg.paymentMode || '';
              if (exPayMode !== reqPayMode) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} paymentMode mismatch. Existing: "${exPayMode}", Requested: "${reqPayMode}".`
                );
              }

              if (Boolean(exLeg.isWageEntry) !== Boolean(reqLeg.isWageEntry)) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} isWageEntry mismatch.`
                );
              }

              const exRoll = exLeg.masterRollId ? String(exLeg.masterRollId) : '';
              const reqRoll = reqLeg.masterRollId ? String(reqLeg.masterRollId) : '';
              if (exRoll !== reqRoll) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} masterRollId mismatch. Existing: "${exRoll}", Requested: "${reqRoll}".`
                );
              }

              const exNarr = (exLeg.narration || '').trim();
              const reqNarr = (reqLeg.narration || '').trim();
              if (exNarr !== reqNarr) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} narration mismatch. Existing: "${exNarr}", Requested: "${reqNarr}".`
                );
              }

              // Deep Statutory Metadata Equivalence (F-08)
              const exStat = exLeg.statutory;
              const reqStat = reqLeg.statutory;
              if (Boolean(exStat) !== Boolean(reqStat)) {
                throw new Error(
                  `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} statutory metadata presence mismatch.`
                );
              }
              if (exStat && reqStat) {
                if ((exStat.tdsSection || '') !== (reqStat.tdsSection || '')) {
                  throw new Error(
                    `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} statutory tdsSection mismatch.`
                  );
                }
                if ((exStat.pan || '').toUpperCase() !== (reqStat.pan || '').toUpperCase()) {
                  throw new Error(
                    `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} statutory PAN mismatch.`
                  );
                }
                if (Number(exStat.tdsRate || 0) !== Number(reqStat.tdsRate || 0)) {
                  throw new Error(
                    `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} statutory tdsRate mismatch.`
                  );
                }
                if (Math.abs((Number(exStat.tdsAmount) || 0) - (Number(reqStat.tdsAmount) || 0)) > 0.01) {
                  throw new Error(
                    `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} statutory tdsAmount mismatch.`
                  );
                }
                if (Math.abs((Number(exStat.taxableAmount) || 0) - (Number(reqStat.taxableAmount) || 0)) > 0.01) {
                  throw new Error(
                    `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} statutory taxableAmount mismatch.`
                  );
                }
                if (String(exStat.deducteeId || '') !== String(reqStat.deducteeId || '')) {
                  throw new Error(
                    `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} statutory deducteeId mismatch.`
                  );
                }
                if ((exStat.deducteeName || '').trim().toLowerCase() !== (reqStat.deducteeName || '').trim().toLowerCase()) {
                  throw new Error(
                    `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} statutory deducteeName mismatch.`
                  );
                }
                if (Boolean(exStat.isGrossUp) !== Boolean(reqStat.isGrossUp)) {
                  throw new Error(
                    `[ERP Concurrency Violation] Idempotent replay rejected for voucherGroupId "${targetVoucherGroupId}": Leg #${i} statutory isGrossUp mismatch.`
                  );
                }
              }
            }

            const drTotal = sortedExisting.reduce((s, d) => s + (d.debitAmount || 0), 0);
            const crTotal = sortedExisting.reduce((s, d) => s + (d.creditAmount || 0), 0);

            return {
              success: true,
              voucherGroupId: sortedExisting[0]!.voucherGroupId!,
              voucherNo: sortedExisting[0]!.voucherNo!,
              entryCount: sortedExisting.length,
              totalDebit: drTotal,
              totalCredit: crTotal,
              isIdempotentReplay: true
            };
          }
        }
        throw insertError;
      }

      return {
        success: true,
        voucherGroupId,
        voucherNo,
        entryCount: ledgerDocs.length,
        totalDebit,
        totalCredit,
      };
    } finally {
      if (!session) {
        barrierToken?.release();
      }
    }
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
      {
        $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
        voucherGroupId: originalVoucherGroupId
      },
      null,
      session ? { session } : {}
    ).lean();

    if (!originalEntries || originalEntries.length === 0) {
      throw new Error(
        `Cannot reverse: No ledger entries found for voucherGroupId "${originalVoucherGroupId}"`
      );
    }

    // Invariant: Guard against double-reversal cascades
    if (originalEntries.some((e: any) => e.reversalVoucherGroupId || e.isReversed || (e.tags && e.tags.reversedByVoucherGroupId))) {
      throw new Error(
        `[Idempotency Guard] Voucher "${originalVoucherGroupId}" is already reversed. Duplicate reversal rejected.`
      );
    }

    // Determine the voucher type and date from the original
    const firstEntry = originalEntries[0]!;
    const originalType = (firstEntry.voucherType || 'JOURNAL') as VoucherType;
    const reversalDate: string = params.reversalDate ||
      firstEntry.transactionDate ||
      (new Date().toISOString().split('T')[0] as string);

    // Construct reversed legs — flip DR ↔ CR and preserve full dimensional metadata
    const reversedLegs: IVoucherLeg[] = originalEntries.map((entry: any) => ({
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
      isWageEntry: entry.isWageEntry,
      masterRollId: entry.masterRollId || null,
      statutory: entry.statutory || null,
      refId: entry.refId || null,
    }));

    // Post the reversal through the standard pipeline (which will
    // enforce period lock, parity check, and assign new voucher numbers)
    const reversalResult = await this.postVoucher(
      {
        firmId: firmIdObj,
        voucherType: originalType,
        transactionDate: reversalDate,
        narration: `REVERSAL: ${reason} | Original Voucher: ${originalVoucherGroupId}`,
        legs: reversedLegs,
        createdBy,
        refType: 'REVERSAL',
        tags: {
          reversedVoucherGroupId: originalVoucherGroupId,
          isReversalVoucher: true,
          masterRollId: firstEntry.masterRollId ? String(firstEntry.masterRollId) : undefined,
          isWageEntry: firstEntry.isWageEntry || undefined
        },
      },
      session
    );

    // Link original entries to reversal voucher with audit metadata
    // STATUTORY ERP SEMANTICS (F-01):
    // When a counter-voucher is posted, BOTH the original voucher AND the counter-voucher
    // remain active in the General Ledger. The counter-voucher (flipped DR/CR) mathematically
    // nets the account balances to zero. Marking the original isReversed: true would cause
    // effective-ledger queries ({ isReversed: { $ne: true } }) to omit the original while
    // including the counter-voucher, improperly moving the balance by -X instead of 0.
    await Ledger.updateMany(
      {
        $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
        voucherGroupId: originalVoucherGroupId
      },
      {
        $set: {
          reversalVoucherGroupId: reversalResult.voucherGroupId,
          reversedAt: new Date(),
          reversedBy: createdBy,
        }
      },
      session ? { session } : {}
    );

    return reversalResult;
  }

  /**
   * Modifies an existing voucher in the General Ledger.
   * Atomically replaces existing legs with new legs while preserving
   * voucherGroupId, voucherNo, createdBy, and createdAt.
   *
   * Guarantees:
   *   1. Period Lock Guard on both old and new transaction dates
   *   2. Financial Year consistency (cannot cross FY boundaries)
   *   3. Subsystem integrity guards (rejects Commercial Bills and Labor Settlements)
   *   4. Account resolution and auto-creation via COA
   *   5. Double-entry parity check
   *   6. Atomic replacement within client session
   */
  static async updateVoucher(params: {
    firmId: mongoose.Types.ObjectId | string;
    voucherGroupId: string;
    payload: IVoucherPayload;
    session?: mongoose.ClientSession;
  }): Promise<IPostingResult> {
    const { voucherGroupId, payload, session } = params;
    const firmIdObj = this.toObjectId(params.firmId, 'firmId');

    // 1. Locate existing entries
    const existingEntries = await Ledger.find(
      {
        $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
        voucherGroupId: voucherGroupId.trim()
      },
      null,
      session ? { session } : {}
    ).lean();

    if (!existingEntries || existingEntries.length === 0) {
      throw new Error(`Voucher "${voucherGroupId}" not found in General Ledger`);
    }

    const firstEntry = existingEntries[0]!;

    // 2. Subsystem integrity guard
    if (['BILL', 'SALE', 'PURCHASE'].includes(String(firstEntry.refType).toUpperCase())) {
      throw new Error('This voucher was generated by a Commercial Bill. Please modify the bill in the Bills module to preserve inventory and GST integrity.');
    }

    // 3. Period Lock Guard: both old date and new date must be open
    if (!payload._bypassPeriodLock) {
      if (firstEntry.transactionDate) {
        await enforcePeriodLock(firmIdObj, firstEntry.transactionDate, session);
      }
      await enforcePeriodLock(firmIdObj, payload.transactionDate, session);
    }

    // 4. Financial Year Guard: changing date across FYs alters sequence series
    const oldFY = this.getFinancialYearFromDate(firstEntry.transactionDate);
    const newFY = this.getFinancialYearFromDate(payload.transactionDate);
    if (oldFY !== newFY) {
      throw new Error(`Cannot move voucher across financial years (${oldFY} -> ${newFY}). Please delete and recreate the voucher in the target financial year.`);
    }

    // 5. Account resolution and validation
    const resolvedLegs = await this.resolveAndValidateLegs(
      firmIdObj,
      payload.legs,
      session
    );

    // 6. Double-entry parity check
    const { totalDebit, totalCredit } = this.assertDoubleEntryBalance(
      resolvedLegs,
      payload.voucherType || (firstEntry.voucherType as VoucherType) || 'JOURNAL',
      payload.narration
    );

    // 7. Neutralize old legs (Statutory Audit Immutability: Never delete General Ledger records)
    await Ledger.updateMany(
      {
        $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
        voucherGroupId: voucherGroupId.trim(),
        isReversed: { $ne: true }
      },
      {
        $set: {
          isReversed: true,
          reversedAt: new Date(),
          reversedBy: payload.createdBy || 'system',
          replacesVoucherGroupId: voucherGroupId.trim()
        }
      },
      session ? { session } : {}
    );

    // 8. Re-insert new legs preserving original metadata
    const isWage = Boolean(payload.tags?.isWageEntry || payload.refType === 'WAGE' || payload.refType === 'WAGE_PAYOUT' || firstEntry.isWageEntry);
    const masterRollId = payload.tags?.masterRollId
      ? this.toObjectIdSafe(payload.tags.masterRollId)
      : (firstEntry.masterRollId ? this.toObjectIdSafe(firstEntry.masterRollId) : null);

    const ledgerDocs = resolvedLegs.map((leg, index) => ({
      firmId: firmIdObj,
      firm_id: firmIdObj,
      legIndex: index,
      transactionDate: payload.transactionDate,
      accountHead: leg.accountHead,
      accountType: leg.accountType,
      accountCode: (leg as any).accountCode || ACCOUNT_CODE_MAP[leg.accountType || ''] || null,
      debitAmount: leg.debitAmount || 0,
      creditAmount: leg.creditAmount || 0,
      narration: leg.narration || payload.narration,
      voucherGroupId: firstEntry.voucherGroupId,
      voucherNo: firstEntry.voucherNo,
      voucherType: payload.voucherType || firstEntry.voucherType || 'JOURNAL',
      refType: firstEntry.refType || 'VOUCHER',
      refId: firstEntry.refId ? this.toObjectIdSafe(firstEntry.refId) : null,
      partyId: leg.partyId ? this.toObjectIdSafe(leg.partyId) : null,
      bankAccountId: leg.bankAccountId ? this.toObjectIdSafe(leg.bankAccountId) : null,
      stockId: leg.stockId ? this.toObjectIdSafe(leg.stockId) : null,
      stockRegId: leg.stockRegId ? this.toObjectIdSafe(leg.stockRegId) : null,
      paymentMode: leg.paymentMode || null,
      isWageEntry: isWage,
      masterRollId,
      replacesVoucherGroupId: voucherGroupId.trim(),
      statutory: leg.statutory || null,
      isReversed: false,
      createdBy: firstEntry.createdBy || payload.createdBy,
      createdAt: firstEntry.createdAt,
      updatedAt: new Date()
    }));

    await (Ledger as any).insertMany(ledgerDocs, session ? { session } : {});

    return {
      success: true,
      voucherGroupId: firstEntry.voucherGroupId!,
      voucherNo: firstEntry.voucherNo!,
      entryCount: ledgerDocs.length,
      totalDebit,
      totalCredit,
    };
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
      // Validate amount invariants (Finding A-06)
      const dr = leg.debitAmount !== undefined && leg.debitAmount !== null ? Number(leg.debitAmount) : 0;
      const cr = leg.creditAmount !== undefined && leg.creditAmount !== null ? Number(leg.creditAmount) : 0;

      if (!Number.isFinite(dr) || !Number.isFinite(cr) || isNaN(dr) || isNaN(cr)) {
        throw new Error(`Invalid non-finite amount in voucher leg for account "${leg.accountHead}"`);
      }
      if (dr < 0 || cr < 0) {
        throw new Error(`Negative amount prohibited in voucher leg for account "${leg.accountHead}". Use opposite debit/credit polarity.`);
      }
      if (dr > 0 && cr > 0) {
        throw new Error(`Dual-sided leg prohibited for account "${leg.accountHead}". A leg must be strictly Debit or strictly Credit.`);
      }

      // Skip zero-amount legs
      if (dr === 0 && cr === 0) continue;

      // Normalize account head
      const rawHead = String(leg.accountHead || '').trim().replace(/\s+/g, ' ');
      if (!rawHead) {
        throw new Error('Voucher leg is missing accountHead');
      }

      const fallbackType = (leg.accountType || 'GENERAL').toUpperCase();

      // Resolve from ChartOfAccounts — auto-create if not found
      const { accountHead, accountType, accountCode } = await this.resolveAccountInCOA(
        firmId,
        rawHead,
        fallbackType,
        session
      );

      let partyId = leg.partyId || null;
      let bankAccountId = leg.bankAccountId || null;

      // Validate & resolve partyId for party-linked account types
      if (PARTY_REQUIRED_ACCOUNT_TYPES.has(accountType) || PARTY_REQUIRED_ACCOUNT_TYPES.has(fallbackType)) {
        let isValidParty = false;
        if (partyId) {
          const exists = await Party.exists({
            _id: partyId,
            $or: [{ firmId }, { firm_id: firmId }],
          }).session(session || null);
          if (exists) isValidParty = true;
        }

        // If partyId was missing or invalid (e.g. caller passed a COA id):
        if (!isValidParty) {
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
          } else {
            partyId = null;
          }
        }
      }

      // Enforce partyId for party-linked account types (both fallback and COA resolved)
      if ((PARTY_REQUIRED_ACCOUNT_TYPES.has(accountType) || PARTY_REQUIRED_ACCOUNT_TYPES.has(fallbackType)) && !partyId) {
        throw new Error(
          `Account type "${accountType}" requires a registered party. ` +
          `Cannot post to "${rawHead}" without linking to a registered party in Party Master.`
        );
      }

      // Validate & resolve bankAccountId on BANK accounts
      if (accountType === 'BANK' || fallbackType === 'BANK') {
        let isValidBank = false;
        if (bankAccountId) {
          const exists = await BankAccount.exists({
            _id: bankAccountId,
            $or: [{ firm_id: firmId }, { firmId: firmId }],
          }).session(session || null);
          if (exists) isValidBank = true;
        }

        if (!isValidBank) {
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
      }

      resolved.push({
        ...leg,
        accountHead,
        accountType,
        accountCode,
        partyId,
        bankAccountId,
        debitAmount: dr,
        creditAmount: cr,
      } as any);
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
  ): Promise<{ accountHead: string; accountType: string; accountCode?: string | null }> {
    // Try to find existing COA entry (case-insensitive, firm-scoped)
    const escapedHead = accountHead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await ChartOfAccounts.findOne(
      {
        $or: [{ firm_id: firmId }, { firmId: firmId }],
        account_name: { $regex: `^${escapedHead}$`, $options: 'i' },
        is_active: true,
      },
      'account_name account_type account_code',
      { session }
    ).lean();

    if (existing) {
      return {
        accountHead: existing.account_name,
        accountType: existing.account_type,
        accountCode: existing.account_code || ACCOUNT_CODE_MAP[existing.account_type] || null,
      };
    }

    // Validate that the requested account type is a recognized canonical accounting category
    const normalizedType = (fallbackType || '').toUpperCase().trim();
    if (!PNL_ACCOUNT_TYPES.has(normalizedType) && !BALANCE_SHEET_ACCOUNT_TYPES.has(normalizedType)) {
      throw new Error(
        `[UnifiedPostingService Rejection] Cannot register ledger account "${accountHead}": ` +
        `"${fallbackType}" is not a recognized Chart of Accounts classification.`
      );
    }

    // Auto-create the COA entry if it doesn't exist
    const bsClass = classifyAccountType(normalizedType);
    const accountCode = ACCOUNT_CODE_MAP[normalizedType] || null;
    try {
      const created = await (ChartOfAccounts as any).create(
        [
          {
            firm_id: firmId,
            firmId: firmId,
            account_name: accountHead,
            account_type: normalizedType,
            account_code: accountCode,
            bs_classification: bsClass,
            is_system: false,
            is_active: true,
          },
        ],
        { session }
      );

      return {
        accountHead: created[0].account_name,
        accountType: created[0].account_type,
        accountCode: created[0].account_code || accountCode,
      };
    } catch (createErr: any) {
      // Handle race condition: another process may have created it concurrently
      if (createErr.code === 11000) {
        const retry = await ChartOfAccounts.findOne(
          {
            $or: [{ firm_id: firmId }, { firmId: firmId }],
            account_name: { $regex: `^${escapedHead}$`, $options: 'i' },
          },
          'account_name account_type account_code',
          { session }
        ).lean();

        if (retry) {
          return {
            accountHead: retry.account_name,
            accountType: retry.account_type,
            accountCode: retry.account_code || ACCOUNT_CODE_MAP[retry.account_type] || null,
          };
        }
      }

      console.error(`[UnifiedPostingService] Critical: Failed to provision COA account "${accountHead}":`, createErr.message);
      throw new Error(
        `[UnifiedPostingService Account Provisioning Failure] Cannot post voucher leg to "${accountHead}". ` +
        `Failed to register master account in Chart of Accounts: ${createErr.message}`
      );
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
    const totalDebitPaise = legs.reduce((sum, leg) => sum + toPaise(leg.debitAmount), 0);
    const totalCreditPaise = legs.reduce((sum, leg) => sum + toPaise(leg.creditAmount), 0);

    const diffPaise = Math.abs(totalDebitPaise - totalCreditPaise);

    if (diffPaise > 0) {
      // Build detailed error message for debugging
      const legDetails = legs
        .map(
          (leg, i) =>
            `  Leg ${i + 1}: ${leg.accountHead} | DR: ₹${(leg.debitAmount || 0).toFixed(2)} (${toPaise(leg.debitAmount)} paise) | CR: ₹${(leg.creditAmount || 0).toFixed(2)} (${toPaise(leg.creditAmount)} paise)`
        )
        .join('\n');

      throw new Error(
        `Double-entry parity violation in ${voucherType} voucher.\n` +
        `Total Debit: ₹${fromPaise(totalDebitPaise).toFixed(2)} (${totalDebitPaise} paise)\n` +
        `Total Credit: ₹${fromPaise(totalCreditPaise).toFixed(2)} (${totalCreditPaise} paise)\n` +
        `Discrepancy: ₹${fromPaise(diffPaise).toFixed(2)} (${diffPaise} paise)\n` +
        `Zero Tolerance: Debits must equal Credits to the exact integer paise (±₹0.00).\n` +
        `Narration: "${narration}"\n` +
        `Legs:\n${legDetails}`
      );
    }

    return { totalDebit: fromPaise(totalDebitPaise), totalCredit: fromPaise(totalCreditPaise) };
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
