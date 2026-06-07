// @ts-nocheck
import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { usePhotoStore } from '../../src/store/usePhotoStore';
import { useUploadStore } from '../../src/store/useUploadStore';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

const AnimatedImage = Animated.createAnimatedComponent(Image) as any;

const COLUMN_COUNT = 3;
const GRID_GAP = 1.5;
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

const FILTER_META: Record<string, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
  cloud:     { title: 'Cloud',     subtitle: 'Synced originals',   icon: 'cloud-outline' },
  favorites: { title: 'Favorites', subtitle: 'Pinned by you',      icon: 'heart-outline' },
  local:     { title: 'Local',     subtitle: 'On this device',     icon: 'phone-portrait-outline' },
  shared:    { title: 'Shared',    subtitle: 'Shared spaces',       icon: 'people-outline' },
};

export default function AlbumFilterScreen() {
  const { filter } = useLocalSearchParams<{ filter: string }>();
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { photos, loading } = usePhotoStore();
  const uploadItems = useUploadStore((state) => state.items);
  const { isGuest, token } = useAuthStore();
  const { addUploads } = useUploadStore();
  const { width } = useWindowDimensions();
  const itemSize = (width - GRID_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

  const aggregatedPhotos = useMemo(() => {
    const pendingUploads = uploadItems
      .filter(i => i.status !== 'done' && i.status !== 'cancelled')
      .map(i => ({
        _id: i.id,
        uri: i.asset.uri,
        fileName: i.asset.fileName || 'Uploading...',
        creationTime: Date.now(),
        isUploadingObject: true,
        uploadProgress: i.progress,
        uploadStatus: i.status
      }));
    return [...pendingUploads, ...photos];
  }, [photos, uploadItems]);

  const filteredPhotos = useMemo(() => {
    if (filter === 'favorites') {
      return aggregatedPhotos.filter((p) => p.favorite);
    }
    if (filter === 'videos') {
      return aggregatedPhotos.filter((p) => p.type === 'video');
    }
    if (filter === 'recent') {
      return [...aggregatedPhotos].sort((a, b) => {
        const timeA = a.uploadDate || a.creationTime || 0;
        const timeB = b.uploadDate || b.creationTime || 0;
        return timeB - timeA;
      }).slice(0, 50);
    }
    return aggregatedPhotos;
  }, [aggregatedPhotos, filter]);

  // Actions
  const handleBackupAllLocal = () => {
    const localPhotos = photos.filter((p) => !!p.uri);
    if (localPhotos.length === 0) return;
    
    const assets = localPhotos.map(p => ({
      uri: p.uri,
      assetId: p._id,
      fileName: p.fileName || `local_${Date.now()}.jpg`,
      width: 1000,
      height: 1000,
    } as any));
    
    addUploads(assets);
    router.push('/upload');
  };

  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled && result.assets) {
      addUploads(result.assets);
      const { startUploads } = useUploadStore.getState();
      startUploads(fetchPhotos, isGuest);
    }
  };

  const bg = isDark ? '#050505' : '#f2f2f7';
  const textPrimary = isDark ? '#fff' : '#000';
  const textSecondary = isDark ? '#8e8e93' : '#6c6c70';

  const renderItem = ({ item: photo, index }: { item: any, index: number }) => {
    const uri = photo.uri || `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=thumbnail${token ? `&token=${token}` : ''}`;
    return (
      <TouchableOpacity
        key={photo._id}
        activeOpacity={0.86}
        onPress={() => {
          if (!photo.isUploadingObject) {
            Haptics.selectionAsync();
            usePhotoStore.getState().setViewingPhotos(filteredPhotos.filter(p => !p.isUploadingObject));
            router.push({
              pathname: '/photo/[id]',
              params: { id: photo._id, initialIndex: index, mode: 'custom' },
            });
          }
        }}
        style={[styles.tile, { backgroundColor: isDark ? '#161616' : '#e8e8e8', height: 120, margin: 2 }]}
      >
        <AnimatedImage
          sharedTransitionTag={photo._id}
          source={uri}
          placeholder={photo.blurhash || DEFAULT_BLURHASH}
          contentFit="cover"
          transition={220}
          cachePolicy="disk"
          style={styles.image}
        />
        {photo.favorite && (
          <View style={styles.favoriteBadge}>
            <Ionicons name="heart" size={14} color="#fff" />
          </View>
        )}
        {photo.isUploadingObject && (
          <View style={styles.uploadingOverlay}>
            <Ionicons 
              name={photo.uploadStatus === 'paused' ? 'pause' : 'cloud-upload'} 
              size={18} 
              color={photo.uploadStatus === 'paused' ? '#ffcc00' : '#fff'} 
            />
            {photo.uploadStatus === 'uploading' && (
              <Text style={styles.uploadingText}>{Math.round(photo.uploadProgress * 100)}%</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />

      {/* Header */}
      <BlurView intensity={82} tint={isDark ? 'dark' : 'light'} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={textPrimary} />
          <Text style={[styles.backText, { color: textPrimary }]}>Albums</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>{filter}</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>{filteredPhotos.length} photos</Text>
        </View>
        <View style={{ width: 80, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 4 }}>
          {filteredPhotos.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                usePhotoStore.getState().setViewingPhotos(filteredPhotos);
                router.push('/slideshow');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="play-circle-outline" size={26} color={textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </BlurView>

      {/* Grid */}
      {filteredPhotos.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(350)} style={[styles.empty, { paddingTop: insets.top + 100 }]}>
          <Ionicons name="images-outline" size={52} color={textSecondary} />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>No photos</Text>
        </Animated.View>
      ) : (
        <FlashList
          data={filteredPhotos}
          renderItem={renderItem}
          numColumns={3}
          estimatedItemSize={itemSize}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingTop: insets.top + 88, 
            paddingBottom: insets.bottom + 120 
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: 80,
    paddingVertical: 4,
  },
  backText: { fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  row: { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
  tile: { overflow: 'hidden', borderRadius: 4 },
  image: { ...StyleSheet.absoluteFillObject },
  empty: { flex: 1, alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  actionBarTop: {
    position: 'absolute',
    left: 12, right: 12,
    zIndex: 90,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  actionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  actionSub: { fontSize: 12, fontWeight: '500' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
