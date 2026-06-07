import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, useColorScheme } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';

export const SplashOverlay = ({ onComplete }: { onComplete: () => void }) => {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(10);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for the grid behind this to mount
    setTimeout(() => {
      setIsReady(true);
      SplashScreen.hideAsync().catch(() => {});
      
      // Start Animation Sequence
      logoOpacity.value = withTiming(1, { duration: 400 });
      logoScale.value = withSpring(1, { damping: 16, stiffness: 200, mass: 1 });
      
      textOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
      textTranslateY.value = withDelay(300, withSpring(0, { damping: 14, stiffness: 200 }));
      
      // End animation after 1.5s
      setTimeout(() => {
        onComplete();
      }, 1500);
    }, 100);
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return (
    <Animated.View exiting={FadeOut.duration(400)} style={[styles.container, { backgroundColor: isDark ? '#050505' : '#ffffff' }]}>
      <Animated.View style={[styles.content, logoAnimatedStyle]}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={styles.logo}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
        <Animated.Text style={[styles.title, { color: isDark ? '#ffffff' : '#000000' }, textAnimatedStyle]}>
          CloudGallery
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
