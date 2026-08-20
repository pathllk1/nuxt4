import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { extractGstDetails, GST_STATE_CODE_MAP } from '../server/utils/accounting/gst-address-helper.ts';

dotenv.config({ path: './.env' });

const uri = process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(uri);
  const Party = mongoose.models.Party || mongoose.model('Party', new mongoose.Schema({}, { strict: false }));
  const GstinCache = mongoose.models.GstinCache || mongoose.model('GstinCache', new mongoose.Schema({}, { strict: false }));
  const Bill = mongoose.models.Bill || mongoose.model('Bill', new mongoose.Schema({}, { strict: false }));

  const parties = await Party.find({});
  for (const p of parties) {
    if (p.gstin && p.gstin.length === 15) {
      const stateCode = p.gstin.substring(0, 2);
      const canonicalState = GST_STATE_CODE_MAP[stateCode] || p.state;
      const cacheDoc = await GstinCache.findOne({ gstin: p.gstin.toUpperCase() });
      const details = cacheDoc?.rawData ? extractGstDetails(cacheDoc.rawData, p.gstin) : null;

      const updates = {
        state: canonicalState,
        stateCode,
        ...(details ? {
          address: details.address || p.address,
          pin: details.pincode || p.pin,
          name: p.name?.startsWith('Vendor (') ? details.displayName : p.name
        } : {})
      };

      if (Array.isArray(p.gstLocations) && p.gstLocations.length > 0) {
        updates.gstLocations = p.gstLocations.map(l => {
          const locObj = l.toObject ? l.toObject() : { ...l };
          locObj.state = canonicalState;
          locObj.stateCode = stateCode;
          if (details) {
            locObj.address = details.address || locObj.address;
            locObj.pincode = details.pincode || locObj.pincode;
          }
          return locObj;
        });
      }

      await Party.updateOne({ _id: p._id }, { $set: updates });
      console.log(`Party [${p.name}] -> State: ${canonicalState}, Code: ${stateCode}, Pin: ${updates.pin || p.pin}`);
    }
  }

  // Update Bills
  const bills = await Bill.find({});
  for (const b of bills) {
    if (b.partyGstin && b.partyGstin.length === 15) {
      const stateCode = b.partyGstin.substring(0, 2);
      const canonicalState = GST_STATE_CODE_MAP[stateCode] || b.partyState;
      const cacheDoc = await GstinCache.findOne({ gstin: b.partyGstin.toUpperCase() });
      const details = cacheDoc?.rawData ? extractGstDetails(cacheDoc.rawData, b.partyGstin) : null;

      const updates = {
        partyState: canonicalState,
        partyStateCode: stateCode,
        ...(details ? {
          partyAddress: details.address || b.partyAddress,
          partyPin: details.pincode || b.partyPin,
          partyName: b.partyName?.startsWith('Vendor (') ? details.displayName : b.partyName
        } : {})
      };

      await Bill.updateOne({ _id: b._id }, { $set: updates });
    }
  }

  console.log('Database sanitization completely finished.');
  await mongoose.disconnect();
}

run().catch(console.error);
