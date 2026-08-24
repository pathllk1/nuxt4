import { defineEventHandler } from 'h3';
import { getScopedDocs, getScopedCollection, getFirestoreDb } from '../../utils/firebase';
import type { Wallet, Client } from '~/types/work-tracker';

export default defineEventHandler(async (event) => {
  const [existingWallets, existingClients] = await Promise.all([
    getScopedDocs<Wallet>(event, 'wallets'),
    getScopedDocs<Client>(event, 'clients')
  ]);

  const db = getFirestoreDb();
  const batch = db.batch();
  const walletsCol = getScopedCollection(event, 'wallets');
  const clientsCol = getScopedCollection(event, 'clients');
  let seededCount = 0;

  if (existingWallets.length === 0) {
    const defaultWallets = [
      { name: 'Main Cash Register', type: 'Cash', initialBalance: 10000, color: '#22c55e' },
      { name: 'HDFC Current A/C', type: 'Bank', initialBalance: 50000, color: '#3b82f6' },
      { name: 'Business UPI', type: 'UPI', initialBalance: 5000, color: '#8b5cf6' }
    ];

    for (let i = 0; i < defaultWallets.length; i++) {
      const id = Date.now() * 1000 + (i + 1) * 10;
      batch.set(walletsCol.doc(id.toString()), {
        ...defaultWallets[i],
        id,
        isArchived: false,
        createdAt: new Date().toISOString()
      });
      seededCount++;
    }
  }

  if (existingClients.length === 0) {
    const defaultClients = [
      { name: 'Apex Corp Ltd', phone: '9876543210', email: 'billing@apexcorp.com', billingType: 'monthly_fixed', monthlyRate: 15000, notes: 'VIP Corporate Client' },
      { name: 'Bright Logistics', phone: '9812345678', email: 'accounts@brightlogistics.in', billingType: 'per_work', monthlyRate: null, notes: 'Monthly GST & Vouchers' },
      { name: 'City Retailers Hub', phone: '9765432109', email: 'info@cityretail.com', billingType: 'retainer', monthlyRate: 8500, notes: 'Retainer bookkeeping' }
    ];

    for (let i = 0; i < defaultClients.length; i++) {
      const id = Date.now() * 1000 + (i + 1) * 100;
      batch.set(clientsCol.doc(id.toString()), {
        ...defaultClients[i],
        id,
        createdAt: new Date().toISOString()
      });
      seededCount++;
    }
  }

  if (seededCount > 0) {
    await batch.commit();
  }

  return {
    success: true,
    seededCount,
    message: seededCount > 0 ? `Seeded ${seededCount} initial records into Firestore` : 'Database already initialized'
  };
});
