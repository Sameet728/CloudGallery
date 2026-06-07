// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
  FadeIn,
  FadeOut
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { usePhotoStore } from '../src/store/usePhotoStore';
import api from '../src/services/api';
import { useAuthStore } from '../src/store/useAuthStore';

const { width, height } = Dimensions.get('window');
const SLIDE_DURATION = 3500;
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

export default function SlideshowScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  
  const { viewingPhotos: photos } = usePhotoStore();
  const { token } = useAuthStore();
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const progressAnim = useSharedValue(0);

  useEffect(() => {
    if (photos.length === 0) {
      router.back();
    }
  }, [photos]);

  useEffect(() => {
    progressAnim.value = 0;
    if (!isPaused) {
      progressAnim.value = withTiming(1, { duration: SLIDE_DURATION, easing: Easing.linear });
    }
  }, [activeIndex, isPaused]);

  useEffect(() => {
    if (isPaused) return;
    
    const timer = setTimeout(() => {
      if (activeIndex < photos.length - 1) {
        setActiveIndex(prev => prev + 1);
      } else {
        router.back();
      }
    }, SLIDE_DURATION);

    // Prefetch next two photos
    const nextIndices = [activeIndex + 1, activeIndex + 2].filter(i => i < photos.length);
    const urlsToPrefetch = nextIndices.map(i => getPhotoUri(photos[i])).filter(uri => !uri.startsWith('file://'));
    if (urlsToPrefetch.length > 0) {
      Image.prefetch(urlsToPrefetch);
    }
    
    return () => clearTimeout(timer);
  }, [activeIndex, isPaused, photos.length]);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeIndex < photos.length - 1) {
      setActiveIndex(prev => prev + 1);
    } else {
      router.back();
    }
  };

  const handlePrev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
    }
  };

  const panY = useSharedValue(0);
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) {
        panY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        runOnJS(router.back)();
      } else {
        panY.value = withSpring(0);
      }
    });

  const panStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panY.value }],
    opacity: Math.max(0.4, 1 - panY.value / 400),
  }));

  const getPhotoUri = (photo: any) => photo.uri || `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=medium${token ? `&token=${token}` : ''}`;

  if (photos.length === 0) return null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, panStyle, { backgroundColor: isDark ? '#000' : '#111' }]}>
        <StatusBar style="light" hidden />
        
        {/* Photos Layer (Crossfade handled by Expo Image's built-in transition) */}
        <Image
          source={getPhotoUri(photos[activeIndex])}
          placeholder={photos[activeIndex].blurhash || DEFAULT_BLURHASH}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={500}
          style={styles.image}
        />

        {/* Top Gradient for visibility */}
        <BlurView intensity={20} tint="dark" style={[styles.topGradient, { height: insets.top + 50 }]} />

        {/* Progress Bars */}
        <View style={[styles.progressContainer, { top: insets.top + 10 }]}>
          {photos.map((_, index) => {
            return (
              <View key={index} style={styles.progressBarBg}>
                {index === activeIndex ? (
                  <AnimatedProgressBar progress={progressAnim} />
                ) : (
                  <View style={[styles.progressBarFill, { width: index < activeIndex ? '100%' : '0%' }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Close Button */}
        <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 30 }]} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Tap Zones */}
        <View style={styles.tapZones}>
          <TouchableOpacity 
            style={styles.leftZone} 
            onPress={handlePrev} 
            onPressIn={() => setIsPaused(true)} 
            onPressOut={() => setIsPaused(false)} 
            activeOpacity={1}
          />
          <TouchableOpacity 
            style={styles.rightZone} 
            onPress={handleNext} 
            onPressIn={() => setIsPaused(true)} 
            onPressOut={() => setIsPaused(false)} 
            activeOpacity={1}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const AnimatedProgressBar = ({ progress }: { progress: Animated.SharedValue<number> }) => {
  const style = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  return <Animated.View style={[styles.progressBarFill, style]} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  progressContainer: {
    position: 'absolute',
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 4,
    zIndex: 2,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 3,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapZones: {
    position: 'absolute',
    top: 100,
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    zIndex: 2,
  },
  leftZone: {
    flex: 0.3,
  },
  rightZone: {
    flex: 0.7,
  },
});
