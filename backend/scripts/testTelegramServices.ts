import { initTelegramClient, uploadToTelegram, downloadFromTelegram } from '../src/services/telegramService';
import { connectDB } from '../src/config/db';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runTest() {
  try {
    console.log('Connecting to DB...');
    await connectDB();
    
    console.log('Initializing Telegram...');
    await initTelegramClient();
    
    console.log('Creating dummy file buffer...');
    const buffer = Buffer.from('This is a test image file content for cloudgallery', 'utf-8');
    
    console.log('Testing Upload...');
    const uploadResult = await uploadToTelegram(buffer, 'test_image.txt');
    console.log('Upload Result:', uploadResult);
    
    if (!uploadResult) {
      throw new Error('Upload returned null');
    }
    
    console.log('Testing Download...');
    const downloadedBuffer = await downloadFromTelegram(uploadResult.messageId);
    console.log('Downloaded Content:', downloadedBuffer.toString('utf-8'));
    
    console.log('✅ ALL TELEGRAM TESTS PASSED!');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

runTest();
