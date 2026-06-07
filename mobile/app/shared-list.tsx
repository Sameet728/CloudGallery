import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
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
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import api from '../src/services/api';
import { useAuthStore } from '../src/store/useAuthStore';

const CARD_GAP = 12;
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

type UserAlbum = {
  _id: string;
  name: string;
  description?: string;
  shareToken?: string;
  isPublic?: boolean;
  createdAt: string;
};

type AlbumWithPhotos = UserAlbum & { photos: any[] };

export default function SharedListScreen() {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const CARD_W = (width - 18 * 2 - CARD_GAP) / 2;
  const { token, isGuest } = useAuthStore();

  const [sharedAlbums, setSharedAlbums] = useState<AlbumWithPhotos[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSharedAlbums = useCallback(async () => {
    try {
      const { data } = await api.get('/albums');
      const sharedWithMe = data.shared || [];
      const myPublicAlbums = (data.owned || []).filter((a: UserAlbum) => a.isPublic);
      
      const allShared = [...myPublicAlbums, ...sharedWithMe];
      
      const sharedWithPhotos = await Promise.all(
        allShared.map(async (album: UserAlbum) => {
          try {
            const { data: detail } = await api.get(`/albums/${album._id}/photos`);
            return { ...album, photos: detail.photos || [] };
          } catch {
            return { ...album, photos: [] };
          }
        })
      );
      setSharedAlbums(sharedWithPhotos);
    } catch (e) {
      console.log('fetchSharedAlbums error:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isGuest) fetchSharedAlbums();
    }, [isGuest, fetchSharedAlbums])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (!isGuest) await fetchSharedAlbums();
    setRefreshing(false);
  }, [isGuest, fetchSharedAlbums]);

  const bg = isDark ? '#050505' : '#f2f2f7';
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const textPrimary = isDark ? '#ffffff' : '#000000';
  const textSecondary = isDark ? '#8e8e93' : '#6c6c70';

  const getUri = (photo: any) =>
    photo.uri || `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=thumbnail${token ? `&token=${token}` : ''}`;

  const CoverMosaic = ({ covers, size }: { covers: any[]; size?: 'full' | 'half' }) => (
    <View style={size === 'full' ? styles.mosaicFull : styles.mosaicHalf}>
      {[0, 1, 2, 3].map((i) => {
        const photo = covers[i];
        return photo ? (
          <Image
            key={photo._id}
            source={getUri(photo)}
            placeholder={photo.blurhash || DEFAULT_BLURHASH}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
            style={size === 'full' ? styles.mosaicCellFull : styles.mosaicCellHalf}
          />
        ) : (
          <View key={`e-${i}`} style={[size === 'full' ? styles.mosaicCellFull : styles.mosaicCellHalf, { backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea' }]} />
        );
      })}
    </View>
  );

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
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Shared Albums</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>{sharedAlbums.length} spaces</Text>
        </View>
        <View style={{ width: 80 }} />
      </BlurView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingTop: insets.top + 88, paddingHorizontal: 18 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textSecondary} />}
      >
        {sharedAlbums.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(350)} style={[styles.empty, { paddingTop: 60 }]}>
            <Ionicons name="people-outline" size={52} color={textSecondary} />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>No shared albums</Text>
            <Text style={[styles.emptyBody, { color: textSecondary }]}>Albums that others invite you to will appear here.</Text>
          </Animated.View>
        ) : (
          <View style={styles.grid}>
            {sharedAlbums.map((album, i) => (
              <Animated.View key={album._id} entering={FadeInDown.duration(300).delay(i * 50)}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={[styles.albumCard, { width: CARD_W, backgroundColor: cardBg }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(`/album/user/${album._id}`);
                  }}
                >
                  <CoverMosaic covers={album.photos.slice(0, 4)} size="half" />
                  <View style={styles.albumMeta}>
                    <Text style={[styles.albumTitle, { color: textPrimary }]} numberOfLines={1}>{album.name}</Text>
                    <Text style={[styles.albumSubtitle, { color: textSecondary }]}>{album.photos.length} photos</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 80, paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP, marginTop: 16 },
  albumCard: { borderRadius: 16, overflow: 'hidden' },
  albumMeta: { padding: 12, paddingBottom: 14 },
  albumTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  albumSubtitle: { fontSize: 12, fontWeight: '500' },
  
  mosaicHalf: { width: '100%', aspectRatio: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 },
  mosaicCellHalf: { width: '49.2%', height: '49.2%', borderRadius: 4 },
  
  mosaicFull: { width: '100%', aspectRatio: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 },
  mosaicCellFull: { width: '24.5%', height: '100%', borderRadius: 6 },
  
  empty: { flex: 1, alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
});
