import mongoose from 'mongoose';
import '../models/register';

let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 1000;

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

export const connectDB = async (): Promise<boolean> => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (isConnecting || mongoose.connection.readyState === 2) {
    return waitForConnection(10000);
  }

  const connString = process.env.MONGODB_URI;
  if (!connString) {
    console.error('MONGODB_URI is not defined in .env');
    return false;
  }

  isConnecting = true;

  try {
    await mongoose.connect(connString, getConnectionOptions());
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
    reconnectAttempts = 0;
    isConnecting = false;
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', (error as Error).message);
    isConnecting = false;
    return false;
  }
};

export const waitForConnection = (timeoutMs: number = 10000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (mongoose.connection.readyState === 1) {
      return resolve(true);
    }

    if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
      return resolve(false);
    }

    const checkInterval = 200;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += checkInterval;

      if (mongoose.connection.readyState === 1) {
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

const attemptReconnect = async (): Promise<void> => {
  if (isConnecting || mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`MongoDB: Gave up reconnecting after ${MAX_RECONNECT_ATTEMPTS} attempts`);
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1), 30000);
  console.log(`MongoDB: Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);

  await new Promise(res => setTimeout(res, delay));
  await connectDB();
};

export default defineNitroPlugin(async (nitroApp) => {
  // Connection Event Monitors
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message || err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected.');
    if (!process.env.VERCEL) {
      attemptReconnect();
    }
  });

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected.');
    reconnectAttempts = 0;
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected.');
    reconnectAttempts = 0;
  });

  // Connect on startup
  console.log('Initializing MongoDB connection via Nitro plugin...');
  await connectDB();
});
