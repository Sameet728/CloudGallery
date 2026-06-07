// @ts-nocheck
import { create } from 'zustand';
import api from '../services/api';
import * as MediaLibrary from 'expo-media-library';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const cachedPhotosStr = storage.getString('photos_cache');
const initialPhotos = cachedPhotosStr ? JSON.parse(cachedPhotosStr) : [];

interface PhotoStoreState {
  photos: any[];
  trashPhotos: any[];
  viewingPhotos: any[];
  loading: boolean;
  galleryError: string | null;
  fetchPhotos: (isGuest: boolean) => Promise<void>;
  fetchTrashPhotos: (isGuest: boolean) => Promise<void>;
  deletePhoto: (photoId: string, isGuest: boolean) => Promise<void>;
  toggleFavorite: (photoId: string) => Promise<void>;
  restorePhoto: (photoId: string) => Promise<void>;
  permanentDeletePhoto: (photoId: string) => Promise<void>;
  setViewingPhotos: (photos: any[]) => void;
}

export const usePhotoStore = create<PhotoStoreState>((set, get) => ({
  photos: initialPhotos,
  trashPhotos: [],
  viewingPhotos: [],
  loading: false,
  galleryError: null,

  fetchPhotos: async (isGuest) => {
    set({ loading: true, galleryError: null });
    if (isGuest) {
      try {
        const permissionResult = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
        if (!permissionResult.granted) {
          set({ loading: false });
          return;
        }
        const media = await MediaLibrary.getAssetsAsync({
          first: 100,
          mediaType: ['photo'],
          sortBy: [MediaLibrary.SortBy.creationTime],
        });
        const localPhotos = media.assets.map(asset => ({
          _id: asset.id,
          fileName: asset.filename,
          uri: asset.uri,
          creationTime: asset.creationTime,
        }));
        set({ photos: localPhotos, loading: false });
      } catch (error: any) {
        set({ 
          galleryError: error?.message?.includes('Expo Go') 
            ? 'Expo Go blocks local gallery access on Android 13+. Please compile an APK or login.' 
            : 'Could not access local photos.',
          loading: false 
        });
      }
    } else {
      try {
        const response = await api.get('/photos');
        set({ photos: response.data.photos, loading: false });
        // Save to cache synchronously
        storage.set('photos_cache', JSON.stringify(response.data.photos));
      } catch (error) {
        console.error('Error fetching photos:', error);
        set({ loading: false });
      }
    }
  },

  fetchTrashPhotos: async (isGuest) => {
    if (isGuest) {
      set({ trashPhotos: [] });
      return;
    }
    set({ loading: true });
    try {
      const response = await api.get('/photos/trash');
      set({ trashPhotos: response.data.photos, loading: false });
    } catch (error) {
      console.error('Error fetching trash photos:', error);
      set({ loading: false });
    }
  },

  deletePhoto: async (photoId, isGuest) => {
    const { photos, fetchPhotos } = get();
    const photo = photos.find(p => p._id === photoId) || get().viewingPhotos.find(p => p._id === photoId);
    if (!photo) return;

    if (!photo.uri) {
      // Cloud
      try {
        await api.put(`/photos/${photo._id}/trash`);
        get().fetchPhotos(isGuest);
      } catch (err) {
        throw new Error('Failed to delete cloud photo');
      }
    } else {
      // Local
      try {
        await MediaLibrary.deleteAssetsAsync([photo._id]);
        get().fetchPhotos(isGuest);
      } catch (err) {
        throw new Error('Failed to delete local photo');
      }
    }
  },

  toggleFavorite: async (photoId) => {
    const { photos, viewingPhotos } = get();
    const photo = photos.find(p => p._id === photoId) || viewingPhotos.find(p => p._id === photoId);
    if (!photo || photo.uri) throw new Error('Local photos cannot be favorited');

    // Optimistic Update
    const newPhotos = [...photos];
    const idx = newPhotos.findIndex(p => p._id === photoId);
    if (idx !== -1) {
      newPhotos[idx] = { ...photo, favorite: !photo.favorite };
      set({ photos: newPhotos });
    }
    
    const newViewingPhotos = [...viewingPhotos];
    const vIdx = newViewingPhotos.findIndex(p => p._id === photoId);
    if (vIdx !== -1) {
      newViewingPhotos[vIdx] = { ...photo, favorite: !photo.favorite };
      set({ viewingPhotos: newViewingPhotos });
    }

    try {
      await api.put(`/photos/${photo._id}/favorite`);
    } catch (err) {
      // Revert on fail
      get().fetchPhotos(false);
      throw err;
    }
  },

  restorePhoto: async (photoId) => {
    const { trashPhotos } = get();
    const photo = trashPhotos.find(p => p._id === photoId);
    if (!photo) return;
    try {
      await api.put(`/photos/${photo._id}/restore`);
      get().fetchTrashPhotos(false);
      get().fetchPhotos(false);
    } catch (err) {
      throw new Error('Failed to restore photo');
    }
  },

  permanentDeletePhoto: async (photoId) => {
    const { trashPhotos } = get();
    const photo = trashPhotos.find(p => p._id === photoId);
    if (!photo) return;
    try {
      await api.delete(`/photos/${photo._id}/permanent`);
      get().fetchTrashPhotos(false);
    } catch (err) {
      throw new Error('Failed to delete photo permanently');
    }
  },

  setViewingPhotos: (photos) => set({ viewingPhotos: photos })
}));
