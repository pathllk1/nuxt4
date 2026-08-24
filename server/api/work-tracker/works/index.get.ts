import { defineEventHandler } from 'h3';
import { getScopedDocs } from '../../../utils/firebase';
import type { Work } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const works = await getScopedDocs<Work>(event, 'works');
  return works.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
});
