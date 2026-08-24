import { defineEventHandler, readBody, createError } from 'h3';
import { getScopedCollection, getFirestoreDb } from '../../utils/firebase';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || !body.clientId || !body.allocations || !Array.isArray(body.allocations)) {
    throw createError({ statusCode: 400, statusMessage: 'Client ID and allocations are required' });
  }

  const clientId = Number(body.clientId);
  const date = body.date || new Date().toISOString().split('T')[0];
  const method = body.method || 'Cash';
  const reference = body.reference || '';
  const walletId = body.walletId ? Number(body.walletId) : null;
  const baseNote = body.note || 'Bulk Settlement';

  const db = getFirestoreDb();
  const batch = db.batch();
  const paymentsCol = getScopedCollection(event, 'payments');
  let totalAllocated = 0;
  let count = 0;

  for (const alloc of body.allocations) {
    const allocAmount = Number(alloc.allocated);
    if (allocAmount > 0) {
      const id = Date.now() * 1000 + Math.floor(Math.random() * 1000) + count;
      const paymentDoc = paymentsCol.doc(id.toString());
      batch.set(paymentDoc, {
        id,
        workId: Number(alloc.workId),
        clientId,
        walletId,
        amount: allocAmount,
        date,
        paymentType: 'Settlement',
        method,
        reference: reference ? `${reference} [Bulk]` : 'Bulk Settlement',
        note: `${baseNote} (Allocated to Work #${alloc.workId})`,
        isAccountPayment: false,
        createdAt: new Date().toISOString()
      });
      totalAllocated += allocAmount;
      count++;
    }
  }

  // If there is any remaining unallocated excess amount, credit it as direct account payment
  const remaining = (Number(body.amount) || 0) - totalAllocated;
  if (remaining > 0) {
    const id = Date.now() * 1000 + Math.floor(Math.random() * 1000) + count;
    const paymentDoc = paymentsCol.doc(id.toString());
    batch.set(paymentDoc, {
      id,
      workId: null,
      clientId,
      walletId,
      amount: remaining,
      date,
      paymentType: 'Advance',
      method,
      reference: reference || 'Bulk Excess',
      note: `${baseNote} (Unallocated Excess Account Credit)`,
      isAccountPayment: true,
      createdAt: new Date().toISOString()
    });
    count++;
  }

  await batch.commit();
  return {
    success: true,
    totalAllocated,
    totalRecords: count,
    message: `Successfully allocated ₹${totalAllocated} across ${count} payment records`
  };
});
