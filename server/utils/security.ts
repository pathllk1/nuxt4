import crypto from 'crypto';
import { H3Event, getHeader, getRequestIP } from 'h3';
import { UAParser } from 'ua-parser-js';
import * as geoip from 'geoip-lite';
import SecurityLog from '../models/SecurityLog';
import Session from '../models/Session';
import TokenBlacklist from '../models/TokenBlacklist';

/**
 * Generate device fingerprint from H3Event request headers
 */
export const generateDeviceFingerprint = (event: H3Event): string => {
  const components = [
    getHeader(event, 'user-agent') || '',
    getHeader(event, 'accept-language') || '',
    getHeader(event, 'accept-encoding') || ''
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
};

/**
 * Extract device information from user agent
 */
export const parseDeviceInfo = (userAgent: string) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown',
    device: result.device.type || 'desktop'
  };
};

/**
 * Get geolocation from IP address
 */
export const getLocationFromIP = (ip: string) => {
  const cleanIP = ip.replace(/^::ffff:/, '');
  
  if (cleanIP === '127.0.0.1' || cleanIP === 'localhost' || cleanIP === '::1') {
    return { country: 'Local', region: 'Local', city: 'Local' };
  }
  
  const geo = geoip.lookup(cleanIP);
  
  if (!geo) {
    return { country: 'Unknown', region: 'Unknown', city: 'Unknown' };
  }
  
  return {
    country: geo.country || 'Unknown',
    region: geo.region || 'Unknown',
    city: geo.city || 'Unknown'
  };
};

/**
 * Log security event
 */
export const logSecurityEvent = async (params: {
  userId?: string;
  email?: string;
  action: string;
  event: H3Event;
  metadata?: any;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}) => {
  const { userId, email, action, event, metadata, severity = 'low' } = params;
  
  const ipAddress = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  const userAgent = getHeader(event, 'user-agent') || 'unknown';
  const deviceFingerprint = generateDeviceFingerprint(event);
  const location = getLocationFromIP(ipAddress);
  
  try {
    await SecurityLog.create({
      userId,
      email,
      action: action as any,
      ipAddress,
      userAgent,
      deviceFingerprint,
      location,
      metadata,
      severity,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

/**
 * Check if token is blacklisted
 */
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const blacklisted = await TokenBlacklist.findOne({ token });
  return !!blacklisted;
};

/**
 * Blacklist a token
 */
export const blacklistToken = async (
  token: string,
  tokenType: 'access' | 'refresh',
  userId: string,
  reason: string,
  expiresAt: Date
) => {
  try {
    await TokenBlacklist.create({
      token,
      tokenType,
      userId,
      reason,
      expiresAt
    });
  } catch (error) {
    console.error('Failed to blacklist token:', error);
  }
};

/**
 * Validate session and detect anomalies
 */
export const validateSession = async (
  sessionId: string,
  event: H3Event
): Promise<{ valid: boolean; reason?: string }> => {
  const session = await Session.findOne({ 
    refreshToken: sessionId, 
    isActive: true 
  });
  
  if (!session) {
    return { valid: false, reason: 'Session not found or inactive' };
  }
  
  // Check if session expired
  if (session.expiresAt < new Date()) {
    return { valid: false, reason: 'Session expired' };
  }
  
  // Device fingerprint validation
  const currentFingerprint = generateDeviceFingerprint(event);
  if (session.deviceFingerprint !== currentFingerprint) {
    await logSecurityEvent({
      userId: session.userId.toString(),
      action: 'anomaly_detected',
      event,
      metadata: { 
        reason: 'Device fingerprint mismatch',
        expected: session.deviceFingerprint,
        received: currentFingerprint
      },
      severity: 'high'
    });
    return { valid: false, reason: 'Device fingerprint mismatch' };
  }
  
  // IP address change detection (warning only, not blocking)
  const currentIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  if (session.ipAddress !== currentIP) {
    await logSecurityEvent({
      userId: session.userId.toString(),
      action: 'anomaly_detected',
      event,
      metadata: { 
        reason: 'IP address changed',
        previousIP: session.ipAddress,
        currentIP
      },
      severity: 'medium'
    });
  }
  
  // Update last activity
  session.lastActivity = new Date();
  await session.save();
  
  return { valid: true };
};

/**
 * Revoke other user sessions
 */
export const revokeOtherSessions = async (
  userId: string,
  currentRefreshToken: string,
  reason: string = 'User requested logout from other devices'
) => {
  await Session.updateMany(
    { 
      userId, 
      refreshToken: { $ne: currentRefreshToken },
      isActive: true 
    },
    { 
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason
    }
  );
};

/**
 * Revoke all user sessions
 */
export const revokeAllSessions = async (
  userId: string,
  reason: string = 'Security measure'
) => {
  await Session.updateMany(
    { userId, isActive: true },
    { 
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason
    }
  );
};

/**
 * Clean up expired sessions
 */
export const cleanupExpiredSessions = async () => {
  const result = await Session.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

/**
 * Detect suspicious login patterns
 */
export const detectSuspiciousActivity = async (
  userId: string,
  event: H3Event
): Promise<{ suspicious: boolean; reason?: string }> => {
  const recentLogs = await SecurityLog.find({
    userId,
    action: 'login_success',
    timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
  }).sort({ timestamp: -1 }).limit(5);
  
  if (recentLogs.length < 2) {
    return { suspicious: false };
  }
  
  // Check for multiple locations in short time
  const locations = new Set(recentLogs.map(log => log.location?.country));
  if (locations.size > 2) {
    return { 
      suspicious: true, 
      reason: 'Multiple geographic locations detected in short time' 
    };
  }
  
  // Check for multiple devices
  const devices = new Set(recentLogs.map(log => log.deviceFingerprint));
  if (devices.size > 3) {
    return { 
      suspicious: true, 
      reason: 'Multiple devices detected in short time' 
    };
  }
  
  return { suspicious: false };
};

/**
 * Generate secure token
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash token
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Constant-time comparison
 */
export const secureCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};
