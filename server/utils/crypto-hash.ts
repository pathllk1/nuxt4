import { argon2id } from 'hash-wasm';
import crypto from 'crypto';

/**
 * Base64 helper supporting standard, URL-safe, and unpadded Base64
 */
const fromBase64Any = (str: string): Uint8Array => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
};

/**
 * Hash a password using Argon2id via WebAssembly
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltBuffer = crypto.randomBytes(16);
  const saltUint8 = new Uint8Array(saltBuffer);

  const encoded = await argon2id({
    password,
    salt: saltUint8,
    parallelism: 4,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded',
  });

  return encoded;
};

/**
 * Verify a password against an encoded Argon2id PHC string or legacy hash
 */
export const verifyPassword = async (password: string, encodedHash: string): Promise<boolean> => {
  if (!password || !encodedHash) return false;

  // Plain text fallback (for initial seed/test accounts)
  if (password === encodedHash) {
    return true;
  }

  try {
    const parts = encodedHash.split('$');
    // PHC format: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
    if (parts.length >= 6 && parts[1] && parts[1].startsWith('argon2')) {
      const part3 = parts[3];
      const params = (part3 || '').split(',').reduce((acc, curr) => {
        const items = curr.split('=');
        const key = items[0];
        const val = items[1];
        if (key && val) {
          acc[key] = parseInt(val, 10);
        }
        return acc;
      }, {} as Record<string, number>);

      const memorySize = params.m || 65536;
      const iterations = params.t || 3;
      const parallelism = params.p || 4;

      const saltPart = parts[4];
      const salt = fromBase64Any(saltPart || '');

      // Compute raw binary hash
      const computedHashBytes = await argon2id({
        password,
        salt,
        parallelism,
        iterations,
        memorySize,
        hashLength: 32,
        outputType: 'binary',
      });

      const hashPart = parts[5];
      const storedHashBytes = fromBase64Any(hashPart || '');

      if (computedHashBytes.length !== storedHashBytes.length) {
        return false;
      }

      return crypto.timingSafeEqual(Buffer.from(computedHashBytes), Buffer.from(storedHashBytes));
    }

    return false;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
};
