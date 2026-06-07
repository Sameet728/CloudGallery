// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { usePhotoStore } from '../../src/store/usePhotoStore';

const AnimatedImage = Animated.createAnimatedComponent(Image) as any;

const COLUMN_COUNT = 3;
const GRID_GAP = 1.5;
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

export default function SharedAlbumScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const itemSize = (width - GRID_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

  const [album, setAlbum] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const bg = isDark ? '#050505' : '#f2f2f7';
  const textPrimary = isDark ? '#fff' : '#000';
  const textSecondary = isDark ? '#8e8e93' : '#6c6c70';

  const fetchAlbum = useCallback(async () => {
    try {
      const { data } = await api.get(`/albums/public/${token}`);
      setAlbum(data.album);
      setPhotos(data.photos || []);
    } catch (e) {
      Alert.alert('Error', 'Album not found or link has been revoked.', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => { fetchAlbum(); }, [fetchAlbum]);

  // Group into rows of 3
  const rows: any[][] = [];
  for (let i = 0; i < photos.length; i += COLUMN_COUNT) {
    rows.push(photos.slice(i, i + COLUMN_COUNT));
  }

  const renderRow = ({ item }: { item: any[] }) => (
    <View style={styles.row}>
      {item.map((photo: any) => {
        // Shared album photos are completely public and accessible via their URL endpoint without auth
        const uri = `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=thumbnail`;
        return (
          <TouchableOpacity
            key={photo._id}
            activeOpacity={0.86}
            onPress={() => {
              Haptics.selectionAsync();
              router.push({ pathname: '/photo/[id]', params: { id: photo._id, initialIndex: 0, mode: 'gallery' } });
            }}
            style={[styles.tile, { width: itemSize, height: itemSize, backgroundColor: isDark ? '#1a1a1a' : '#e2e2e2' }]}
          >
            <AnimatedImage
              sharedTransitionTag={photo._id}
              source={uri}
              placeholder={photo.blurhash || DEFAULT_BLURHASH}
              contentFit="cover"
              transition={200}
              style={StyleSheet.absoluteFill}
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
        );
      })}
      {item.length < COLUMN_COUNT &&
        Array.from({ length: COLUMN_COUNT - item.length }).map((_, i) => (
          <View key={`f-${i}`} style={{ width: itemSize, height: itemSize }} />
        ))}
    </View>
  );

  if (loading) return null;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />

      {/* Header */}
      <BlurView intensity={82} tint={isDark ? 'dark' : 'light'} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: textPrimary }]} numberOfLines={1}>{album?.name ?? 'Shared Album'}</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>{photos.length} photos</Text>
        </View>
        <View style={{ width: 80, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 4 }}>
          {photos.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                usePhotoStore.getState().setViewingPhotos(photos);
                router.push('/slideshow');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="play-circle-outline" size={26} color={textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </BlurView>

      {/* Banner */}
      <View style={[styles.banner, { top: insets.top + 88, backgroundColor: isDark ? '#1c1c1e' : '#e5e5ea' }]}>
        <Ionicons name="globe-outline" size={14} color={textSecondary} />
        <Text style={[styles.bannerText, { color: textSecondary }]}>Publicly Shared Album</Text>
      </View>

      {/* Grid */}
      {photos.length === 0 && !loading ? (
        <Animated.View entering={FadeInDown.duration(350)} style={[styles.empty, { paddingTop: insets.top + 140 }]}>
          <Ionicons name="images-outline" size={52} color={textSecondary} />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Album is empty</Text>
        </Animated.View>
      ) : (
        <FlashList
          data={rows}
          renderItem={renderRow}
          estimatedItemSize={itemSize + GRID_GAP}
          overrideItemLayout={(layout, item) => { layout.size = itemSize + GRID_GAP; }}
          showsVerticalScrollIndicator={false}
          drawDistance={height * 1.5}
          contentContainerStyle={{
            paddingTop: insets.top + 136,
            paddingBottom: insets.bottom + 120,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 10, paddingBottom: 12, gap: 8,
  },
  backBtn: { alignItems: 'flex-start', width: 80, paddingVertical: 4, paddingLeft: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  banner: {
    position: 'absolute', left: 0, right: 0, zIndex: 99,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8,
  },
  bannerText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
  tile: { overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
});
