import fs from 'fs';
import path from 'path';
import dns from 'dns/promises';
import https from 'https';
import { fileURLToPath } from 'url';
import couchbase from 'couchbase';

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

// Helper to fetch public IP for Capella allowlist diagnosis
async function getPublicIP() {
  return new Promise((resolve) => {
    https.get('https://api.ipify.org?format=json', { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).ip);
        } catch {
          resolve('Unknown');
        }
      });
    }).on('error', () => resolve('Unknown'));
  });
}

function mask(str, show = 3) {
  if (!str) return '<NOT SET>';
  if (str.length <= show * 2) return '***';
  return str.slice(0, show) + '***' + str.slice(-show);
}

async function runDiagnostics() {
  console.log('\n============================================================');
  console.log('       Couchbase Capella Diagnostic & Connection Test       ');
  console.log('============================================================\n');

  const url = process.env.COUCHBASE_URL;
  const username = process.env.COUCHBASE_USERNAME;
  const password = process.env.COUCHBASE_PASSWORD;
  const bucketName = process.env.COUCHBASE_BUCKET || 'businesspro';
  const scopeName = process.env.COUCHBASE_SCOPE || '_default';
  const collectionName = process.env.COUCHBASE_COLLECTION || 'messages';

  console.log('Configuration Loaded:');
  console.log(`  COUCHBASE_URL:        ${url || '<NOT SET>'}`);
  console.log(`  COUCHBASE_USERNAME:   ${username || '<NOT SET>'}`);
  console.log(`  COUCHBASE_PASSWORD:   ${mask(password, 2)}`);
  console.log(`  COUCHBASE_BUCKET:     ${bucketName}`);
  console.log(`  COUCHBASE_SCOPE:      ${scopeName}`);
  console.log(`  COUCHBASE_COLLECTION: ${collectionName}\n`);

  if (!url || !username || !password) {
    console.error('❌ ERROR: Missing required Couchbase credentials in .env!');
    console.error('   Please ensure COUCHBASE_URL, COUCHBASE_USERNAME, and COUCHBASE_PASSWORD are set.\n');
    process.exit(1);
  }

  // Detect Public IP
  process.stdout.write('🔍 Checking your current machine Public IP... ');
  const publicIP = await getPublicIP();
  console.log(`${publicIP}\n`);

  // Parse hostname from URL
  const match = url.match(/^(couchbases?:\/\/)?([^/?#]+)/);
  const hostname = match ? match[2] : null;

  if (hostname) {
    process.stdout.write(`🌐 Testing DNS resolution for "${hostname}"... `);
    try {
      // Test SRV record resolution
      const srvRecord = `_couchbases._tcp.${hostname}`;
      try {
        const srvResults = await dns.resolveSrv(srvRecord);
        console.log('OK (SRV record found)');
        console.log(`   Points to: ${srvResults.map(s => `${s.name}:${s.port}`).join(', ')}`);
      } catch (srvErr) {
        // Fallback standard A record
        const addresses = await dns.resolve4(hostname);
        console.log('OK (A record found)');
        console.log(`   IPs: ${addresses.join(', ')}`);
      }
    } catch (dnsErr) {
      console.log('FAILED');
      console.warn(`   ⚠️ Warning: DNS resolution issue: ${dnsErr.message}`);
    }
  }

  console.log('\n🔄 Attempting to connect to Couchbase Capella cluster...');
  console.log('   Setting connectTimeout: 30000ms, kvTimeout: 20000ms...');

  let cluster;
  try {
    const startTime = Date.now();
    cluster = await couchbase.connect(url, {
      username,
      password,
      timeouts: {
        connectTimeout: 30000,
        kvTimeout: 20000,
        queryTimeout: 25000
      }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Cluster connection established in ${elapsed}s!\n`);

    // Ping Bucket
    process.stdout.write(`📡 Pinging bucket "${bucketName}"... `);
    const bucket = cluster.bucket(bucketName);
    const pingResult = await bucket.ping();
    console.log('OK');

    const services = Object.keys(pingResult.services || {});
    console.log(`   Active services: ${services.join(', ')}`);

    // Inspect Collections
    console.log(`\n📂 Inspecting scopes and collections in bucket "${bucketName}"...`);
    try {
      const collectionManager = bucket.collections();
      const scopes = await collectionManager.getAllScopes();
      console.log(`   Found ${scopes.length} scope(s):`);
      for (const s of scopes) {
        const colNames = s.collections.map(c => c.name).join(', ');
        console.log(`   - Scope "${s.name}": [${colNames}]`);
      }
    } catch (cmErr) {
      console.warn(`   ⚠️ Note: CollectionManager check skipped (permission or mode): ${cmErr.message}`);
    }

    // Test Key-Value Operation
    console.log(`\n📝 Testing Key-Value Read/Write...`);
    let collection;
    try {
      const scope = bucket.scope(scopeName);
      collection = scope.collection(collectionName);
    } catch {
      console.log(`   Falling back to bucket.defaultCollection()`);
      collection = bucket.defaultCollection();
    }

    const testDocId = `test::ping_${Date.now()}`;
    process.stdout.write(`   Writing test document "${testDocId}"... `);
    await collection.upsert(testDocId, {
      test: true,
      timestamp: Date.now(),
      created_by: 'test-couchbase-script'
    });
    console.log('OK');

    process.stdout.write(`   Reading test document "${testDocId}"... `);
    const readBack = await collection.get(testDocId);
    console.log('OK');
    console.log(`   Retrieved:`, JSON.stringify(readBack.content));

    process.stdout.write(`   Cleaning up test document... `);
    await collection.remove(testDocId);
    console.log('OK');

    console.log('\n============================================================');
    console.log('🎉 SUCCESS! Couchbase Capella is fully reachable & operational.');
    console.log('============================================================\n');

  } catch (err) {
    console.error('\n❌ Connection Failed!');
    console.error(`   Error Name:    ${err.name}`);
    console.error(`   Error Message: ${err.message}`);

    console.log('\n------------------------------------------------------------');
    console.log('             TROUBLESHOOTING & ACTION ITEMS:                ');
    console.log('------------------------------------------------------------');

    if (err.message.includes('unambiguous timeout') || err.message.includes('Timeout')) {
      console.log(`\n👉 1. IP ALLOWLIST (Most likely cause for Capella):`);
      console.log(`   Couchbase Capella blocks ALL incoming traffic by default.`);
      console.log(`   Your current machine's public IP is: \x1b[32m${publicIP}\x1b[0m`);
      console.log(`   Steps to fix:`);
      console.log(`     a. Log into Couchbase Capella Console: https://cloud.couchbase.com`);
      console.log(`     b. Select your Database/Cluster -> "Settings" -> "Allowed IP Addresses".`);
      console.log(`     c. Click "Add Allowed IP" -> Add "${publicIP}/32" (or "0.0.0.0/0" for development).`);
      console.log(`     d. Wait 1-2 minutes for Capella to apply firewall rules and run this test again.`);

      console.log(`\n👉 2. DATABASE CREDENTIALS (Database Access):`);
      console.log(`   Make sure "${username}" was created in:`);
      console.log(`   Capella Console -> "Database Access" (or "Users") with "Read/Write" access.`);
      console.log(`   Do NOT use your personal Capella Web Console login email as the username!`);

      console.log(`\n👉 3. CLUSTER STATE:`);
      console.log(`   Verify that your Capella cluster is in "Healthy / Running" state and not Paused.`);

      console.log(`\n👉 4. PROTOCOL:`);
      console.log(`   Ensure COUCHBASE_URL starts with "couchbases://" (with an 's' for TLS encryption).`);
    } else if (err.message.includes('Authentication') || err.message.includes('auth')) {
      console.log(`\n👉 AUTHENTICATION FAILURE:`);
      console.log(`   The username or password for Couchbase is incorrect.`);
      console.log(`   Verify credentials in Capella Console -> Database Access.`);
    } else if (err.message.includes('Bucket') || err.message.includes('not found')) {
      console.log(`\n👉 BUCKET NOT FOUND:`);
      console.log(`   The bucket "${bucketName}" was not found in this cluster.`);
      console.log(`   Check the exact bucket name under Capella Console -> Data Tools.`);
    }
    console.log('------------------------------------------------------------\n');
  } finally {
    if (cluster) {
      try {
        await cluster.close();
      } catch {}
    }
    process.exit(0);
  }
}

runDiagnostics();
