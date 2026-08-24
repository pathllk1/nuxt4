import { defineEventHandler } from 'h3';
import { getScopedDocs } from '../../../utils/firebase';
import type { RecurringTemplate } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const templates = await getScopedDocs<RecurringTemplate>(event, 'recurring_templates');
  return templates.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
});
