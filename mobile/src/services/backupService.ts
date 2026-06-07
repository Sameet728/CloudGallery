import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as MediaLibrary from 'expo-media-library';
import api from './api';
import * as SecureStore from 'expo-secure-store';

const BACKGROUND_FETCH_TASK = 'background-sync-task';

// Define the background task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) return BackgroundFetch.BackgroundFetchResult.NoData;

    console.log('[Background Fetch] Starting media sync...');
    
    // Get recent media
    const media = await MediaLibrary.getAssetsAsync({
      first: 50, // Get last 50 photos
      mediaType: ['photo', 'video'],
      sortBy: [MediaLibrary.SortBy.creationTime],
    });

    let uploadedCount = 0;

    for (const asset of media.assets) {
      // In a real app, we'd check against a local SQLite DB if this asset ID was already uploaded
      // For MVP, we will attempt upload. The backend uses SHA256 hash to reject duplicates.
      
      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        name: asset.filename,
        type: asset.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
      } as any);

      try {
        await api.post('/photos', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
        });
        uploadedCount++;
        console.log(`[Background Fetch] Uploaded ${asset.filename}`);
      } catch (error: any) {
        if (error.response?.status !== 409) {
          console.error(`[Background Fetch] Failed to upload ${asset.filename}:`, error.message);
        }
      }
    }

    return uploadedCount > 0 
      ? BackgroundFetch.BackgroundFetchResult.NewData 
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (err) {
    console.error('[Background Fetch] Failed:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Function to register the task
export async function registerBackgroundSyncAsync() {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: 60 * 15, // 15 minutes
    stopOnTerminate: false, // Android only
    startOnBoot: true,      // Android only
  });
}

// Function to unregister the task
export async function unregisterBackgroundSyncAsync() {
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
}
