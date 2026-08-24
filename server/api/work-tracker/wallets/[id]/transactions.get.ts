import { defineEventHandler, getRouterParam, createError } from 'h3';
import { getScopedDocs, getScopedCollection } from '../../../../utils/firebase';
import type { Wallet, Payment, Receipt, Transfer, Expense, Client, WalletTransaction } from '~/types/work-tracker';

const formatDateStr = (d?: string, fallback?: string): string => {
  if (d && typeof d === 'string') {
    const part = d.split('T')[0];
    if (part) return part;
  }
  if (fallback && typeof fallback === 'string') {
    const part = fallback.split('T')[0];
    if (part) return part;
  }
  return new Date().toISOString().slice(0, 10);
};

export default defineEventHandler(async (event) => {
  const idStr = getRouterParam(event, 'id');
  if (!idStr) {
    throw createError({ statusCode: 400, statusMessage: 'Wallet ID is required' });
  }

  const walletId = Number(idStr);
  const walletsCol = getScopedCollection(event, 'wallets');
  const walletDoc = await walletsCol.doc(walletId.toString()).get();

  if (!walletDoc.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Wallet not found' });
  }

  const wallet = { id: Number(walletDoc.id), ...(walletDoc.data() as any) } as Wallet;

  const [payments, receipts, transfers, expenses, clients, allWallets] = await Promise.all([
    getScopedDocs<Payment>(event, 'payments'),
    getScopedDocs<Receipt>(event, 'receipts'),
    getScopedDocs<Transfer>(event, 'transfers'),
    getScopedDocs<Expense>(event, 'expenses'),
    getScopedDocs<Client>(event, 'clients'),
    getScopedDocs<Wallet>(event, 'wallets')
  ]);

  const txs: Array<{
    date: string;
    createdAt: string;
    type: WalletTransaction['type'];
    typeLabel: string;
    category: string;
    party: string;
    description: string;
    reference: string;
    inflow: number;
    outflow: number;
  }> = [];

  // Initial balance
  if (wallet.initialBalance > 0) {
    txs.push({
      date: formatDateStr(wallet.createdAt),
      createdAt: wallet.createdAt || new Date().toISOString(),
      type: 'initial',
      typeLabel: 'Opening Balance',
      category: 'Vault Inflow',
      party: 'System Initial',
      description: 'Opening vault balance',
      reference: 'INIT-BAL',
      inflow: Number(wallet.initialBalance),
      outflow: 0
    });
  }

  // Payments In
  for (const p of payments.filter(item => item.walletId === walletId)) {
    const client = clients.find(c => c.id === p.clientId);
    txs.push({
      date: formatDateStr(p.date, p.createdAt),
      createdAt: p.createdAt || '',
      type: 'payment_in',
      typeLabel: 'Client Payment',
      category: 'Work Inflow',
      party: client ? client.name : 'Unknown Client',
      description: p.note || `Payment via ${p.method}`,
      reference: p.reference || '—',
      inflow: Number(p.amount),
      outflow: 0
    });
  }

  // Receipts In
  for (const r of receipts.filter(item => item.walletId === walletId)) {
    txs.push({
      date: formatDateStr(r.date, r.createdAt),
      createdAt: r.createdAt || '',
      type: 'receipt_in',
      typeLabel: 'Direct Receipt',
      category: r.category || 'Income Receipt',
      party: r.receivedFrom || 'Direct Source',
      description: r.notes || 'Income Receipt',
      reference: r.reference || '—',
      inflow: Number(r.amount),
      outflow: 0
    });
  }

  // Transfers In
  for (const t of transfers.filter(item => item.toWalletId === walletId)) {
    const fromW = allWallets.find(w => w.id === t.fromWalletId);
    txs.push({
      date: formatDateStr(t.date, t.createdAt),
      createdAt: t.createdAt || '',
      type: 'transfer_in',
      typeLabel: 'Transfer In',
      category: 'Inter-Vault Transfer',
      party: fromW ? fromW.name : 'Source Vault',
      description: t.note || `Transfer from ${fromW?.name || 'Vault'}`,
      reference: 'XFER-IN',
      inflow: Number(t.amount),
      outflow: 0
    });
  }

  // Expenses Out
  for (const e of expenses.filter(item => item.walletId === walletId)) {
    txs.push({
      date: formatDateStr(e.date, e.createdAt),
      createdAt: e.createdAt || '',
      type: 'expense_out',
      typeLabel: 'Expense Payment',
      category: e.categoryId || 'Expense',
      party: e.paidTo || 'Vendor / Payee',
      description: e.description || e.notes || 'Operational Expense',
      reference: 'EXP',
      inflow: 0,
      outflow: Number(e.amount)
    });
  }

  // Transfers Out
  for (const t of transfers.filter(item => item.fromWalletId === walletId)) {
    const toW = allWallets.find(w => w.id === t.toWalletId);
    txs.push({
      date: formatDateStr(t.date, t.createdAt),
      createdAt: t.createdAt || '',
      type: 'transfer_out',
      typeLabel: 'Transfer Out',
      category: 'Inter-Vault Transfer',
      party: toW ? toW.name : 'Destination Vault',
      description: t.note || `Transfer to ${toW?.name || 'Vault'}`,
      reference: 'XFER-OUT',
      inflow: 0,
      outflow: Number(t.amount)
    });
  }

  txs.sort((a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime());

  let running = 0;
  const finalTransactions: WalletTransaction[] = txs.map(t => {
    running += t.inflow - t.outflow;
    return {
      ...t,
      runningBalance: running
    };
  });

  return finalTransactions.reverse();
});
