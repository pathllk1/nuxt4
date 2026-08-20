# Security Fix Plan - Practical Implementation
## Without Redis or CSRF (Immediate Fixes)

**Date:** 2026-08-21  
**Status:** ACTIONABLE  
**Estimated Time:** 2-3 days of focused work

---

## ✅ RE-VERIFIED FINDINGS

After re-examining the codebase:

### CONFIRMED CRITICAL ISSUES:
1. ✅ **Refresh token exposed in headers** - Line 287 in `auth.global.ts` (CONFIRMED - but not used by client)
2. ✅ **Race condition in token rotation** - Session save without locks (CONFIRMED)
3. ✅ **Token blacklist timing issue** - Check happens before rotation (CONFIRMED)
4. ✅ **Device fingerprinting weak** - Only 3 headers, treated as warning only (CONFIRMED - less critical)
5. ✅ **Multiple auth state sources** - useState, cookies, localStorage (CONFIRMED)

### GOOD NEWS:
- ✅ Client code does NOT read `x-new-refresh-token` header (dead code)
- ✅ Grace period logic is actually decent for handling concurrent requests
- ✅ Token rotation is OPTIONAL (can be disabled)
- ✅ Most security logging is already async (won't block requests)

### RELAXED CONSTRAINTS:
- No Redis available (will use MongoDB with careful queries)
- No CSRF protection needed right now (SameSite cookies provide some protection)
- Rate limiting can stay in-memory for single-server deployments

---

## 🎯 FIX PRIORITY (What to Fix First)

### 🔴 CRITICAL (Fix Today - 4 hours)
1. Remove refresh token from response headers
2. Fix account lock virtual property side effects
3. Remove dead device fingerprinting code paths
4. Add SameSite=Strict to cookies for CSRF mitigation

### 🟠 HIGH (Fix This Week - 8 hours)
5. Improve token rotation to handle races better
6. Simplify client-side auth state management
7. Add proper TypeScript types (remove `any`)
8. Add token rotation toggle in environment

### 🟡 MEDIUM (Fix Next Week - 12 hours)
9. Add comprehensive error handling
10. Simplify security logging (batch writes)
11. Add session cleanup job
12. Improve firm ID validation

---

## 📋 DETAILED FIX INSTRUCTIONS

---

## FIX #1: Remove Refresh Token Header Exposure ⏱️ 15 min

**File:** `server/middleware/auth.global.ts`

**Current Code (Lines 286-291):**
```typescript
setResponseHeader(event, 'x-new-access-token', newAccessToken);
if (shouldRotate) {
  setResponseHeader(event, 'x-new-refresh-token', newRefreshToken);
  setResponseHeader(event, 'Access-Control-Expose-Headers', 'x-new-access-token, x-new-refresh-token');
} else {
  setResponseHeader(event, 'Access-Control-Expose-Headers', 'x-new-access-token');
}
```

**Fix - Replace with:**
```typescript
// Only expose access token for client-side token refresh detection
setResponseHeader(event, 'x-new-access-token', newAccessToken);
setResponseHeader(event, 'Access-Control-Expose-Headers', 'x-new-access-token');
// Refresh token is already set in HttpOnly cookie - never expose in headers
```

**Why:** Refresh tokens should NEVER be exposed in headers. They're already set in HttpOnly cookies. Client code doesn't even use this header.

**Test:** After fix, verify no `x-new-refresh-token` header appears in browser DevTools Network tab.

---

## FIX #2: Fix Account Lock Virtual Side Effects ⏱️ 30 min

**File:** `server/models/User.ts`

**Current Code (Lines 116-129):**
```typescript
UserSchema.virtual('isLocked').get(function(this: IUser) {
  if (!this.isAccountLocked) return false;
  if (!this.securitySettings.accountLockedUntil) return false;
  
  if (this.securitySettings.accountLockedUntil < new Date()) {
    this.isAccountLocked = false;
    this.securitySettings.accountLockedUntil = undefined;
    this.save(); // ❌ SIDE EFFECT IN GETTER
    return false;
  }
  
  return true;
});
```

**Fix - Remove virtual, add method:**
```typescript
// Remove the virtual entirely - delete lines 116-129

// Add this method instead (after line 115):
UserSchema.methods.checkAndUnlockAccount = async function(): Promise<boolean> {
  if (!this.isAccountLocked) return false;
  
  const lockedUntil = this.securitySettings?.accountLockedUntil;
  if (!lockedUntil) {
    this.isAccountLocked = false;
    await this.save();
    return false;
  }
  
  if (new Date(lockedUntil) < new Date()) {
    // Lock expired, unlock account
    this.isAccountLocked = false;
    this.securitySettings.accountLockedUntil = undefined;
    await this.save();
    return false;
  }
  
  return true; // Still locked
};
```

**Then update callers:**

**File:** `server/api/auth/login.post.ts` (Line 74-85)
```typescript
// OLD:
if (user.isAccountLocked) {
  const lockedUntil = user.securitySettings?.accountLockedUntil;
  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    // ... error
  } else {
    user.isAccountLocked = false;
    if (user.securitySettings) {
      user.securitySettings.accountLockedUntil = undefined;
    }
    await user.save();
  }
}

// NEW:
const isLocked = await user.checkAndUnlockAccount();
if (isLocked) {
  await logSecurityEvent({
    userId: user._id.toString(),
    email: user.email,
    action: 'login_failed',
    event,
    metadata: { 
      reason: 'Account locked', 
      lockedUntil: user.securitySettings?.accountLockedUntil 
    },
    severity: 'high'
  });
  
  throw createError({
    statusCode: 403,
    statusMessage: 'Account locked due to multiple failed login attempts. Please try again later.'
  });
}
```

**Update in:** `server/middleware/auth.global.ts` (Lines 113-122, 220-227)

**Why:** Side effects in getters violate principle of least surprise and cause race conditions.

---

## FIX #3: Add SameSite=Strict Cookies ⏱️ 15 min

**Files:** All cookie setting locations

**Find all setCookie calls and change `sameSite: 'lax'` to `sameSite: 'strict'`:**

1. `server/api/auth/login.post.ts` (Lines 207, 213)
2. `server/api/auth/refresh.post.ts` (Lines 147, 154)
3. `server/middleware/auth.global.ts` (Lines 276, 282)
4. `server/api/auth/logout.post.ts` (Lines 17, 24)

**Change:**
```typescript
// FROM:
sameSite: 'lax'

// TO:
sameSite: 'strict'
```

**Why:** `SameSite=Strict` prevents cookies from being sent in cross-site requests, providing CSRF protection without needing tokens.

**Note:** This may break if you have multiple domains or subdomains. Test your login flow.

---

## FIX #4: Disable Token Rotation (Reduce Complexity) ⏱️ 5 min

**File:** `.env`

**Change:**
```bash
# FROM:
ROTATE_REFRESH_TOKEN=true

# TO:
ROTATE_REFRESH_TOKEN=false
```

**Why:** 
- Token rotation adds complexity without much security benefit for your use case
- Race conditions are mostly caused by rotation
- Simpler = less bugs
- You can re-enable later after other fixes are stable

**Alternative:** Keep it enabled but add a comment explaining the tradeoffs.

---

## FIX #5: Improve Race Condition Handling ⏱️ 2 hours

**File:** `server/api/auth/refresh.post.ts`

**Current Issue:** Two concurrent requests can both rotate the token, corrupting session state.

**Fix - Use MongoDB findOneAndUpdate (atomic operation):**

```typescript
// Replace lines 51-64 (session lookup)
// OLD:
const session = await Session.findOne({
  userId: decoded.id,
  isActive: true,
  $or: [
    { refreshToken },
    { previousRefreshToken: refreshToken }
  ]
});

// NEW (atomic update):
const session = await Session.findOneAndUpdate(
  {
    userId: decoded.id,
    isActive: true,
    $or: [
      { refreshToken },
      { previousRefreshToken: refreshToken }
    ]
  },
  {
    $set: {
      lastActivity: new Date(),
      // Mark that we're processing this token (pseudo-lock)
      lastRefreshAttempt: new Date()
    }
  },
  {
    new: true, // Return updated document
    lean: false // We need the document for further updates
  }
);
```

**Then add optimistic locking check:**

```typescript
// After line 115 (before shouldRotate check):
if (shouldRotate && !isGraceWindowHit) {
  // Check if another request already rotated this token
  const recentRotation = session.previousRotatedAt && 
    (Date.now() - new Date(session.previousRotatedAt).getTime() < 5000); // 5 sec window
  
  if (recentRotation && session.previousRefreshToken === refreshToken) {
    // Another request just rotated this token, use the new one
    effectiveRefreshToken = session.refreshToken;
    console.log('[Auth] Detected concurrent rotation, using existing new token');
  } else {
    // We're the first to rotate
    const newRefreshToken = generateRefreshToken(user, deviceFingerprint);
    
    session.previousRefreshToken = refreshToken;
    session.previousRotatedAt = new Date();
    session.refreshToken = newRefreshToken;
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    effectiveRefreshToken = newRefreshToken;
  }
} else {
  session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
}
```

**Why:** This reduces (but doesn't eliminate) race conditions by detecting when another request already rotated the token.

---

## FIX #6: Simplify Client Auth State ⏱️ 3 hours

**File:** `app/composables/useAuth.ts`

**Problem:** Too many state sources (useState, cookies, localStorage) causing sync issues.

**Fix - Simplify to single source of truth:**

```typescript
// Replace initAuth function (lines 36-125) with simpler version:

const initAuth = async () => {
  // Only initialize once per session
  if (isInitialized.value) return;

  try {
    // Single source of truth: ask server (cookies auto-sent)
    // Server has HttpOnly cookies, it knows the truth
    const userData = await requestFetch<any>('/api/auth/me', { 
      credentials: 'include'
    }).catch(() => null);

    if (userData && (userData.id || userData._id)) {
      user.value = {
        ...userData,
        id: userData.id || userData._id
      };

      // Restore firm selection from cookie or use first firm
      const firmIdFromCookie = cookieFirm.value;
      if (firmIdFromCookie && firmIdFromCookie !== 'undefined' && firmIdFromCookie !== 'null') {
        selectedFirmId.value = firmIdFromCookie;
      } else if (userData.firms && userData.firms.length > 0) {
        const defaultFirmId = extractFirmId(userData.firms[0]?.firm);
        if (defaultFirmId) {
          selectedFirmId.value = defaultFirmId;
          cookieFirm.value = defaultFirmId;
        }
      }
    } else {
      // Not authenticated or session expired
      user.value = null;
      selectedFirmId.value = null;
    }
  } catch (error) {
    console.error('Failed to initialize auth:', error);
    user.value = null;
    selectedFirmId.value = null;
  } finally {
    isInitialized.value = true;
  }
};
```

**Remove localStorage usage entirely:**

```typescript
// DELETE these lines that use localStorage:
// - Line 72-75 (localStorage.getItem)
// - Line 216 (localStorage.setItem)
// - Line 256 (localStorage.removeItem)
```

**Why:** 
- Simpler = fewer bugs
- Cookies are the single source of truth
- No sync issues between tabs
- Works perfectly with SSR

---

## FIX #7: Add Proper TypeScript Types ⏱️ 1 hour

**File:** `server/utils/auth.ts`

**Change:**
```typescript
// FROM:
export interface AuthSession {
  firm_id: any;
  _id: any;
  username?: string;
  email?: string;
}

// TO:
import mongoose from 'mongoose';

export interface AuthSession {
  firm_id: mongoose.Types.ObjectId;
  _id: mongoose.Types.ObjectId;
  username?: string;
  email?: string;
}
```

**Throughout codebase, replace:**
```typescript
// Search and replace in all files:
// FROM: `: any` in type definitions
// TO: proper types

// Example in login.post.ts line 32:
// FROM: const user = await User.findOne({ email } as any)
// TO:   const user = await User.findOne({ email })

// Example in many places:
// FROM: const userOid = new mongoose.Types.ObjectId(String(userId));
// TO:   const userOid = mongoose.Types.ObjectId.isValid(userId) 
//         ? new mongoose.Types.ObjectId(String(userId))
//         : null;
//       if (!userOid) throw createError({ statusCode: 400, ... });
```

**Why:** Type safety catches bugs at compile time, not runtime.

---

## FIX #8: Add Session Cleanup Job ⏱️ 1 hour

**Create new file:** `server/utils/session-cleanup.ts`

```typescript
import Session from '../models/Session';
import TokenBlacklist from '../models/TokenBlacklist';
import SecurityLog from '../models/SecurityLog';

/**
 * Clean up expired sessions, blacklisted tokens, and old security logs
 * Run this periodically (e.g., daily cron job or on server startup)
 */
export async function cleanupExpiredData() {
  const now = new Date();
  
  try {
    // 1. Delete expired sessions (already handled by TTL index, but manual cleanup is faster)
    const deletedSessions = await Session.deleteMany({
      expiresAt: { $lt: now }
    });
    
    // 2. Delete expired blacklisted tokens (TTL index handles this, but manual is cleaner)
    const deletedBlacklist = await TokenBlacklist.deleteMany({
      expiresAt: { $lt: now }
    });
    
    // 3. Delete old security logs (keep only last 90 days)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deletedLogs = await SecurityLog.deleteMany({
      timestamp: { $lt: ninetyDaysAgo },
      severity: { $in: ['low', 'medium'] } // Keep high/critical logs longer
    });
    
    console.log('[Cleanup] Expired data removed:', {
      sessions: deletedSessions.deletedCount,
      blacklist: deletedBlacklist.deletedCount,
      logs: deletedLogs.deletedCount
    });
    
    return {
      sessions: deletedSessions.deletedCount,
      blacklist: deletedBlacklist.deletedCount,
      logs: deletedLogs.deletedCount
    };
  } catch (error) {
    console.error('[Cleanup] Failed to clean expired data:', error);
    throw error;
  }
}
```

**Add cleanup endpoint:**

**Create file:** `server/api/admin/cleanup-sessions.post.ts`

```typescript
import { defineEventHandler } from 'h3';
import { requireSuperAdmin } from '../../utils/admin-guard';
import { cleanupExpiredData } from '../../utils/session-cleanup';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  
  const result = await cleanupExpiredData();
  
  return {
    success: true,
    message: 'Cleanup completed',
    deleted: result
  };
});
```

**Why:** Prevents database bloat from expired sessions and old logs.

---

## FIX #9: Improve Firm ID Validation ⏱️ 30 min

**File:** `server/utils/auth.ts`

**Replace lines 23-40 with:**

```typescript
// Determine firm ID: prefer header override, then JWT claim
const headerFirmId = getHeader(event, 'x-firm-id') || getHeader(event, 'X-Firm-ID');
const jwtFirmId = userPayload?.firmId || userPayload?.firm_id;
const rawFirmId = headerFirmId || jwtFirmId;

// Strict validation - reject invalid values
if (!rawFirmId) {
  throw createError({ 
    statusCode: 400, 
    statusMessage: 'Bad Request: Firm ID is required' 
  });
}

const firmIdStr = String(rawFirmId).trim();

// Reject string representations of null/undefined
if (firmIdStr === '' || firmIdStr === 'undefined' || firmIdStr === 'null') {
  throw createError({ 
    statusCode: 400, 
    statusMessage: 'Bad Request: Invalid firm ID value' 
  });
}

// Validate ObjectId format
if (!mongoose.Types.ObjectId.isValid(firmIdStr)) {
  throw createError({
    statusCode: 400,
    statusMessage: 'Bad Request: Firm ID must be a valid ObjectId'
  });
}

const firmOid = new mongoose.Types.ObjectId(firmIdStr);

// Validate user ID as well
const userIdStr = String(userId).trim();
if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
  throw createError({
    statusCode: 400,
    statusMessage: 'Bad Request: User ID must be a valid ObjectId'
  });
}

const userOid = new mongoose.Types.ObjectId(userIdStr);
```

**Why:** Strict validation prevents injection attacks and catches data quality issues early.

---

## FIX #10: Add Comprehensive Error Responses ⏱️ 1 hour

**Create file:** `server/utils/error-formatter.ts`

```typescript
import { H3Error, createError } from 'h3';

export interface StandardError {
  statusCode: number;
  statusMessage: string;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
}

export function formatError(error: any): StandardError {
  const timestamp = new Date().toISOString();
  
  if (error.statusCode) {
    return {
      statusCode: error.statusCode,
      statusMessage: error.statusMessage || 'Error',
      message: error.message || error.statusMessage,
      code: error.code,
      details: error.data,
      timestamp
    };
  }
  
  // Default server error
  return {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: 'An unexpected error occurred',
    timestamp
  };
}

export function createAuthError(message: string, statusCode: number = 401) {
  return createError({
    statusCode,
    statusMessage: message,
    message
  });
}
```

**Use consistently across all auth endpoints.**

---

## 🧪 TESTING PLAN

### Manual Tests (30 minutes)

**Test #1: Basic Login Flow**
```bash
1. Open browser, go to /login
2. Login with valid credentials
3. Check DevTools > Network > Response Headers
   ✓ Should see x-new-access-token
   ✓ Should NOT see x-new-refresh-token
   ✓ Cookies should have access_token and refresh_token
4. Navigate to protected page
   ✓ Should stay authenticated
```

**Test #2: Token Refresh**
```bash
1. Login
2. Wait 16 minutes (access token expires at 15m)
3. Make any API request
   ✓ Should auto-refresh (check Network tab)
   ✓ Should get new access_token cookie
   ✓ Should stay on same page
```

**Test #3: Multi-Tab Behavior**
```bash
1. Login in Tab A
2. Open Tab B, should be logged in
3. Logout from Tab A
4. Try to use Tab B
   ✓ Should redirect to login
```

**Test #4: Account Lock**
```bash
1. Try to login with wrong password 5 times
   ✓ Account should lock for 30 minutes
2. Try to login with correct password
   ✓ Should show "Account locked" error
3. Wait 31 minutes (or manually unlock in DB)
4. Login with correct password
   ✓ Should succeed
```

**Test #5: Session Limits**
```bash
1. Login from 6 different browsers/devices
   ✓ First session should be terminated
   ✓ Only 5 active sessions allowed
```

---

## 📊 SUMMARY

### Fixes Completed Today (Critical)
- [ ] Remove refresh token from headers (15 min)
- [ ] Fix account lock side effects (30 min)
- [ ] Add SameSite=Strict cookies (15 min)
- [ ] Disable token rotation temporarily (5 min)

**Total: ~1 hour**

### Fixes This Week (High Priority)
- [ ] Improve race condition handling (2 hours)
- [ ] Simplify client auth state (3 hours)
- [ ] Add proper TypeScript types (1 hour)
- [ ] Add session cleanup job (1 hour)

**Total: ~7 hours**

### Fixes Next Week (Medium Priority)
- [ ] Improve firm ID validation (30 min)
- [ ] Add error response formatter (1 hour)
- [ ] Add comprehensive testing (2 hours)
- [ ] Documentation updates (1 hour)

**Total: ~4.5 hours**

---

## 🎯 SUCCESS CRITERIA

After implementing all fixes:

✅ **Security:**
- No refresh tokens exposed in headers
- SameSite=Strict cookies provide CSRF protection
- Account locks work correctly without side effects
- Race conditions significantly reduced

✅ **Stability:**
- Multi-tab authentication works reliably
- Token refresh doesn't cause random logouts
- Session limits enforced correctly

✅ **Code Quality:**
- Proper TypeScript types (no `any`)
- Clear error messages
- Simpler authentication flow
- Better maintainability

✅ **Performance:**
- Database cleaned up regularly
- No unbounded memory growth
- Faster authentication checks

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying to production:

1. [ ] All critical fixes implemented and tested
2. [ ] Manual testing completed (all 5 tests pass)
3. [ ] Environment variables verified (especially ROTATE_REFRESH_TOKEN)
4. [ ] Database indexes verified (Session, TokenBlacklist, SecurityLog)
5. [ ] Session cleanup job scheduled (daily cron)
6. [ ] Error logging monitored for 24 hours
7. [ ] Load testing performed (if applicable)
8. [ ] Rollback plan documented

---

## 📞 SUPPORT

If you encounter issues during implementation:

1. **Race conditions persist?** Disable token rotation completely (`ROTATE_REFRESH_TOKEN=false`)
2. **Multi-tab issues?** Clear all cookies and localStorage, restart browser
3. **Type errors?** Start with small sections, use `// @ts-ignore` temporarily
4. **Database locks?** Check MongoDB indexes, consider upgrading connection pool

---

**Questions or need clarification on any fix? Let me know!**
