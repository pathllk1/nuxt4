import Ledger from '../../models/Ledger';
import ChartOfAccounts from '../../models/ChartOfAccounts';

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

  const resolvedHead = (existing as any)?.accountHead || normalizedHead;
  const resolvedType = (existing as any)?.accountType || fallbackType;

  // Dynamically ensure it exists in ChartOfAccounts
  try {
    const coaExists = await ChartOfAccounts.findOne({
      firm_id: firmId,
      account_name: resolvedHead,
    } as any).session(session || null).lean();

    if (!coaExists) {
      await ChartOfAccounts.create([{
        firm_id: firmId,
        account_name: resolvedHead,
        account_type: resolvedType,
        is_system: true,
        is_active: true,
      }], { session });
    }
  } catch (coaErr: any) {
    console.error('Failed to auto-create ChartOfAccounts entry:', coaErr.message);
  }

  return {
    accountHead: resolvedHead,
    accountType: resolvedType,
  };
}
