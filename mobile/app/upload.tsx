import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../src/store/useAuthStore';
import { usePhotoStore } from '../src/store/usePhotoStore';
import { useUploadStore } from '../src/store/useUploadStore';

const ProgressBar = ({ progress, isDark }: { progress: number; isDark: boolean }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progress}%`, { duration: 300 }),
  }));

  return (
    <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
      <Animated.View style={[styles.progressFill, animatedStyle, { backgroundColor: isDark ? '#fff' : '#000' }]} />
    </View>
  );
};

export default function UploadManagerScreen() {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { items, isUploading, startUploads, clearCompleted, pauseAll, resumeAll, cancelAll, pauseUpload, resumeUpload, cancelUpload } = useUploadStore();
  const { fetchPhotos } = usePhotoStore();
  const { isGuest } = useAuthStore();

  useEffect(() => {
    if (!isUploading && items.some((item) => item.status === 'pending')) {
      startUploads(fetchPhotos, isGuest);
    }
  }, [fetchPhotos, isGuest, isUploading, items, startUploads]);

  const handleClose = () => {
    clearCompleted();
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#050505' : '#f7f7f7' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <View>
          <Text style={[styles.kicker, { color: isDark ? '#bdbdbd' : '#5c5c5c' }]}>Cloud</Text>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Upload</Text>
        </View>
        <BlurView intensity={78} tint={isDark ? 'dark' : 'light'} style={styles.headerIcon}>
          <TouchableOpacity style={styles.iconHitbox} onPress={handleClose} activeOpacity={0.84}>
            <Ionicons name="close" size={21} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        </BlurView>
      </View>

      {items.length > 0 && (
        <View style={styles.globalActions}>
          <TouchableOpacity style={styles.globalBtn} onPress={pauseAll} activeOpacity={0.8}>
            <Ionicons name="pause" size={16} color={isDark ? '#fff' : '#000'} />
            <Text style={[styles.globalBtnText, { color: isDark ? '#fff' : '#000' }]}>Pause All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.globalBtn} onPress={resumeAll} activeOpacity={0.8}>
            <Ionicons name="play" size={16} color={isDark ? '#fff' : '#000'} />
            <Text style={[styles.globalBtnText, { color: isDark ? '#fff' : '#000' }]}>Resume All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.globalBtn} onPress={cancelAll} activeOpacity={0.8}>
            <Ionicons name="close" size={16} color={isDark ? '#fff' : '#000'} />
            <Text style={[styles.globalBtnText, { color: isDark ? '#fff' : '#000' }]}>Cancel All</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlashList
        data={items}
        contentContainerStyle={{ paddingBottom: insets.bottom + 36, paddingHorizontal: 18 }}
        renderItem={({ item }: { item: any }) => {
          const isDone = item.status === 'done';
          const isError = item.status === 'error';

          return (
            <BlurView intensity={74} tint={isDark ? 'dark' : 'light'} style={styles.itemRow}>
              <Image source={item.asset.uri} style={styles.thumbnail} contentFit="cover" />

              <View style={styles.itemInfo}>
                <Text style={[styles.filename, { color: isDark ? '#fff' : '#000' }]} numberOfLines={1}>
                  {item.asset.fileName || 'Photo'}
                </Text>

                {isDone ? (
                  <Text style={[styles.statusText, { color: isDark ? '#d8d8d8' : '#333' }]}>Completed</Text>
                ) : isError ? (
                  <Text style={styles.statusErrorText}>{item.errorMessage || 'Failed'}</Text>
                ) : item.status === 'paused' ? (
                  <Text style={[styles.statusText, { color: '#ffcc00' }]}>Paused</Text>
                ) : item.status === 'cancelled' ? (
                  <Text style={[styles.statusText, { color: '#ff3b30' }]}>Cancelled</Text>
                ) : (
                  <Text style={[styles.statusText, { color: isDark ? '#aaa' : '#595959' }]}>
                    {item.status === 'uploading' ? `Uploading ${item.progress}%` : 'Waiting'}
                  </Text>
                )}

                {!isDone && !isError && item.status !== 'cancelled' ? (
                  <ProgressBar progress={item.progress} isDark={isDark} />
                ) : null}
              </View>

              {!isDone && !isError && item.status !== 'cancelled' && (
                <View style={styles.itemActions}>
                  {item.status === 'paused' ? (
                    <TouchableOpacity onPress={() => resumeUpload(item.id)} style={styles.actionBtn}>
                      <Ionicons name="play-circle" size={24} color={isDark ? '#fff' : '#000'} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => pauseUpload(item.id)} style={styles.actionBtn}>
                      <Ionicons name="pause-circle" size={24} color={isDark ? '#fff' : '#000'} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => cancelUpload(item.id)} style={styles.actionBtn}>
                    <Ionicons name="close-circle" size={24} color={isDark ? '#ff3b30' : '#ff3b30'} />
                  </TouchableOpacity>
                </View>
              )}

              {isDone ? <Ionicons name="checkmark-circle" size={28} color={isDark ? '#fff' : '#000'} /> : null}
              {isError ? <Ionicons name="close-circle" size={28} color="#fff" /> : null}
            </BlurView>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <BlurView intensity={74} tint={isDark ? 'dark' : 'light'} style={styles.emptyGlass}>
              <Ionicons name="cloud-upload-outline" size={34} color={isDark ? '#fff' : '#000'} />
              <Text style={[styles.emptyTitle, { color: isDark ? '#fff' : '#000' }]}>No active uploads</Text>
            </BlurView>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 56,
  },
  headerIcon: {
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    height: 50,
    overflow: 'hidden',
    width: 50,
  },
  iconHitbox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  itemRow: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginBottom: 10,
    overflow: 'hidden',
    padding: 12,
  },
  thumbnail: {
    backgroundColor: '#161616',
    borderRadius: 20,
    height: 64,
    width: 64,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 14,
  },
  filename: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  statusErrorText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  progressTrack: {
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    borderRadius: 3,
    height: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyGlass: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    overflow: 'hidden',
    padding: 24,
    width: '100%',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  globalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  globalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(120,120,120,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  globalBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
});
