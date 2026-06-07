import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import { env } from '../config/env';

let client: TelegramClient;
const stringSession = new StringSession(env.TELEGRAM_SESSION_STRING);

export const initTelegramClient = async () => {
  if (!env.TELEGRAM_API_ID || !env.TELEGRAM_API_HASH) {
    console.warn('⚠️ TELEGRAM_API_ID or TELEGRAM_API_HASH not set. Telegram service disabled.');
    return;
  }

  client = new TelegramClient(stringSession, env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH, {
    connectionRetries: 5,
  });

  await client.connect();
  console.log('✅ Telegram Client Connected.');
};

/**
 * Uploads a file buffer to the configured Telegram channel using MTProto
 */
export const uploadToTelegram = async (fileBuffer: Buffer, fileName: string) => {
  if (!client) throw new Error('Telegram Client not initialized');

  try {
    const customFile = new CustomFile(fileName, fileBuffer.length, '', fileBuffer);
    
    // Upload to 'Saved Messages' (me) or a specific channel/chat
    console.log('Uploading file to Telegram:', fileName, fileBuffer.length, 'bytes');
    const result = await client.sendFile(env.TELEGRAM_CHANNEL_ID as string, {
      file: customFile,
      workers: 1,
    });
    console.log('Upload completed:', result.id);

    if (result && result.id) {
      // Need to extract a string representation of the file to store
      // GramJS doesn't use simple file_id strings like Bot API, but we can extract the ID and access hash
      // A common way is to store the message ID and fetch it later since we know the chat
      return {
        fileId: `${result.chatId}_${result.id}`,
        messageId: result.id,
        fileSize: fileBuffer.length,
      };
    }
    
    throw new Error('Failed to get result from Telegram');
  } catch (error: any) {
    console.error('Telegram Upload Error:', error);
    throw new Error('Failed to upload file to Telegram');
  }
};

/**
 * Downloads a file from Telegram using MTProto
 */
export const downloadFromTelegram = async (messageId: number): Promise<Buffer> => {
  if (!client) throw new Error('Telegram Client not initialized');

  try {
    const messages = await client.getMessages(env.TELEGRAM_CHANNEL_ID, {
      ids: [messageId],
    });

    if (messages.length > 0 && messages[0].media) {
      const buffer = await client.downloadMedia(messages[0].media, {});
      return buffer as Buffer;
    }
    throw new Error('Message or media not found');
  } catch (error: any) {
    console.error('Telegram Download Error:', error);
    throw new Error('Failed to download file from Telegram');
  }
};

/**
 * Returns an async iterator to stream a file from Telegram using MTProto
 */
export const streamFromTelegram = async function* (messageId: number) {
  if (!client) throw new Error('Telegram Client not initialized');

  try {
    const messages = await client.getMessages(env.TELEGRAM_CHANNEL_ID, {
      ids: [messageId],
    });

    if (messages.length > 0 && messages[0].media) {
      // Chunk size of 1MB for fast streaming
      const asyncIterable = client.iterDownload({
        file: messages[0].media,
        requestSize: 1024 * 1024,
      });

      for await (const chunk of asyncIterable) {
        yield chunk;
      }
    } else {
      throw new Error('Message or media not found');
    }
  } catch (error: any) {
    console.error('Telegram Stream Error:', error);
    throw new Error('Failed to stream file from Telegram');
  }
};

/**
 * Deletes a file message from Telegram
 */
export const deleteFromTelegram = async (messageId: number) => {
  if (!client) return;

  try {
    await client.deleteMessages(env.TELEGRAM_CHANNEL_ID, [messageId], {
      revoke: true,
    });
  } catch (error: any) {
    console.error('Telegram Delete Error:', error);
  }
};
