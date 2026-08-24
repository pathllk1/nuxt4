import { defineEventHandler, readBody, createError } from 'h3';
import { getScopedDocs, getScopedCollection, getFirestoreDb } from '../../../utils/firebase';
import type { RecurringTemplate } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const targetMonth = body?.month || new Date().toISOString().substring(0, 7); // YYYY-MM
  const templates = (await getScopedDocs<RecurringTemplate>(event, 'recurring_templates')).filter(t => t.isActive);

  if (templates.length === 0) {
    return { success: true, count: 0, message: 'No active recurring templates found' };
  }

  const db = getFirestoreDb();
  const batch = db.batch();
  const worksCol = getScopedCollection(event, 'works');
  const dateAssigned = `${targetMonth}-01`;
  let count = 0;

  for (const t of templates) {
    const id = Date.now() * 1000 + Math.floor(Math.random() * 1000) + count;
    const workDoc = worksCol.doc(id.toString());
    batch.set(workDoc, {
      id,
      clientId: Number(t.clientId),
      workType: t.workType,
      dateAssigned: dateAssigned,
      dateSubmitted: null,
      totalAmount: Number(t.fixedAmount),
      description: `[Auto-Generated for ${targetMonth}] ${t.description || ''}`.trim(),
      notes: '',
      isRetainer: true,
      createdAt: new Date().toISOString()
    });
    count++;
  }

  await batch.commit();
  return {
    success: true,
    count,
    message: `Successfully generated ${count} work orders for ${targetMonth}`
  };
});
