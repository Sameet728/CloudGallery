// @ts-nocheck
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as MediaLibrary from 'expo-media-library';
import * as Network from 'expo-network';
import { useBackupStore } from '../store/useBackupStore';
import { useUploadStore } from '../store/useUploadStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePhotoStore } from '../store/usePhotoStore';

const BACKGROUND_BACKUP_TASK = 'BACKGROUND_BACKUP_TASK';

TaskManager.defineTask(BACKGROUND_BACKUP_TASK, async () => {
  try {
    const { autoBackupEnabled, backupOverCellular, selectedAlbums, lastBackupTime } = useBackupStore.getState();
    const { isGuest } = useAuthStore.getState();

    if (!autoBackupEnabled || isGuest) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Check Network conditions
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    if (!backupOverCellular && networkState.type === Network.NetworkStateType.CELLULAR) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Has permission?
    const permission = await MediaLibrary.getPermissionsAsync();
    if (!permission.granted) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    let newAssetsAdded = false;
    let newestAssetTime = lastBackupTime;

    // Retry failed/paused uploads
    const { items, resumeAll } = useUploadStore.getState();
    const hasErrors = items.some(i => i.status === 'error');
    if (hasErrors) {
      resumeAll();
      newAssetsAdded = true;
    }

    if (selectedAlbums.length === 0) {
      return newAssetsAdded ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
    }

    for (const albumId of selectedAlbums) {
      const options: MediaLibrary.AssetsOptions = {
        first: 100,
        mediaType: ['photo', 'video'],
        sortBy: ['creationTime'], // descending by default
        album: albumId,
      };

      if (lastBackupTime > 0) {
        options.createdAfter = lastBackupTime;
      }

      const result = await MediaLibrary.getAssetsAsync(options);
      
      if (result.assets.length > 0) {
        newAssetsAdded = true;
        // Update newest time
        for (const asset of result.assets) {
          if (asset.creationTime > newestAssetTime) {
            newestAssetTime = asset.creationTime;
          }
        }

        // Filter out assets we already have in queue to be safe
        const { items, addUploads, startUploads } = useUploadStore.getState();
        const { fetchPhotos } = usePhotoStore.getState();
        
        const existingIds = new Set(items.map(i => i.asset.id));
        const toUpload = result.assets.filter(a => !existingIds.has(a.id));

        if (toUpload.length > 0) {
          addUploads(toUpload);
          startUploads(fetchPhotos, isGuest);
        }
      }
    }

    if (newAssetsAdded) {
      useBackupStore.getState().setSettings({ lastBackupTime: newestAssetTime });
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('Background backup error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundBackup() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_BACKUP_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_BACKUP_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log('Background backup task registered');
    }
  } catch (err) {
    console.error('Failed to register background backup task', err);
  }
}

export async function unregisterBackgroundBackup() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_BACKUP_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_BACKUP_TASK);
      console.log('Background backup task unregistered');
    }
  } catch (err) {
    console.error('Failed to unregister background backup task', err);
  }
}
