import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './.env' });

const GSTIN = '19AAKFC4462A1ZN';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

console.log('Fetching GSTIN:', GSTIN, 'using Key:', RAPIDAPI_KEY ? 'Present' : 'Missing');

async function run() {
  const url = `https://powerful-gstin-tool.p.rapidapi.com/v1/gstin/${GSTIN}/details`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'powerful-gstin-tool.p.rapidapi.com',
    }
  });

  const status = response.status;
  const json = await response.json();
  console.log('Response Status:', status);
  console.log('Response Body:', JSON.stringify(json, null, 2));

  fs.writeFileSync('./scratch/gst_sample_19AAKFC4462A1ZN.json', JSON.stringify(json, null, 2));
  console.log('Saved to ./scratch/gst_sample_19AAKFC4462A1ZN.json');
}

run().catch(console.error);
