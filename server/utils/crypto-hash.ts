import { argon2id } from 'hash-wasm';
import crypto from 'crypto';

/**
 * Base64 without padding helper (Argon2 standard)
 */
const toBase64Unpadded = (buffer: Buffer): string => {
  return buffer.toString('base64').replace(/=/g, '');
};

const fromBase64Unpadded = (str: string): Uint8Array => {
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
  // Use crypto to generate 16 cryptographically secure random bytes for salt
  const saltBuffer = crypto.randomBytes(16);
  const saltUint8 = new Uint8Array(saltBuffer);

  // Argon2id high security parameters matching fastify1:
  // m=65536 (64MB), t=3 iterations, p=4 parallelism
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
 * Verify a password against an encoded Argon2id PHC string
 */
export const verifyPassword = async (password: string, encodedHash: string): Promise<boolean> => {
  try {
    const parts = encodedHash.split('$');
    // PHC format: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
    if (parts.length < 6 || parts[1] !== 'argon2id') {
      console.error('Invalid Argon2id hash format');
      return false;
    }

    // Parse parameters
    const params = parts[3].split(',').reduce((acc, curr) => {
      const [key, val] = curr.split('=');
      acc[key] = parseInt(val, 10);
      return acc;
    }, {} as Record<string, number>);

    const memorySize = params.m || 65536;
    const iterations = params.t || 3;
    const parallelism = params.p || 4;

    // Decode salt
    const salt = fromBase64Unpadded(parts[4]);

    // Compute hash
    const computedEncoded = await argon2id({
      password,
      salt,
      parallelism,
      iterations,
      memorySize,
      hashLength: 32,
      outputType: 'encoded',
    });

    // Timing-safe comparison of the two strings using crypto
    const bufA = Buffer.from(encodedHash);
    const bufB = Buffer.from(computedEncoded);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (error) {
    console.error('Argon2id WASM verification error:', error);
    return false;
  }
};
