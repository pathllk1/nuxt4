import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const GSTINS = [
  '19AJCPP2578B1Z7',
  '07AMLPS2241N1ZL',
  '24AAEFF7243A1ZY',
  '18AAZFR2487F1ZG',
  '29AACCF1132H2ZX'
];
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

async function run() {
  const results = {};
  for (let i = 0; i < GSTINS.length; i++) {
    const gstin = GSTINS[i];
    if (i > 0) await new Promise(r => setTimeout(r, 1200));
    console.log(`Fetching ${gstin}...`);
    try {
      const url = `https://powerful-gstin-tool.p.rapidapi.com/v1/gstin/${gstin}/details`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'powerful-gstin-tool.p.rapidapi.com',
        }
      });
      const json = await response.json();
      results[gstin] = json;
    } catch (e) {
      console.error(`Failed ${gstin}:`, e.message);
    }
  }

  fs.writeFileSync('./scratch/gst_samples_batch.json', JSON.stringify(results, null, 2));
  console.log('Saved batch samples to ./scratch/gst_samples_batch.json');
}

run().catch(console.error);
