import { defineEventHandler } from 'h3';
import { getScopedDocs } from '../../../utils/firebase';
import type { Budget } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const budgets = await getScopedDocs<Budget>(event, 'budgets');
  return budgets.sort((a, b) => (a.month || '').localeCompare(b.month || ''));
});
