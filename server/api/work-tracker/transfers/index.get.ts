import { defineEventHandler } from 'h3';
import { getScopedDocs } from '../../../utils/firebase';
import type { Transfer } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const transfers = await getScopedDocs<Transfer>(event, 'transfers');
  return transfers.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
});
