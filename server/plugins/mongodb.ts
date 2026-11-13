import mongoose from 'mongoose';
import '../models/register';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<boolean> | null;
  listenersAttached: boolean;
}

const g = globalThis as unknown as { __mongooseCache?: MongooseCache };
if (!g.__mongooseCache) {
  g.__mongooseCache = {
    conn: null,
    promise: null,
    listenersAttached: false,
  };
}
const cache = g.__mongooseCache;

const getConnectionOptions = (): mongoose.ConnectOptions => {
  const isServerless = !!process.env.VERCEL;

  return {
    serverSelectionTimeoutMS: isServerless ? 10000 : 5000,
    maxPoolSize: isServerless ? 2 : 10,
    minPoolSize: isServerless ? 0 : 1,
    heartbeatFrequencyMS: isServerless ? 10000 : 30000,
    socketTimeoutMS: 45000,
    bufferCommands: true,
    autoIndex: process.env.NODE_ENV !== 'production',
  };
};

let isMigrationReady = false;

export const connectDB = async (): Promise<boolean> => {
  // F-07: Fast return ONLY when both MongoDB connection is open AND startup migration has verified successfully
  if (mongoose.connection.readyState === 1 && isMigrationReady) {
    cache.conn = mongoose;
    return true;
  }

  if (cache.promise) {
    return cache.promise;
  }

  const connString = process.env.MONGODB_URI;
  if (!connString) {
    console.error('MONGODB_URI is not defined in .env');
    return false;
  }

  cache.promise = (async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(connString, getConnectionOptions());
        console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      }
      cache.conn = mongoose;

      // Versioned migration with duplicate detection, parity verification, and index gating (F-07)
      const { runLedgerIsReversedMigration } = await import('../utils/migrations/ledger-isreversed-migration');
      await runLedgerIsReversedMigration();
      isMigrationReady = true;

      return true;
    } catch (error) {
      console.error('MongoDB connection / startup migration error:', (error as Error).message);
      isMigrationReady = false;
      cache.conn = null;
      // F-07: Explicitly disconnect Mongoose on failure so readyState drops to 0, preventing bypass
      await mongoose.disconnect().catch(() => {});
      return false;
    } finally {
      cache.promise = null;
    }
  })();

  return cache.promise;
};

export const waitForConnection = (timeoutMs: number = 10000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (mongoose.connection.readyState === 1 && isMigrationReady) {
      return resolve(true);
    }

    if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
      return resolve(false);
    }

    const checkInterval = 200;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += checkInterval;

      if (mongoose.connection.readyState === 1 && isMigrationReady) {
        clearInterval(timer);
        return resolve(true);
      }

      if (elapsed >= timeoutMs || mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
        clearInterval(timer);
        return resolve(false);
      }
    }, checkInterval);
  });
};

export default defineNitroPlugin(async () => {
  // Connection Event Monitors — attach only once globally across HMR reloads
  if (!cache.listenersAttached) {
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message || err);
    });

    mongoose.connection.on('disconnected', () => {
      isMigrationReady = false;
      console.warn('MongoDB disconnected. Native driver connection pool will automatically reconnect.');
    });

    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected.');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected.');
    });

    cache.listenersAttached = true;
  }

  // Connect on startup
  console.log('Initializing MongoDB connection via Nitro plugin...');
  await connectDB();
});
