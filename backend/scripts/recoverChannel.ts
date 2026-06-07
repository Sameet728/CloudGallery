import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiId = process.env.TELEGRAM_API_ID ? parseInt(process.env.TELEGRAM_API_ID) : 0;
const apiHash = process.env.TELEGRAM_API_HASH || '';
const session = process.env.TELEGRAM_SESSION_STRING || '';

const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });

async function run() {
  await client.connect();
  const dialogs = await client.getDialogs();
  let channelId = null;
  for (const dialog of dialogs) {
    if (dialog.title === 'CloudGallery Storage') {
      // @ts-ignore
      channelId = dialog.entity?.id?.toString();
      // @ts-ignore
      channelId = dialog.id?.toString();
      break;
    }
  }
  
  if (channelId) {
    console.log('Found Channel ID:', channelId);
    const envPath = path.resolve(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('TELEGRAM_CHANNEL_ID=')) {
      fs.appendFileSync(envPath, `\nTELEGRAM_CHANNEL_ID=${channelId}\n`);
    } else {
      envContent = envContent.replace(/TELEGRAM_CHANNEL_ID=.*/g, `TELEGRAM_CHANNEL_ID=${channelId}`);
      fs.writeFileSync(envPath, envContent);
    }
    console.log('Saved to .env!');
  } else {
    console.log('Channel not found. Will just cache "me".');
  }
  await client.disconnect();
  process.exit(0);
}

run();
