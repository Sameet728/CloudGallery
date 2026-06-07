import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as faceapi from '@vladmandic/face-api/dist/face-api.node-wasm.js';
import Tesseract from 'tesseract.js';
import exifReader from 'exif-reader';
import jpeg from 'jpeg-js';
import sharp from 'sharp';
import path from 'path';
import mongoose from 'mongoose';
import Person from '../models/Person';

let model: mobilenet.MobileNet | null = null;

export const initAIModels = async () => {
  try {
    await tf.setBackend('wasm');
    await tf.ready();
    
    console.log('Loading MobileNet Model...');
    model = await mobilenet.load({ version: 2, alpha: 1.0 });
    console.log('✅ MobileNet Model Loaded');
    
    console.log('Loading Face-API Models...');
    const modelPath = path.join(__dirname, '../../node_modules/@vladmandic/face-api/model');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
    console.log('✅ Face-API Models Loaded');
  } catch (error) {
    console.error('Failed to load models:', error);
  }
};

export const generateTags = async (buffer: Buffer): Promise<string[]> => {
  if (!model) return [];
  try {
    const pixels = jpeg.decode(buffer, { useTArray: true });
    
    // Create tensor from pixels
    const tensor = tf.tensor3d(
      pixels.data,
      [pixels.height, pixels.width, 4],
      'int32'
    ).slice([0, 0, 0], [-1, -1, 3]); // Remove alpha channel

    const predictions = await model.classify(tensor as any);
    tensor.dispose(); // Free memory
    
    return predictions.map(p => p.className.split(', ')).flat();
  } catch (error) {
    console.error('Tagging Error:', error);
    return [];
  }
};

export const processFaces = async (buffer: Buffer, photoId: string, userId: string) => {
  try {
    const pixels = jpeg.decode(buffer, { useTArray: true });
    const tensor = tf.tensor3d(
      pixels.data,
      [pixels.height, pixels.width, 4],
      'int32'
    ).slice([0, 0, 0], [-1, -1, 3]);

    // Detect faces and extract embeddings
    const detections = await faceapi.detectAllFaces(tensor as any)
      .withFaceLandmarks()
      .withFaceDescriptors();

    tensor.dispose();

    if (detections.length === 0) return [];

    const faceIds = [];

    // Cluster faces
    for (const det of detections) {
      const descriptor = Array.from(det.descriptor);
      const box = {
        x: det.detection.box.x,
        y: det.detection.box.y,
        width: det.detection.box.width,
        height: det.detection.box.height
      };

      // Find all existing people for this user
      const people = await Person.find({ userId });
      let matchedPerson = null;
      let minDistance = 0.6; // Euclidean distance threshold

      for (const person of people) {
        for (const face of person.faces) {
          const distance = faceapi.euclideanDistance(det.descriptor, new Float32Array(face.descriptor));
          if (distance < minDistance) {
            minDistance = distance;
            matchedPerson = person;
          }
        }
      }

      if (matchedPerson) {
        // Add to existing person
        matchedPerson.faces.push({ photoId: new mongoose.Types.ObjectId(photoId), descriptor, box });
        await matchedPerson.save();
        faceIds.push(matchedPerson._id);
      } else {
        // Create new unknown person
        const newPerson = new Person({
          userId: new mongoose.Types.ObjectId(userId),
          name: 'Unknown Person',
          faces: [{ photoId: new mongoose.Types.ObjectId(photoId), descriptor, box }]
        });
        await newPerson.save();
        faceIds.push(newPerson._id);
      }
    }

    return faceIds;
  } catch (error) {
    console.error('Face Processing Error:', error);
    return [];
  }
};

export const extractOCR = async (buffer: Buffer): Promise<string> => {
  try {
    // Preprocess image for better OCR accuracy
    // Grayscale, resize, normalize contrast, and apply strict binarization
    const processedBuffer = await sharp(buffer)
      .resize({ width: 2000, withoutEnlargement: true }) // Upscale if small for better character definition
      .grayscale()
      .normalize()
      .threshold(140) // Pure black and white to completely eliminate background noise
      .toBuffer();

    const result = await Tesseract.recognize(processedBuffer, 'eng', {
      logger: m => {} // suppress logs
    });
    return result.data.text.trim();
  } catch (error) {
    console.error('OCR Error:', error);
    return '';
  }
};

export const extractExif = (buffer: Buffer) => {
  try {
    const exifOffset = buffer.indexOf(Buffer.from([0xff, 0xe1]));
    if (exifOffset !== -1) {
      const exifData: any = exifReader(buffer.slice(exifOffset + 4));
      
      let location;
      if (exifData?.gps?.GPSLatitude && exifData?.gps?.GPSLongitude) {
        location = {
          latitude: exifData.gps.GPSLatitude[0] + exifData.gps.GPSLatitude[1]/60 + exifData.gps.GPSLatitude[2]/3600,
          longitude: exifData.gps.GPSLongitude[0] + exifData.gps.GPSLongitude[1]/60 + exifData.gps.GPSLongitude[2]/3600,
        };
        
        if (exifData.gps.GPSLatitudeRef === 'S') location.latitude = -location.latitude;
        if (exifData.gps.GPSLongitudeRef === 'W') location.longitude = -location.longitude;
      }
      
      return {
        width: exifData?.image?.ImageWidth,
        height: exifData?.image?.ImageLength,
        location
      };
    }
  } catch (error) {
    // Exif parsing errors can happen on invalid/missing metadata, ignore
  }
  return null;
};

export const generatePlaceholder = async (buffer: Buffer): Promise<string> => {
  try {
    const resizedBuffer = await sharp(buffer)
      .resize(20, 20, { fit: 'inside' })
      .blur(5)
      .jpeg({ quality: 20 })
      .toBuffer();
    return `data:image/jpeg;base64,${resizedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Placeholder generation error:', error);
    return '';
  }
};
