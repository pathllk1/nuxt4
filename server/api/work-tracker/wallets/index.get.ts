import { defineEventHandler, getQuery } from 'h3';
import { getScopedDocs } from '../../../utils/firebase';
import type { Wallet } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const includeArchived = query.includeArchived === 'true';
  const wallets = await getScopedDocs<Wallet>(event, 'wallets');

  return (includeArchived ? wallets : wallets.filter(w => !w.isArchived))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
});
