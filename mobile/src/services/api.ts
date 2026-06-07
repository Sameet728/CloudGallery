import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Use environment variable if available, otherwise fallback to local IP
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://cloudgallery-sln1.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error fetching token for API request', error);
  }
  return config;
});

export default api;
