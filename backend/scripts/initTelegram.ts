import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
// @ts-ignore
import input from 'input';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Api } from 'telegram';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiId = process.env.TELEGRAM_API_ID ? parseInt(process.env.TELEGRAM_API_ID) : 0;
const apiHash = process.env.TELEGRAM_API_HASH || '';

const stringSession = new StringSession(''); // Empty string for new session

if (!apiId || !apiHash) {
  console.error('❌ TELEGRAM_API_ID or TELEGRAM_API_HASH is missing in .env file');
  process.exit(1);
}

const generateSession = async () => {
  console.log('Loading interactive Telegram login...');
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Enter your Telegram Phone Number (e.g. +1234567890): '),
    password: async () => await input.text('Enter your 2FA password (if any): '),
    phoneCode: async () => await input.text('Enter the code you received on Telegram: '),
    onError: (err) => console.log(err),
  });

  console.log('✅ You are successfully logged in!');
  const sessionString = client.session.save() as unknown as string;
  
  // Create Private Channel "CloudGallery"
  let channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId || channelId === 'me') {
    console.log('Creating private channel "CloudGallery"...');
    try {
      const result: any = await client.invoke(
        new Api.channels.CreateChannel({
          title: 'CloudGallery Storage',
          about: 'Private storage for CloudGallery app',
          megagroup: false,
        })
      );
      if (result && result.chats && result.chats.length > 0) {
        channelId = result.chats[0].id.toString();
        // Telethon/GramJS sometimes require -100 prefix for channels depending on usage, but for MTProto integer IDs are fine. We will use the string version.
        console.log(`✅ Channel created! ID: ${channelId}`);
      }
    } catch (e: any) {
      console.error('Failed to create channel:', e.message);
    }
  }

  // Auto-update .env
  const envPath = path.resolve(__dirname, '../.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(/TELEGRAM_SESSION_STRING=.*/g, `TELEGRAM_SESSION_STRING=${sessionString}`);
  if (channelId) {
    envContent = envContent.replace(/TELEGRAM_CHANNEL_ID=.*/g, `TELEGRAM_CHANNEL_ID=${channelId}`);
  }
  fs.writeFileSync(envPath, envContent);

  console.log('\n======================================================');
  console.log('✅ Credentials automatically saved to .env!');
  console.log('You can now start your server using: npm run dev');
  console.log('======================================================\n');
  
  await client.disconnect();
  process.exit(0);
};

generateSession();
