// @ts-nocheck
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Share,
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
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';

import api from '../../../src/services/api';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { usePhotoStore } from '../../../src/store/usePhotoStore';

const COLUMN_COUNT = 3;
const GRID_GAP = 1.5;
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

export default function UserAlbumScreen() {
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuthStore();
  const itemSize = (width - GRID_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

  const [album, setAlbum] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareLink, setShareLink] = useState('');

  const bg = isDark ? '#050505' : '#f2f2f7';
  const textPrimary = isDark ? '#fff' : '#000';
  const textSecondary = isDark ? '#8e8e93' : '#6c6c70';

  const fetchAlbum = useCallback(async () => {
    try {
      const { data } = await api.get(`/albums/${id}/photos`);
      setAlbum(data.album);
      setPhotos(data.photos || []);
      if (data.album.shareToken && data.album.isPublic) {
        setShareLink(`${api.defaults.baseURL.replace('/api', '')}/shared-album/${data.album.shareToken}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not load album.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAlbum(); }, [fetchAlbum]);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let link = shareLink;
    if (!link) {
      try {
        const { data } = await api.post(`/albums/${id}/share-link`);
        link = `${api.defaults.baseURL.replace('/api', '')}/shared-album/${data.shareToken}`;
        setShareLink(link);
        fetchAlbum();
      } catch {
        Alert.alert('Error', 'Failed to generate share link.');
        return;
      }
    }
    Alert.alert(
      `Share "${album?.name}"`,
      'Anyone with the link can view this album.',
      [
        {
          text: 'Copy Link', onPress: async () => {
            await Clipboard.setStringAsync(link);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
        {
          text: 'Share', onPress: () => Share.share({ message: link, title: album?.name })
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Group into rows of 3
  const rows: any[][] = [];
  for (let i = 0; i < photos.length; i += COLUMN_COUNT) {
    rows.push(photos.slice(i, i + COLUMN_COUNT));
  }

  const renderRow = ({ item }: { item: any[] }) => (
    <View style={styles.row}>
      {item.map((photo: any) => {
        const uri = photo.telegramFileId
          ? `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=thumbnail${token ? `&token=${token}` : ''}`
          : photo.uri || '';
        return (
          <TouchableOpacity
            key={photo._id}
            activeOpacity={0.86}
            onPress={() => {
              Haptics.selectionAsync();
              const idx = photos.findIndex((p) => p._id === photo._id);
              usePhotoStore.getState().setViewingPhotos(photos);
              router.push({ pathname: '/photo/[id]', params: { id: photo._id, initialIndex: idx, mode: 'custom' } });
            }}
            style={[styles.tile, { width: itemSize, height: itemSize, backgroundColor: isDark ? '#1a1a1a' : '#e2e2e2' }]}
          >
            <Image
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
          <Text style={[styles.headerTitle, { color: textPrimary }]} numberOfLines={1}>{album?.name ?? '…'}</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>{photos.length} photos</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => router.push(`/album/manage/${id}`)} style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="people-outline" size={20} color={textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name={shareLink ? 'link' : 'share-outline'} size={20} color={shareLink ? '#007AFF' : textPrimary} />
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* Share link indicator */}
      {shareLink ? (
        <TouchableOpacity
          onPress={handleShare}
          style={[styles.shareBanner, { top: insets.top + 88, backgroundColor: '#007AFF' }]}
          activeOpacity={0.8}
        >
          <Ionicons name="link-outline" size={13} color="#fff" />
          <Text style={styles.shareBannerText}>Shared • Tap to manage link</Text>
        </TouchableOpacity>
      ) : null}

      {/* Grid */}
      {photos.length === 0 && !loading ? (
        <Animated.View entering={FadeInDown.duration(350)} style={[styles.empty, { paddingTop: insets.top + 120 }]}>
          <Ionicons name="images-outline" size={52} color={textSecondary} />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>No photos yet</Text>
          <Text style={[styles.emptyBody, { color: textSecondary }]}>Add photos from your gallery using multi-select.</Text>
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
            paddingTop: insets.top + (shareLink ? 136 : 88),
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 80, paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, width: 80, justifyContent: 'flex-end', paddingRight: 8 },
  iconBtn: { padding: 4 },
  shareBanner: {
    position: 'absolute', left: 0, right: 0, zIndex: 99,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 7,
  },
  shareBannerText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
  tile: { overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
