import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../src/store/useAuthStore';
import { useBackupStore } from '../src/store/useBackupStore';
import { registerBackgroundBackup, unregisterBackgroundBackup } from '../src/services/BackgroundBackup';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { token, isLoading, restoreToken, isGuest } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    restoreToken();
    useBackupStore.getState().init().then(() => {
      const { autoBackupEnabled } = useBackupStore.getState();
      if (autoBackupEnabled) {
        registerBackgroundBackup();
      }
    });
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !isGuest && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if ((token || isGuest) && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [token, isGuest, segments, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      if (!token && !isGuest) {
        // If they need to login, hide splash immediately
        setTimeout(() => SplashScreen.hideAsync(), 100);
      }
    }
  }, [isLoading, token, isGuest]);

  if (isLoading) {
    return null; // Or a custom loading screen component
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="photo/[id]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="upload" options={{ presentation: 'modal' }} />
        <Stack.Screen name="album/[filter]" options={{ headerShown: false }} />
        <Stack.Screen name="shared-list" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="album/user/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="shared-album/[token]" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
