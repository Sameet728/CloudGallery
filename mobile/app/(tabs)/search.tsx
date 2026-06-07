// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { usePhotoStore } from '../../src/store/usePhotoStore';
import { useUploadStore } from '../../src/store/useUploadStore';

const AnimatedImage = Animated.createAnimatedComponent(Image) as any;

const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

export default function SearchScreen() {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuthStore();
  const { photos } = usePhotoStore();
  const uploadItems = useUploadStore((state) => state.items);

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

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    if (!normalized) return aggregatedPhotos.slice(0, 36);

    return aggregatedPhotos
      .filter((photo: any) => {
        const fileName = String(photo.fileName || '').toLowerCase();
        const date = String(photo.uploadDate || photo.creationTime || '').toLowerCase();
        const tags = Array.isArray(photo.tags) ? photo.tags.join(' ').toLowerCase() : '';
        const ocr = String(photo.ocrText || '').toLowerCase();
        const faceNames = Array.isArray(photo.faceIds) ? photo.faceIds.map((f: any) => f.name).join(' ').toLowerCase() : '';
        
        return fileName.includes(normalized) || 
               date.includes(normalized) || 
               tags.includes(normalized) || 
               ocr.includes(normalized) ||
               faceNames.includes(normalized);
      })
      .slice(0, 36);
  }, [aggregatedPhotos, debouncedQuery]);

  const prompts = ['Dogs', 'Cats', 'Food', 'Nature', 'Vehicles', 'Text', 'Receipts'];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#050505' : '#f7f7f7' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />

      <View style={{ flex: 1 }}>
        {/* Sticky Header and Search Bar */}
        <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
          <View>
            <Text style={[styles.kicker, { color: isDark ? '#bdbdbd' : '#5c5c5c' }]}>Cloud AI</Text>
            <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Search</Text>
          </View>
          <BlurView intensity={78} tint={isDark ? 'dark' : 'light'} style={styles.headerIcon}>
            <TouchableOpacity style={styles.iconHitbox} onPress={() => router.back()} activeOpacity={0.84}>
              <Ionicons name="close" size={21} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
          </BlurView>
        </View>

        <View style={styles.searchWrap}>
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.searchGlass}>
            <Ionicons name="search" size={22} color={isDark ? '#fff' : '#000'} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search photos"
              placeholderTextColor={isDark ? '#8d8d8d' : '#686868'}
              style={[styles.searchInput, { color: isDark ? '#fff' : '#000' }]}
              autoCapitalize="none"
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.84}>
                <Ionicons name="close-circle" size={21} color={isDark ? '#aaa' : '#777'} />
              </TouchableOpacity>
            ) : null}
          </BlurView>
        </View>

        <View style={[styles.promptRow, { paddingBottom: 16 }]}>
          {prompts.map((prompt) => (
            <TouchableOpacity
              key={prompt}
              activeOpacity={0.84}
              onPress={() => {
                Haptics.selectionAsync();
                setQuery(prompt);
              }}
            >
              <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={styles.promptChip}>
                <Text style={[styles.promptText, { color: isDark ? '#fff' : '#000' }]}>{prompt}</Text>
              </BlurView>
            </TouchableOpacity>
          ))}
        </View>

        {results.length === 0 ? (
          <View style={styles.emptyContainer}>
            <BlurView intensity={74} tint={isDark ? 'dark' : 'light'} style={styles.emptyGlass}>
              <Ionicons name="sparkles-outline" size={34} color={isDark ? '#fff' : '#000'} />
              <Text style={[styles.emptyTitle, { color: isDark ? '#fff' : '#000' }]}>No matches</Text>
            </BlurView>
          </View>
        ) : (
          <FlashList
            data={results}
            numColumns={3}
            estimatedItemSize={120}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: photo, index }) => {
              const imageUri = photo.uri || `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=thumbnail${token ? `&token=${token}` : ''}`;
              return (
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => {
                    if (!photo.isUploadingObject) {
                      Haptics.selectionAsync();
                      usePhotoStore.getState().setViewingPhotos(results.filter(p => !p.isUploadingObject));
                      router.push({
                        pathname: '/photo/[id]',
                        params: { id: photo._id, initialIndex: index, mode: 'custom' },
                      });
                    }
                  }}
                  style={[styles.resultTile, { backgroundColor: isDark ? '#161616' : '#e8e8e8', height: 120, margin: 2 }]}
                >
                  <AnimatedImage
                    sharedTransitionTag={photo._id}
                    source={imageUri}
                    placeholder={photo.blurhash || DEFAULT_BLURHASH}
                    contentFit="cover"
                    transition={220}
                    cachePolicy="disk"
                    style={styles.resultImage}
                  />
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
            }}
          />
        )}
      </View>
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
    paddingBottom: 14,
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
  searchWrap: {
    paddingHorizontal: 18,
  },
  searchGlass: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 27,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    height: 56,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  promptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  promptChip: {
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  promptText: {
    fontSize: 13,
    fontWeight: '900',
  },
  resultTile: {
    overflow: 'hidden',
    borderRadius: 4,
    margin: 1,
  },
  resultImage: {
    height: '100%',
    width: '100%',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 44,
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
});
