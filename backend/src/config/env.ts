import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || 'secret',
  TELEGRAM_API_ID: process.env.TELEGRAM_API_ID ? parseInt(process.env.TELEGRAM_API_ID) : 0,
  TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH || '',
  TELEGRAM_SESSION_STRING: process.env.TELEGRAM_SESSION_STRING || '',
  TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID || 'me',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
