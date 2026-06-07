import mongoose from 'mongoose';
import Photo from '../src/models/Photo';
import User from '../src/models/User';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MOCK_COUNT = 10000;

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const user = await User.findOne();
  if (!user) {
    console.error('No users found in database.');
    process.exit(1);
  }

  console.log(`Generating ${MOCK_COUNT} mock photos for user ${user.username}...`);

  const photos = [];
  const now = Date.now();
  
  for (let i = 0; i < MOCK_COUNT; i++) {
    photos.push({
      userId: user._id,
      telegramFileId: 'mock_file_id',
      telegramMessageId: 1,
      fileName: `mock_photo_${i}.jpg`,
      fileSize: 1024,
      mimeType: 'image/jpeg',
      width: 1080,
      height: 1920,
      uploadDate: new Date(now - i * 1000 * 60), // Space out by minutes
      hash: `mock_hash_${Date.now()}_${i}`,
      blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH', // Default colorful blurhash
      tags: ['mock', 'stress-test'],
      favorite: i % 50 === 0,
      deleted: false,
    });

    if (photos.length === 1000) {
      await Photo.insertMany(photos);
      console.log(`Inserted ${i + 1} photos...`);
      photos.length = 0;
    }
  }

  if (photos.length > 0) {
    await Photo.insertMany(photos);
    console.log(`Inserted final batch.`);
  }

  console.log('Done!');
  process.exit(0);
}

run().catch(console.error);
