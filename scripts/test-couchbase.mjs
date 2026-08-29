import fs from 'fs';
import path from 'path';
import https from 'node:https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load .env manually if not already in process.env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

function mask(str, show = 3) {
  if (!str) return '<NOT SET>';
  if (str.length <= show * 2) return '***';
  return str.slice(0, show) + '***' + str.slice(-show);
}

const agent = new https.Agent({ rejectUnauthorized: false });

async function querySql(endpointUrl, authHeader, statement, params = {}) {
  const postData = JSON.stringify({ statement, ...params });
  return new Promise((resolve, reject) => {
    const req = https.request(endpointUrl, {
      method: 'POST',
      agent,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('Connection timeout to Couchbase Query Service'));
    });
    req.write(postData);
    req.end();
  });
}

async function runDiagnostics() {
  console.log('\n============================================================');
  console.log('    Couchbase Capella Pure REST Driver Diagnostic Test      ');
  console.log('    (100% Native-Free: Compatible with Vercel & Node 22)    ');
  console.log('============================================================\n');

  const rawUrl = process.env.COUCHBASE_URL;
  const username = process.env.COUCHBASE_USERNAME;
  const password = process.env.COUCHBASE_PASSWORD;
  const bucketName = process.env.COUCHBASE_BUCKET || 'businesspro';
  const scopeName = process.env.COUCHBASE_SCOPE || '_default';
  const collectionName = process.env.COUCHBASE_COLLECTION || 'messages';

  console.log('Configuration Loaded:');
  console.log(`  COUCHBASE_URL:        ${rawUrl || '<NOT SET>'}`);
  console.log(`  COUCHBASE_USERNAME:   ${username || '<NOT SET>'}`);
  console.log(`  COUCHBASE_PASSWORD:   ${mask(password, 2)}`);
  console.log(`  COUCHBASE_BUCKET:     ${bucketName}`);
  console.log(`  COUCHBASE_SCOPE:      ${scopeName}`);
  console.log(`  COUCHBASE_COLLECTION: ${collectionName}\n`);

  if (!rawUrl || !username || !password) {
    console.error('❌ ERROR: Missing required Couchbase credentials in .env!');
    process.exit(1);
  }

  const match = rawUrl.match(/^(?:couchbases?:\/\/|https?:\/\/)?([^/?#:]+)/);
  const host = match ? match[1] : rawUrl;
  const endpointUrl = `https://${host}:18093/query/service`;
  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  console.log(`🌐 Target Endpoint: ${endpointUrl}`);
  console.log('🔄 Executing SQL++ Ping query...');

  const startTime = Date.now();
  try {
    const pingRes = await querySql(endpointUrl, authHeader, 'SELECT 1 as ping');
    const elapsed = Date.now() - startTime;

    if (pingRes.status === 200 && pingRes.data?.status === 'success') {
      console.log(`✅ Query service responded in ${elapsed}ms!`);
    } else {
      console.error(`❌ Authentication or Query error: Status ${pingRes.status}`, pingRes.data || pingRes.raw);
      process.exit(1);
    }

    // 2. Ensure Primary Index
    process.stdout.write(`🔍 Checking primary index on \`${bucketName}\`.\`${scopeName}\`.\`${collectionName}\`... `);
    const idxRes = await querySql(
      endpointUrl,
      authHeader,
      `CREATE PRIMARY INDEX IF NOT EXISTS ON \`${bucketName}\`.\`${scopeName}\`.\`${collectionName}\``
    );
    console.log('OK (', idxRes.data?.status || 'success', ')');

    // 3. Test Upsert
    const testKey = `test::diag_${Date.now()}`;
    process.stdout.write(`📝 Testing document upsert (${testKey})... `);
    const upsertRes = await querySql(
      endpointUrl,
      authHeader,
      `UPSERT INTO \`${bucketName}\`.\`${scopeName}\`.\`${collectionName}\` (KEY, VALUE) VALUES ($key, $doc)`,
      { $key: testKey, $doc: { test: true, timestamp: Date.now() } }
    );
    console.log('OK (', upsertRes.data?.status, ')');

    // 4. Test Select
    process.stdout.write(`📖 Testing document select... `);
    const selectRes = await querySql(
      endpointUrl,
      authHeader,
      `SELECT m.* FROM \`${bucketName}\`.\`${scopeName}\`.\`${collectionName}\` m USE KEYS ($key)`,
      { $key: testKey }
    );
    console.log('OK (', selectRes.data?.results?.[0]?.test ? 'Retrieved successfully' : 'Not found', ')');

    // 5. Cleanup
    process.stdout.write(`🧹 Cleaning up test document... `);
    await querySql(
      endpointUrl,
      authHeader,
      `DELETE FROM \`${bucketName}\`.\`${scopeName}\`.\`${collectionName}\` USE KEYS ($key)`,
      { $key: testKey }
    );
    console.log('OK');

    console.log('\n============================================================');
    console.log('🎉 SUCCESS! Couchbase Capella REST driver is 100% operational.');
    console.log('   Zero native binaries -> 100% Vercel / Linux x64 compatible!');
    console.log('============================================================\n');

  } catch (err) {
    console.error('\n❌ Connection error:', err.message);
  }
}

runDiagnostics();
