// @ts-nocheck
import React, { useMemo } from 'react';
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

const COLUMN_COUNT = 3;
const GRID_GAP = 1.5;
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

export default function PersonScreen() {
  const { id, name, coverPhotoId } = useLocalSearchParams<{ id: string, name: string, coverPhotoId: string }>();
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuthStore();
  const { photos } = usePhotoStore();
  const { width } = useWindowDimensions();
  const itemSize = (width - GRID_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

  const bg = isDark ? '#050505' : '#f2f2f7';
  const textPrimary = isDark ? '#fff' : '#000';
  const textSecondary = isDark ? '#8e8e93' : '#6c6c70';

  const personPhotos = useMemo(() => {
    return photos.filter(p => p.faceIds?.some((f: any) => f._id === id || f.name === name));
  }, [photos, id, name]);

  const coverImageUri = coverPhotoId 
    ? `${api.defaults.baseURL}/photos/${coverPhotoId}/url?resolution=medium${token ? `&token=${token}` : ''}`
    : personPhotos.length > 0 
      ? `${api.defaults.baseURL}/photos/${personPhotos[0]._id}/url?resolution=medium${token ? `&token=${token}` : ''}`
      : null;

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />

      {/* Header */}
      <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={26} color={textPrimary} />
          <Text style={[styles.backText, { color: textPrimary }]}>People</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>{name}</Text>
          <Text style={[styles.headerSub, { color: textSecondary }]}>{personPhotos.length} photos</Text>
        </View>
        <View style={{ width: 80 }} />
      </BlurView>

      <FlashList
        data={personPhotos}
        numColumns={COLUMN_COUNT}
        estimatedItemSize={itemSize}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 70, paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={() => (
          <View style={styles.profileSection}>
            <Animated.View entering={FadeInDown.duration(400).springify()}>
              <View style={[styles.avatarContainer, { borderColor: isDark ? '#333' : '#ddd' }]}>
                {coverImageUri ? (
                  <Image
                    source={coverImageUri}
                    style={styles.avatarImage}
                    contentFit="cover"
                    transition={300}
                  />
                ) : (
                  <Ionicons name="person" size={50} color={textSecondary} />
                )}
              </View>
              <Text style={[styles.profileName, { color: textPrimary }]}>{name}</Text>
              <Text style={[styles.profileCount, { color: textSecondary }]}>{personPhotos.length} photos</Text>
            </Animated.View>
          </View>
        )}
        renderItem={({ item: photo, index }) => {
          const uri = photo.uri || `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=thumbnail${token ? `&token=${token}` : ''}`;
          return (
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => {
                Haptics.selectionAsync();
                usePhotoStore.getState().setViewingPhotos(personPhotos);
                router.push({
                  pathname: '/photo/[id]',
                  params: { id: photo._id, initialIndex: index, mode: 'custom' },
                });
              }}
              style={[styles.tile, { backgroundColor: isDark ? '#161616' : '#e8e8e8', height: itemSize, margin: GRID_GAP / 2 }]}
            >
              <Image
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
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    paddingLeft: 8,
  },
  backText: {
    fontSize: 16,
    marginLeft: -2,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 3,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileName: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  profileCount: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  tile: {
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  favoriteBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 3,
  },
});
