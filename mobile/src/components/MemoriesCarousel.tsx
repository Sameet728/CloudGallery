import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Memory, generateMemories } from '../utils/memories';
import { usePhotoStore } from '../store/usePhotoStore';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

export const MemoriesCarousel = () => {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const { photos } = usePhotoStore();
  const { token } = useAuthStore();
  const router = useRouter();

  const memories = useMemo(() => generateMemories(photos), [photos]);

  if (memories.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Memories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {memories.map((memory, index) => {
          const imageUri = memory.coverPhoto.uri || `${api.defaults.baseURL}/photos/${memory.coverPhoto._id}/url${token ? `?token=${token}` : ''}`;
          
          return (
            <TouchableOpacity 
              key={`${memory.id}-${index}`} 
              activeOpacity={0.8}
              onPress={() => {
                Haptics.selectionAsync();
                usePhotoStore.getState().setViewingPhotos(memory.photos);
                router.push({
                  pathname: '/slideshow',
                  params: { memoryId: memory.id }
                });
              }}
              style={styles.cardWrapper}
            >
              <View style={[styles.card, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <Image
                  source={imageUri}
                  placeholder={memory.coverPhoto.blurhash || DEFAULT_BLURHASH}
                  contentFit="cover"
                  transition={200}
                  style={styles.image}
                />
                <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={styles.overlay}>
                  <Text style={[styles.memoryTitle, { color: isDark ? '#fff' : '#000' }]} numberOfLines={2}>
                    {memory.title}
                  </Text>
                  <Text style={[styles.memorySubtitle, { color: isDark ? '#ccc' : '#444' }]} numberOfLines={1}>
                    {memory.subtitle}
                  </Text>
                </BlurView>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  cardWrapper: {
    width: 130,
    height: 180,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    paddingTop: 12,
  },
  memoryTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  memorySubtitle: {
    fontSize: 10,
    fontWeight: '600',
  },
});
