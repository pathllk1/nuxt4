import mongoose from 'mongoose';
import Party from '../../models/Party';
import type { NormalizedTransaction } from './normalize';

export async function runPostProcessing(
  transactions: NormalizedTransaction[],
  firmId?: string | mongoose.Types.ObjectId
): Promise<NormalizedTransaction[]> {
  if (!transactions || transactions.length === 0) return [];

  // 1. Fetch Firm Parties for Fuzzy Counterparty Auto-Matching
  let firmParties: { name: string; firm: string }[] = [];
  if (firmId && mongoose.Types.ObjectId.isValid(String(firmId))) {
    try {
      firmParties = await Party.find({ firm_id: new mongoose.Types.ObjectId(String(firmId)) })
        .select('name firm')
        .lean() as any[];
    } catch {}
  }

  const seenHashes = new Set<string>();

  for (let i = 0; i < transactions.length; i++) {
    const curr = transactions[i];

    // SHA-256 Duplicate Check
    if (seenHashes.has(curr.rowHash)) {
      curr.isDuplicate = true;
    } else {
      seenHashes.add(curr.rowHash);
    }

    // Running Balance Integrity Check
    if (i > 0 && curr.balance !== undefined) {
      const prev = transactions[i - 1];
      if (prev.balance !== undefined) {
        const expectedBal = Math.round((prev.balance + curr.credit - curr.debit) * 100) / 100;
        const actualBal = Math.round(curr.balance * 100) / 100;
        if (Math.abs(expectedBal - actualBal) > 0.05) {
          curr.balanceMismatch = true;
        }
      }
    }

    // Party Auto-Matching
    if (curr.cleanedNarration && firmParties.length > 0) {
      const cleanLower = curr.cleanedNarration.toLowerCase();
      const matchedParty = firmParties.find(p => {
        const pName = (p.name || '').toLowerCase();
        const pFirm = (p.firm || '').toLowerCase();
        return (pName.length >= 3 && cleanLower.includes(pName)) || (pFirm.length >= 3 && cleanLower.includes(pFirm));
      });

      if (matchedParty) {
        curr.suggestedAccountHead = matchedParty.name || matchedParty.firm;
      }
    }
  }

  return transactions;
}
