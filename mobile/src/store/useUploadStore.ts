// @ts-nocheck
import { create } from 'zustand';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { MMKV } from 'react-native-mmkv';
import api from '../services/api';
import { useAuthStore } from './useAuthStore';
import { usePhotoStore } from './usePhotoStore';

export type UploadStatus = 'pending' | 'uploading' | 'paused' | 'done' | 'error' | 'cancelled';

export interface UploadItem {
  id: string;
  asset: ImagePicker.ImagePickerAsset;
  progress: number;
  status: UploadStatus;
  errorMessage?: string;
}

interface UploadStore {
  items: UploadItem[];
  isUploading: boolean;
  addUploads: (assets: ImagePicker.ImagePickerAsset[]) => void;
  startUploads: (fetchPhotos: (isGuest: boolean) => Promise<void>, isGuest: boolean) => Promise<void>;
  pauseUpload: (id: string) => Promise<void>;
  resumeUpload: (id: string) => Promise<void>;
  cancelUpload: (id: string) => Promise<void>;
  pauseAll: () => Promise<void>;
  resumeAll: () => Promise<void>;
  cancelAll: () => Promise<void>;
  clearCompleted: () => void;
  init: () => Promise<void>;
}

const activeTasks = new Map<string, FileSystem.UploadTask>();

const MAX_CONCURRENT = 5;

// Setup MMKV instance
const storage = new MMKV();

export const useUploadStore = create<UploadStore>((set, get) => ({
  items: [],
  isUploading: false,
  
  init: async () => {
    try {
      const savedQueueStr = storage.getString('upload_queue');
      if (savedQueueStr) {
        const parsed = JSON.parse(savedQueueStr);
        set({
          items: parsed.map((i: UploadItem) => ({
            ...i,
            status: i.status === 'uploading' ? 'pending' : i.status,
          }))
        });
        
        // Auto-resume pending uploads if logged in
        const { isGuest } = useAuthStore.getState();
        const { fetchPhotos } = usePhotoStore.getState();
        if (!isGuest && parsed.some((i: UploadItem) => i.status === 'pending' || i.status === 'uploading')) {
          get().startUploads(fetchPhotos, isGuest);
        }
      }
    } catch (e) {}
  },
  
  addUploads: (assets) => {
    const newItems = assets.map((asset) => ({
      id: asset.assetId || Math.random().toString(36).substring(7),
      asset,
      progress: 0,
      status: 'pending' as UploadStatus,
    }));
    
    set((state) => ({
      items: [...newItems, ...state.items],
    }));
  },

  startUploads: async (fetchPhotos, isGuest) => {
    const { items, isUploading } = get();
    if (isUploading) return;
    
    set({ isUploading: true });
    
    const processQueue = async () => {
      const activeCount = get().items.filter(i => i.status === 'uploading').length;
      if (activeCount >= MAX_CONCURRENT) {
        set({ isUploading: false });
        return;
      }

      const pendingItem = get().items.find(i => i.status === 'pending');
      if (!pendingItem) {
        set({ isUploading: false });
        fetchPhotos(isGuest);
        return;
      }

      const token = useAuthStore.getState().token;
      
      set((state) => ({
        items: state.items.map(i => i.id === pendingItem.id ? { ...i, status: 'uploading', progress: 0 } : i),
      }));

      // Fire and forget upload, then trigger processQueue again
      (async () => {
        try {
          const uploadUrl = `${api.defaults.baseURL}/photos`;
          const task = FileSystem.createUploadTask(
            uploadUrl,
            pendingItem.asset.uri,
            {
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              fieldName: 'photo',
              mimeType: pendingItem.asset.mimeType || 'image/jpeg',
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              parameters: {
                name: pendingItem.asset.fileName || `upload_${Date.now()}.jpg`
              }
            },
            (data) => {
              const percentCompleted = Math.round((data.totalBytesSent * 100) / (data.totalBytesExpectedToSend || 1));
              set((state) => ({
                items: state.items.map(i => i.id === pendingItem.id && i.status !== 'paused' && i.status !== 'cancelled' ? { ...i, progress: percentCompleted } : i),
              }));
            }
          );

          activeTasks.set(pendingItem.id, task);
          const response = await task.uploadAsync();
          activeTasks.delete(pendingItem.id);

          if (!response || (response.status >= 400)) {
            throw new Error('Upload Failed');
          }

          const currentItem = get().items.find(i => i.id === pendingItem.id);
          if (currentItem?.status !== 'cancelled') {
            set((state) => ({
              items: state.items.map(i => i.id === pendingItem.id ? { ...i, status: 'done', progress: 100 } : i),
            }));
          }
        } catch (error: any) {
          activeTasks.delete(pendingItem.id);
          const currentItem = get().items.find(i => i.id === pendingItem.id);
          if (currentItem?.status !== 'cancelled' && currentItem?.status !== 'paused') {
            set((state) => ({
              items: state.items.map(i => i.id === pendingItem.id ? { 
                ...i, 
                status: 'error', 
                errorMessage: 'Failed' 
              } : i),
            }));
          }
        } finally {
          // Process next item in queue
          set({ isUploading: false });
          get().startUploads(fetchPhotos, isGuest);
        }
      })();

      // After starting one, try to start more to fill the pool
      set({ isUploading: false });
      get().startUploads(fetchPhotos, isGuest);
    };

    processQueue();
  },

  pauseUpload: async (id) => {
    const task = activeTasks.get(id);
    if (task) {
      await task.pauseAsync();
    }
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, status: 'paused' } : i),
    }));
  },

  resumeUpload: async (id) => {
    const task = activeTasks.get(id);
    if (task) {
      set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, status: 'uploading' } : i),
      }));
      await task.resumeAsync();
    } else {
      set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, status: 'pending' } : i),
      }));
      const { fetchPhotos } = usePhotoStore.getState();
      const { isGuest } = useAuthStore.getState();
      get().startUploads(fetchPhotos, isGuest);
    }
  },

  cancelUpload: async (id) => {
    const task = activeTasks.get(id);
    if (task) {
      await task.cancelAsync();
      activeTasks.delete(id);
    }
    set((state) => ({
      items: state.items.map(i => i.id === id ? { ...i, status: 'cancelled' } : i),
    }));
  },

  pauseAll: async () => {
    const items = get().items;
    for (const item of items) {
      if (item.status === 'uploading' || item.status === 'pending') {
        get().pauseUpload(item.id);
      }
    }
  },

  resumeAll: async () => {
    const items = get().items;
    let shouldStart = false;
    for (const item of items) {
      if (item.status === 'paused' || item.status === 'error' || item.status === 'cancelled') {
        get().resumeUpload(item.id);
        shouldStart = true;
      }
    }
    if (shouldStart) {
      const { fetchPhotos } = usePhotoStore.getState();
      const { isGuest } = useAuthStore.getState();
      get().startUploads(fetchPhotos, isGuest);
    }
  },

  cancelAll: async () => {
    const items = get().items;
    for (const item of items) {
      if (item.status !== 'done') {
        get().cancelUpload(item.id);
      }
    }
  },

  clearCompleted: () => {
    set((state) => ({
      items: state.items.filter((item) => item.status !== 'done' && item.status !== 'cancelled'),
    }));
  },
}));

// Subscribe to state changes and persist items
useUploadStore.subscribe((state) => {
  storage.set('upload_queue', JSON.stringify(state.items));
});

// Init from storage immediately
useUploadStore.getState().init();
