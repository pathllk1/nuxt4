import { defineEventHandler } from 'h3';
import { getScopedDocs } from '../../../utils/firebase';
import type { Expense } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const expenses = await getScopedDocs<Expense>(event, 'expenses');
  return expenses.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
});
