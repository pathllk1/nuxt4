import fs from 'fs';
import { extractGstDetails } from '../server/utils/accounting/gst-address-helper.ts';

const samples = JSON.parse(fs.readFileSync('./scratch/gst_samples_batch.json', 'utf8'));

for (const [gstin, raw] of Object.entries(samples)) {
  const extracted = extractGstDetails(raw, gstin);
  console.log('====================================');
  console.log(`GSTIN: ${extracted.gstin}`);
  console.log(`Display Name: ${extracted.displayName}`);
  console.log(`Legal Name: ${extracted.legalName}`);
  console.log(`Trade Name: ${extracted.tradeName}`);
  console.log(`State: ${extracted.state} (${extracted.stateCode})`);
  console.log(`Pincode: ${extracted.pincode}`);
  console.log(`Address: ${extracted.address}`);
  console.log(`PAN: ${extracted.pan}`);
}
