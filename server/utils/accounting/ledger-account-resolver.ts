import Ledger from '../../models/Ledger';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import { classifyAccountType } from '../../types/accounting';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeLedgerAccountHead(value: string | null | undefined, fallback = 'Other Charges') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  return normalized || fallback;
}

export async function resolveLedgerPostingAccount(params: {
  firmId: any;
  accountHead: string;
  fallbackType: string;
  partyId?: any;
  session?: any;
}) {
  const { firmId, accountHead, fallbackType, partyId = null, session = null } = params;
  
  const normalizedHead = normalizeLedgerAccountHead(accountHead);
  const escapedHead = escapeRegex(normalizedHead);

  let resolvedHead = normalizedHead;
  let resolvedType = fallbackType;

  // 1. Authoritative check against ChartOfAccounts
  try {
    const coaExists = await ChartOfAccounts.findOne({
      $or: [{ firm_id: firmId }, { firmId: firmId }],
      account_name: { $regex: `^${escapedHead}$`, $options: 'i' },
    } as any).session(session || null).lean();

    if (coaExists) {
      resolvedHead = (coaExists as any).account_name || normalizedHead;
      resolvedType = (coaExists as any).account_type || fallbackType;
    } else {
      // 2. If not in COA, check if an existing ledger entry exists for head
      const baseFilter: any = {
        firmId,
        accountHead: { $regex: `^${escapedHead}$`, $options: 'i' },
      };

      const queryOptions: any = { sort: { updatedAt: -1, createdAt: -1 } };
      if (session) queryOptions.session = session;

      const filter = partyId
        ? { ...baseFilter, partyId }
        : { ...baseFilter, partyId: null };

      const existing = await Ledger.findOne(filter, 'accountHead accountType', queryOptions).lean();
      if (existing) {
        resolvedHead = (existing as any)?.accountHead || normalizedHead;
        resolvedType = (existing as any)?.accountType || fallbackType;
      }

      // Provision in ChartOfAccounts with canonical bs_classification
      await ChartOfAccounts.create([{
        firm_id: firmId,
        firmId: firmId,
        account_name: resolvedHead,
        account_type: resolvedType,
        bs_classification: classifyAccountType(resolvedType),
        is_system: true,
        is_active: true,
      }], { session });
    }
  } catch (coaErr: any) {
    console.error('Failed to resolve/create ChartOfAccounts entry:', coaErr.message);
  }

  return {
    accountHead: resolvedHead,
    accountType: resolvedType,
  };
}
