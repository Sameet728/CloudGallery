import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BackupSettings {
  autoBackupEnabled: boolean;
  backupOverCellular: boolean;
  selectedAlbums: string[]; // List of album IDs or names that should be backed up
  lastBackupTime: number;
}

interface BackupStore extends BackupSettings {
  setSettings: (settings: Partial<BackupSettings>) => void;
  toggleAlbum: (albumId: string) => void;
  init: () => Promise<void>;
}

const STORAGE_KEY = '@cloudgallery_backup_settings';

const defaultSettings: BackupSettings = {
  autoBackupEnabled: false,
  backupOverCellular: false,
  selectedAlbums: [],
  lastBackupTime: 0,
};

export const useBackupStore = create<BackupStore>((set, get) => ({
  ...defaultSettings,

  setSettings: async (settings) => {
    const nextSettings = { ...get(), ...settings };
    set(settings);
    
    getStorage().set('backup_prefs', JSON.stringify({ 
      autoBackupEnabled: nextSettings.autoBackupEnabled, 
      backupOverCellular: nextSettings.backupOverCellular, 
      selectedAlbums: nextSettings.selectedAlbums 
    }));
    getStorage().set('backup_state', JSON.stringify({ lastBackupTime: nextSettings.lastBackupTime }));
  },

  toggleAlbum: async (albumId: string) => {
    const { selectedAlbums } = get();
    const isSelected = selectedAlbums.includes(albumId);
    const newSelected = isSelected 
      ? selectedAlbums.filter(id => id !== albumId)
      : [...selectedAlbums, albumId];
    
    await get().setSettings({ selectedAlbums: newSelected });
  },

  init: async () => {
    try {
      const prefsStr = getStorage().getString('backup_prefs');
      const stateStr = getStorage().getString('backup_state');
      
      const prefs = prefsStr ? JSON.parse(prefsStr) : {};
      const state = stateStr ? JSON.parse(stateStr) : {};
      
      set({
        autoBackupEnabled: prefs.autoBackupEnabled ?? defaultSettings.autoBackupEnabled,
        backupOverCellular: prefs.backupOverCellular ?? defaultSettings.backupOverCellular,
        selectedAlbums: prefs.selectedAlbums ?? defaultSettings.selectedAlbums,
        lastBackupTime: state.lastBackupTime ?? defaultSettings.lastBackupTime,
      });
    } catch (e) {
      console.error('Failed to load backup settings', e);
    }
  }
}));
