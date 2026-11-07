import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const accounts = await mongoose.connection.collection('chartofaccounts').find({
    $or: [
      { account_name: { $regex: 'TDS|Tax|Expense|Labor', $options: 'i' } }
    ]
  }).toArray();
  console.log(accounts.map(a => ({ name: a.account_name, type: a.account_type, is_system: a.is_system })));
  await mongoose.disconnect();
}
run();

