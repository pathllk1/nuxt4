import { defineEventHandler } from 'h3';
import { getScopedDocs } from '../../../utils/firebase';
import type { Receipt } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const receipts = await getScopedDocs<Receipt>(event, 'receipts');
  return receipts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
});
