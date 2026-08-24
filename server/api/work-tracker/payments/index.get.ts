import { defineEventHandler } from 'h3';
import { getScopedDocs } from '../../../utils/firebase';
import type { Payment } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const payments = await getScopedDocs<Payment>(event, 'payments');
  return payments.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
});
