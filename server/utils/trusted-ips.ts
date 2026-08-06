import { H3Event, getRequestIP } from 'h3';
import User from '../models/User';
import { logSecurityEvent } from './security';

/**
 * Fix #23: Trusted IP implementation
 * 
 * How it works:
 * 1. On signup — the registration IP is saved to `securitySettings.trustedIPs`
 * 2. On login  — the current IP is checked against the user's trustedIPs list
 *    - If the IP is new and MAX IPs haven't been reached, it's auto-added
 *    - If MAX IPs is reached, a security warning is logged (but login still succeeds)
 * 3. This is a SOFT enforcement (risk signal) — it logs anomalies but does NOT block
 *    because IPs change legitimately (mobile, VPN, ISP changes)
 * 
 * For hard enforcement (e.g. admin panel), wrap with `requireTrustedIP()`.
 */

const MAX_TRUSTED_IPS = 10;

/**
 * Record a login IP and auto-trust it if within limits.
 * Returns { trusted, isNew } indicating whether the IP was already trusted.
 */
export async function recordLoginIP(
  userId: string,
  event: H3Event
): Promise<{ trusted: boolean; isNew: boolean }> {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  
  // Skip for unknown/local IPs
  if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') {
    return { trusted: true, isNew: false };
  }

  const cleanIP = ip.replace(/^::ffff:/, '');

  const user = await User.findById(userId);
  if (!user) {
    return { trusted: false, isNew: true };
  }

  const trustedIPs: string[] = user.securitySettings?.trustedIPs || [];
  const alreadyTrusted = trustedIPs.includes(cleanIP);

  if (alreadyTrusted) {
    return { trusted: true, isNew: false };
  }

  // New IP detected
  if (trustedIPs.length < MAX_TRUSTED_IPS) {
    // Auto-add the new IP
    user.securitySettings.trustedIPs = [...trustedIPs, cleanIP];
    await user.save();

    await logSecurityEvent({
      userId,
      email: user.email,
      action: 'login_success',
      event,
      metadata: {
        reason: 'New IP auto-trusted',
        ip: cleanIP,
        totalTrustedIPs: trustedIPs.length + 1
      },
      severity: 'low'
    });

    return { trusted: true, isNew: true };
  }

  // Max IPs reached — log warning but don't block
  await logSecurityEvent({
    userId,
    email: user.email,
    action: 'anomaly_detected',
    event,
    metadata: {
      reason: 'Login from untrusted IP (max trusted IPs reached)',
      ip: cleanIP,
      trustedIPCount: trustedIPs.length
    },
    severity: 'high'
  });

  return { trusted: false, isNew: true };
}

/**
 * Check if the current request IP is in the user's trusted list.
 * Use this for hard enforcement on sensitive routes (e.g. admin actions).
 */
export async function isTrustedIP(
  userId: string,
  event: H3Event
): Promise<boolean> {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return true;

  const cleanIP = ip.replace(/^::ffff:/, '');

  const user = await User.findById(userId).lean();
  if (!user) return false;

  const trustedIPs: string[] = (user as any).securitySettings?.trustedIPs || [];
  return trustedIPs.includes(cleanIP);
}

/**
 * Remove an IP from a user's trusted list.
 */
export async function removeTrustedIP(
  userId: string,
  ipToRemove: string
): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;

  const trustedIPs: string[] = user.securitySettings?.trustedIPs || [];
  const filtered = trustedIPs.filter(ip => ip !== ipToRemove);

  if (filtered.length === trustedIPs.length) return false; // IP not found

  user.securitySettings.trustedIPs = filtered;
  await user.save();
  return true;
}

/**
 * Get all trusted IPs for a user.
 */
export async function getTrustedIPs(userId: string): Promise<string[]> {
  const user = await User.findById(userId).lean();
  if (!user) return [];
  return (user as any).securitySettings?.trustedIPs || [];
}
