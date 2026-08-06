import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { IUser } from '../models/User';

const getSecret = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[SECURITY] Missing required environment variable: ${name}. ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
    );
  }
  return value;
};

// Lazy-initialized — validated on first use (Nitro loads env before handlers run)
let _accessSecret: string | null = null;
let _refreshSecret: string | null = null;

export const getAccessTokenSecret = (): string => {
  if (!_accessSecret) _accessSecret = getSecret('ACCESS_TOKEN_SECRET');
  return _accessSecret;
};

export const getRefreshTokenSecret = (): string => {
  if (!_refreshSecret) _refreshSecret = getSecret('REFRESH_TOKEN_SECRET');
  return _refreshSecret;
};

export interface TokenPayload {
  id: string;
  email: string;
  firmId: string | null;
  grade: string | null;
  role: string;
  tokenVersion?: number;
  deviceFingerprint?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface RefreshTokenPayload {
  id: string;
  deviceFingerprint?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

export const generateAccessToken = (
  user: any, 
  deviceFingerprint?: string,
  firmId?: string, 
  grade?: string
): string => {
  const payload: TokenPayload = { 
    id: user._id.toString(), 
    email: user.email,
    role: user.role,
    firmId: firmId || (user.firms.length > 0 ? (user.firms[0].firm as any)._id?.toString() || user.firms[0].firm.toString() : null),
    grade: grade || (user.firms.length > 0 ? user.firms[0].grade : null),
    deviceFingerprint,
    jti: crypto.randomBytes(16).toString('hex')
  };
  
  return jwt.sign(payload, getAccessTokenSecret(), { 
    algorithm: 'HS256',
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    issuer: 'fastify-auth-server',
    audience: 'fastify-client'
  } as jwt.SignOptions);
};

export const generateRefreshToken = (
  user: any,
  deviceFingerprint?: string
): string => {
  const payload: RefreshTokenPayload = { 
    id: user._id.toString(),
    deviceFingerprint,
    jti: crypto.randomBytes(16).toString('hex')
  };
  
  return jwt.sign(payload, getRefreshTokenSecret(), { 
    algorithm: 'HS512',
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    issuer: 'fastify-auth-server',
    audience: 'fastify-client'
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, getAccessTokenSecret(), { 
      algorithms: ['HS256'],
      issuer: 'fastify-auth-server',
      audience: 'fastify-client'
    }) as TokenPayload;
    
    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('INVALID_TOKEN');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('TOKEN_NOT_ACTIVE');
    }
    throw error;
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, getRefreshTokenSecret(), { 
      algorithms: ['HS512'],
      issuer: 'fastify-auth-server',
      audience: 'fastify-client'
    }) as RefreshTokenPayload;
    
    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('TOKEN_EXPIRED');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('INVALID_TOKEN');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('TOKEN_NOT_ACTIVE');
    }
    throw error;
  }
};

export const decodeToken = (token: string): any => {
  return jwt.decode(token);
};

export const getTokenExpiration = (token: string): Date | null => {
  const decoded = jwt.decode(token) as any;
  if (!decoded || !decoded.exp) return null;
  return new Date(decoded.exp * 1000);
};

export const isTokenExpiringSoon = (token: string, thresholdMinutes: number = 5): boolean => {
  const expiration = getTokenExpiration(token);
  if (!expiration) return false;
  
  const now = new Date();
  const threshold = new Date(now.getTime() + thresholdMinutes * 60 * 1000);
  
  return expiration <= threshold;
};
