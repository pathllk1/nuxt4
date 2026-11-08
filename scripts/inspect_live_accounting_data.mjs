import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const vTypes = await db.collection('ledgers').aggregate([
    { $group: { _id: '$voucherType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('--- VOUCHER TYPES IN LEDGER ---');
  console.table(vTypes);

  const accTypes = await db.collection('ledgers').aggregate([
    { $group: { _id: '$accountType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('--- ACCOUNT TYPES IN LEDGER ---');
  console.table(accTypes);

  const refTypes = await db.collection('ledgers').aggregate([
    { $group: { _id: '$refType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('--- REF TYPES IN LEDGER ---');
  console.table(refTypes);

  const taggedParty = await db.collection('ledgers').countDocuments({ partyId: { $ne: null } });
  const taggedBank = await db.collection('ledgers').countDocuments({ bankAccountId: { $ne: null } });
  const taggedMasterRoll = await db.collection('ledgers').countDocuments({ masterRollId: { $ne: null } });
  const untaggedVouchers = await db.collection('ledgers').countDocuments({
    partyId: null,
    bankAccountId: null,
    masterRollId: null
  });
  const totalLedgers = await db.collection('ledgers').countDocuments();
  console.log({ totalLedgers, taggedParty, taggedBank, taggedMasterRoll, untaggedVouchers });

  // Sample untagged vouchers
  const sampleUntagged = await db.collection('ledgers').find({
    partyId: null,
    bankAccountId: null,
    masterRollId: null
  }).limit(5).project({ accountHead: 1, accountType: 1, voucherType: 1, debitAmount: 1, creditAmount: 1, narration: 1 }).toArray();
  console.log('--- SAMPLE UNTAGGED ENTRIES ---');
  console.log(sampleUntagged);

  // Inspect Chart of Accounts sample
  const coaTypes = await db.collection('chartofaccounts').aggregate([
    { $group: { _id: '$account_type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('--- COA ACCOUNT TYPES ---');
  console.table(coaTypes);

  await mongoose.disconnect();
}

inspect().catch(console.error);

