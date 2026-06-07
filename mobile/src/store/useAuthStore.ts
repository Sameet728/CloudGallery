import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import api from '../services/api';

interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  storageUsed: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  restoreToken: () => Promise<void>;
  setGuestMode: () => void;
}

const TOKEN_KEY = 'userToken';

const tokenStorage = {
  get: async () => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }

    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  set: async (token: string) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      return;
    }

    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  remove: async () => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }

    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isGuest: false,
  login: async (token, user) => {
    await tokenStorage.set(token);
    set({ token, user, isLoading: false, isGuest: false });
  },
  logout: async () => {
    await tokenStorage.remove();
    set({ token: null, user: null, isLoading: false, isGuest: false });
  },
  restoreToken: async () => {
    try {
      const token = await tokenStorage.get();
      if (token) {
        // Verify token with backend
        const response = await api.get('/auth/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        set({ token, user: response.data, isLoading: false, isGuest: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to restore token', error);
      await tokenStorage.remove();
      set({ token: null, user: null, isLoading: false, isGuest: false });
    }
  },
  setGuestMode: () => set({ token: null, user: null, isLoading: false, isGuest: true }),
}));
