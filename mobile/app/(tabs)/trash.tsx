// @ts-nocheck
import React, { memo, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { usePhotoStore } from '../../src/store/usePhotoStore';
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';

const AnimatedImage = Animated.createAnimatedComponent(Image) as any;
const COLUMN_COUNT = 3;
const GRID_GAP = 1.5;
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

type TrashPhoto = {
  _id: string;
  fileName?: string;
  blurhash?: string;
};

export default function TrashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const itemSize = (width - GRID_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
  const { isGuest, token } = useAuthStore();
  const { trashPhotos, loading, fetchTrashPhotos } = usePhotoStore();

  useFocusEffect(
    useCallback(() => {
      fetchTrashPhotos(isGuest);
    }, [fetchTrashPhotos, isGuest])
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#050505' : '#f7f7f7' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <View>
          <Text style={[styles.kicker, { color: isDark ? '#bdbdbd' : '#5c5c5c' }]}>Library</Text>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Bin</Text>
        </View>
        <BlurView intensity={78} tint={isDark ? 'dark' : 'light'} style={styles.headerIcon}>
          <TouchableOpacity style={styles.iconHitbox} onPress={() => router.back()} activeOpacity={0.84}>
            <Ionicons name="close" size={21} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        </BlurView>
      </View>

      <View style={styles.noticeWrap}>
        <BlurView intensity={72} tint={isDark ? 'dark' : 'light'} style={styles.notice}>
          <Ionicons name="timer-outline" size={20} color={isDark ? '#fff' : '#000'} />
          <Text style={[styles.noticeText, { color: isDark ? '#d8d8d8' : '#333' }]}>
            Photos stay here for 30 days.
          </Text>
        </BlurView>
      </View>

      {isGuest ? (
        <EmptyState isDark={isDark} title="Cloud account required" body="Bin is available after login." />
      ) : loading && trashPhotos.length === 0 ? (
        <View style={{ paddingHorizontal: 0, flexDirection: 'row', flexWrap: 'wrap' }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton 
              key={i} 
              width={itemSize} 
              height={itemSize} 
              borderRadius={0} 
              style={{ marginBottom: GRID_GAP, marginRight: i % COLUMN_COUNT === COLUMN_COUNT - 1 ? 0 : GRID_GAP }} 
            />
          ))}
        </View>
      ) : (
        <FlashList
          data={trashPhotos}
          keyExtractor={(item: TrashPhoto) => item._id}
          numColumns={COLUMN_COUNT}
          renderItem={({ item, index }: { item: TrashPhoto; index: number }) => (
            <TrashTile photo={item} index={index} photos={trashPhotos} token={token} itemSize={itemSize} isDark={isDark} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 124 }}
          ListEmptyComponent={<EmptyState isDark={isDark} title="Bin is empty" body="Deleted cloud photos will appear here." />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const TrashTile = memo(
  ({
    photo,
    index,
    photos,
    token,
    itemSize,
    isDark,
  }: {
    photo: TrashPhoto;
    index: number;
    photos: TrashPhoto[];
    token?: string | null;
    itemSize: number;
    isDark: boolean;
  }) => {
    const router = useRouter();
    const tileRef = useRef<any>(null);
    const imageUri = `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=thumbnail${token ? `&token=${token}` : ''}`;

    const openPhoto = () => {
      Haptics.selectionAsync();
      const flatIndex = Math.max(0, photos.findIndex((item) => item._id === photo._id));

      router.push({
        pathname: '/photo/[id]',
        params: {
          id: photo._id,
          initialIndex: flatIndex,
          mode: 'trash',
        },
      });
    };

    return (
      <TouchableOpacity
        ref={tileRef}
        activeOpacity={0.86}
        onPress={openPhoto}
        style={[
          styles.photoContainer,
          {
            width: itemSize,
            height: itemSize,
            marginRight: index % COLUMN_COUNT === COLUMN_COUNT - 1 ? 0 : GRID_GAP,
            backgroundColor: isDark ? '#161616' : '#e8e8e8',
          },
        ]}
      >
        <AnimatedImage
          sharedTransitionTag={photo._id}
          source={imageUri}
          placeholder={photo.blurhash || DEFAULT_BLURHASH}
          contentFit="cover"
          transition={220}
          style={styles.image}
          cachePolicy="disk"
        />
        <BlurView intensity={68} tint="dark" style={styles.binBadge}>
          <Ionicons name="trash-outline" size={12} color="#fff" />
        </BlurView>
      </TouchableOpacity>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
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
  noticeWrap: {
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  notice: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  noticeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  loader: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  photoContainer: {
    marginBottom: GRID_GAP,
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  binBadge: {
    alignItems: 'center',
    borderRadius: 14,
    bottom: 7,
    height: 28,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    right: 7,
    width: 28,
  },
});
