import 'dotenv/config';
import mongoose from 'mongoose';

async function audit() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // 1. Distinct COA account_type
  const coaTypes = await mongoose.connection.db.collection('chartofaccounts').distinct('account_type');
  console.log('\n=== DISTINCT COA ACCOUNT TYPES ===');
  console.log(coaTypes);

  // 2. Distinct Ledger accountType
  const ledgerTypes = await mongoose.connection.db.collection('ledgers').distinct('accountType');
  console.log('\n=== DISTINCT LEDGER ACCOUNT TYPES ===');
  console.log(ledgerTypes);

  // 3. Count by type in COA
  const coaCounts = await mongoose.connection.db.collection('chartofaccounts').aggregate([
    { $group: { _id: '$account_type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('\n=== COA ACCOUNTS COUNT BY TYPE ===');
  console.log(coaCounts);

  // 4. Count by type in Ledgers
  const ledgerCounts = await mongoose.connection.db.collection('ledgers').aggregate([
    { $group: { _id: '$accountType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('\n=== LEDGER ENTRIES COUNT BY TYPE ===');
  console.log(ledgerCounts);

  // 5. Look for ledger entries whose accountType is NOT recognized in UNIVERSAL_MASTER_ACCOUNT_TYPES
  const UNIVERSAL_MASTER_ACCOUNT_TYPES = new Set([
    'ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'CAPITAL',
    'DEBTOR', 'CREDITOR', 'SUNDRY_DEBTORS', 'SUNDRY_CREDITORS',
    'RECEIVABLE', 'PAYABLE', 'TRANSPORTER',
    'CASUAL_LABOR', 'LABOR_LEADER', 'STAFF',
    'LOANS_BORROWINGS', 'LOANS_ADVANCES',
    'DIRECT_EXPENSE', 'DIRECT_INCOME', 'INDIRECT_EXPENSE', 'INDIRECT_INCOME', 'COGS',
    'BANK', 'BANK_ACCOUNT', 'CASH', 'DUTIES_AND_TAXES', 'FIXED_ASSETS', 'GENERAL'
  ]);

  const invalidLedgers = await mongoose.connection.db.collection('ledgers').find({
    accountType: { $nin: Array.from(UNIVERSAL_MASTER_ACCOUNT_TYPES) }
  }).toArray();
  console.log('\n=== LEDGERS WITH NON-CANONICAL ACCOUNT TYPES ===');
  console.log('Count:', invalidLedgers.length);
  invalidLedgers.forEach(l => console.log('  ', l.accountHead, '| type:', l.accountType, '| voucher:', l.voucherNo));

  // 6. Look for COA entries with non-canonical account_type
  const invalidCOA = await mongoose.connection.db.collection('chartofaccounts').find({
    account_type: { $nin: Array.from(UNIVERSAL_MASTER_ACCOUNT_TYPES) }
  }).toArray();
  console.log('\n=== COA WITH NON-CANONICAL ACCOUNT TYPES ===');
  console.log('Count:', invalidCOA.length);
  invalidCOA.forEach(c => console.log('  ', c.account_name, '| type:', c.account_type));

  // 7. Check for Ledgers whose accountHead does not exist in ChartOfAccounts
  const allCoaNames = new Set(
    (await mongoose.connection.db.collection('chartofaccounts').find({}, { projection: { account_name: 1 } }).toArray())
      .map(c => c.account_name.trim().toLowerCase())
  );

  const distinctLedgerHeads = await mongoose.connection.db.collection('ledgers').distinct('accountHead');
  const missingInCOA = distinctLedgerHeads.filter(h => !allCoaNames.has(h.trim().toLowerCase()));
  console.log('\n=== LEDGER HEADS MISSING IN COA ===');
  console.log('Count:', missingInCOA.length);
  missingInCOA.forEach(h => console.log('   Missing in COA:', h));

  // 8. Check for Ledger entries with mismatched accountType vs COA account_type
  const allCoas = await mongoose.connection.db.collection('chartofaccounts').find().toArray();
  const coaMap = new Map();
  for (const c of allCoas) {
    coaMap.set(c.account_name.trim().toLowerCase(), c.account_type);
  }

  const typeMismatches = [];
  const sampleLedgers = await mongoose.connection.db.collection('ledgers').aggregate([
    {
      $group: {
        _id: '$accountHead',
        types: { $addToSet: '$accountType' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();

  for (const g of sampleLedgers) {
    const coaType = coaMap.get(g._id.trim().toLowerCase());
    if (coaType) {
      for (const t of g.types) {
        if (t !== coaType) {
          typeMismatches.push({ head: g._id, ledgerType: t, coaType, count: g.count });
        }
      }
    }
  }
  console.log('\n=== TYPE MISMATCHES (Ledger vs COA) ===');
  console.log('Count:', typeMismatches.length);
  typeMismatches.forEach(m => console.log('   Mismatch:', m.head, '| Ledger has:', m.ledgerType, '| COA has:', m.coaType));

  // 9. Check bs_classification accuracy in COA
  const PNL_TYPES = ['INCOME', 'EXPENSE', 'INDIRECT_INCOME', 'INDIRECT_EXPENSE', 'DIRECT_EXPENSE', 'DIRECT_INCOME', 'COGS', 'CASUAL_LABOR', 'GENERAL'];
  const wronglyClassifiedAsBS = await mongoose.connection.db.collection('chartofaccounts').find({
    account_type: { $in: PNL_TYPES },
    bs_classification: 'BALANCE_SHEET'
  }).toArray();
  console.log('\n=== P&L ACCOUNTS WRONGLY MARKED AS BALANCE_SHEET IN COA ===');
  console.log('Count:', wronglyClassifiedAsBS.length);
  wronglyClassifiedAsBS.forEach(a => console.log('  ', a.account_name, '| type:', a.account_type, '| bs_classification:', a.bs_classification));

  const wronglyClassifiedAsPNL = await mongoose.connection.db.collection('chartofaccounts').find({
    account_type: { $nin: PNL_TYPES },
    bs_classification: 'PNL'
  }).toArray();
  console.log('\n=== BALANCE SHEET ACCOUNTS WRONGLY MARKED AS PNL IN COA ===');
  console.log('Count:', wronglyClassifiedAsPNL.length);
  wronglyClassifiedAsPNL.forEach(a => console.log('  ', a.account_name, '| type:', a.account_type, '| bs_classification:', a.bs_classification));

  // 10. Check for unlinked ledgers (missing firmId or voucherGroupId)
  const unlinkedLedgers = await mongoose.connection.db.collection('ledgers').countDocuments({
    $or: [{ firmId: { $exists: false } }, { firmId: null }]
  });
  console.log('\n=== UNLINKED LEDGERS (Missing firmId) ===', unlinkedLedgers);

  // 11. Check for Party partyType vs COA account_type mismatch
  const parties = await mongoose.connection.db.collection('parties').find().toArray();
  const mismatchedParties = [];
  for (const p of parties) {
    const coa = await mongoose.connection.db.collection('chartofaccounts').findOne({
      $or: [{ firm_id: p.firmId }, { firmId: p.firmId }],
      account_name: p.name
    });
    if (coa) {
      if (p.partyType === 'SUPPLIER' && coa.account_type === 'SUNDRY_DEBTORS') {
        mismatchedParties.push({ name: p.name, partyType: p.partyType, coaType: coa.account_type, firmId: p.firmId });
      } else if (p.partyType === 'CUSTOMER' && coa.account_type === 'SUNDRY_CREDITORS') {
        mismatchedParties.push({ name: p.name, partyType: p.partyType, coaType: coa.account_type, firmId: p.firmId });
      }
    }
  }
  console.log('\n=== MISMATCHED PARTIES (Party Type vs COA Type) ===');
  console.log('Count:', mismatchedParties.length);
  mismatchedParties.forEach(m => console.log('  ', m.name, '| Party is:', m.partyType, '| COA has:', m.coaType));

  await mongoose.disconnect();
}

audit().catch(console.error);
