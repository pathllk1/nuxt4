import { defineEventHandler } from 'h3';
import { getScopedDocs } from '../../../utils/firebase';
import type { Client } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const clients = await getScopedDocs<Client>(event, 'clients');
  return clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
});
