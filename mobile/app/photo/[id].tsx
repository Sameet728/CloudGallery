// @ts-nocheck
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { usePhotoStore } from '../../src/store/usePhotoStore';

const { width, height } = Dimensions.get('window');
const AnimatedImage = Animated.createAnimatedComponent(Image) as any;
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

const clampToBounds = (value: number, scale: number, size: number) => {
  'worklet';
  const maxOffset = Math.max(0, (size * (scale - 1)) / 2);
  return clamp(value, -maxOffset, maxOffset);
};

const numberParam = (value: string | string[] | undefined) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : undefined;
};

type PhotoRecord = {
  _id: string;
  uri?: string;
  fileName?: string;
  blurhash?: string;
  favorite?: boolean;
  uploadDate?: string;
  creationTime?: number;
  tags?: string[];
  ocrText?: string;
};

const getPhotoUri = (photo: PhotoRecord, token?: string | null, resolution: string = 'medium') => {
  return photo.uri || `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=${resolution}${token ? `&token=${token}` : ''}`;
};

export default function PhotoViewerScreen() {
  const params = useLocalSearchParams();
  const { initialIndex, mode } = params;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, isGuest } = useAuthStore();
  const { photos, trashPhotos, viewingPhotos, deletePhoto, toggleFavorite, restorePhoto, permanentDeletePhoto } = usePhotoStore();
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const bottomSheetRef = useRef<BottomSheet>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const activePhotos: PhotoRecord[] = 
    mode === 'trash' ? trashPhotos : 
    mode === 'custom' ? viewingPhotos : 
    photos;
  const initialScrollIndex = numberParam(initialIndex) ?? 0;
  const [activeIndex, setActiveIndex] = useState(initialScrollIndex);

  const dragTranslateX = useSharedValue(0);
  const dragTranslateY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const backgroundOpacity = useSharedValue(1);
  const controlsOpacity = useSharedValue(1);
  const resetHideTimer = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      controlsOpacity.value = withTiming(0, { duration: 300 });
    }, 2600);
  };

  useEffect(() => {
    dragTranslateX.value = 0;
    dragTranslateY.value = 0;
    dragScale.value = 1;
    backgroundOpacity.value = withTiming(1, { duration: 180 });
    
    // Predictive Preloading
    if (activePhotos.length > 0) {
      const preloadIndices = [
        Math.min(initialScrollIndex + 1, activePhotos.length - 1),
        Math.min(initialScrollIndex + 2, activePhotos.length - 1),
        Math.max(initialScrollIndex - 1, 0)
      ];
      const urlsToPrefetch = preloadIndices.map(i => getPhotoUri(activePhotos[i], token, 'medium')).filter(uri => !uri.startsWith('file://'));
      if (urlsToPrefetch.length > 0) {
        Image.prefetch(urlsToPrefetch);
      }
    }

    resetHideTimer();

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [activeIndex]);

  const closeViewer = () => {
    if (isClosing) return;
    setIsClosing(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);

    controlsOpacity.value = withTiming(0, { duration: 120 });
    backgroundOpacity.value = withTiming(0, { duration: 260 });
    router.back();
  };

  const toggleControls = () => {
    if (controlsOpacity.value === 0) {
      controlsOpacity.value = withTiming(1, { duration: 180 });
      resetHideTimer();
    } else {
      controlsOpacity.value = withTiming(0, { duration: 180 });
      if (hideTimer.current) clearTimeout(hideTimer.current);
    }
  };

  const handleShare = async () => {
    const photo = activePhotos[activeIndex];
    if (!photo) return;

    setIsSharing(true);
    const isCloud = !photo.uri;
    const uri = getPhotoUri(photo, token);

    try {
      let localUri = uri;
      if (isCloud) {
        const fileUri = `${FileSystem.cacheDirectory}cloudgallery_${Date.now()}.jpg`;
        const { uri: downloadedUri } = await FileSystem.downloadAsync(uri, fileUri);
        localUri = downloadedUri;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleFavorite = async () => {
    const photo = activePhotos[activeIndex];
    if (!photo) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await toggleFavorite(photo._id);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = () => {
    const photo = activePhotos[activeIndex];
    if (!photo) return;
    Alert.alert(
      'Move to Bin?',
      'You can restore this photo from Recently Deleted within 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Bin', style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await deletePhoto(photo._id, isGuest);
              router.back();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error(error);
            }
          }
        }
      ]
    );
  };

  const handleRestore = async () => {
    const photo = activePhotos[activeIndex];
    if (!photo) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await restorePhoto(photo._id);
      router.back();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePermanentDelete = () => {
    const photo = activePhotos[activeIndex];
    if (!photo) return;
    Alert.alert(
      'Delete permanently?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await permanentDeletePhoto(photo._id);
              router.back();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error(error);
            }
          }
        }
      ]
    );
  };

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index || 0;
      setActiveIndex(index);
      Haptics.selectionAsync();

      // Predictive Preloading
      const preloadIndices = [
        Math.min(index + 1, activePhotos.length - 1),
        Math.min(index + 2, activePhotos.length - 1),
        Math.max(index - 1, 0)
      ];
      const urlsToPrefetch = preloadIndices.map(i => getPhotoUri(activePhotos[i], token, 'medium')).filter(uri => !uri.startsWith('file://'));
      if (urlsToPrefetch.length > 0) {
        Image.prefetch(urlsToPrefetch);
      }
    }
  }).current;

  const expandSheet = () => {
    bottomSheetRef.current?.expand();
  };

  const currentPhoto = activePhotos[activeIndex];
  const isFavorite = Boolean(currentPhoto?.favorite);

  if (!currentPhoto) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        <View style={styles.emptyViewer}>
          <Text style={styles.emptyViewerText}>Photo not found</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.back()} activeOpacity={0.84}>
            <Text style={styles.emptyButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={controlsOpacity.value === 0} animation="fade" />
      <Animated.View style={[StyleSheet.absoluteFill, styles.background, backgroundAnimatedStyle]} />

      <FlatList
        data={activePhotos}
        keyExtractor={(item: PhotoRecord) => item._id}
        renderItem={({ item, index }: { item: PhotoRecord; index: number }) => (
          <PhotoItem
            item={item}
            index={index}
            activeIndex={activeIndex}
            token={token}
            controlsOpacity={controlsOpacity}
            dragTranslateX={dragTranslateX}
            dragTranslateY={dragTranslateY}
            dragScale={dragScale}
            backgroundOpacity={backgroundOpacity}
            expandSheet={expandSheet}
            closeViewer={closeViewer}
            toggleControls={toggleControls}
          />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialScrollIndex}
        getItemLayout={(_: unknown, index: number) => ({ length: width, offset: width * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 58 }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        removeClippedSubviews={true}
      />

      <Animated.View style={[styles.topBar, { paddingTop: insets.top + 10 }, controlsAnimatedStyle]} pointerEvents="box-none">
        <BlurView intensity={78} tint="dark" style={styles.topGlassButton}>
          <TouchableOpacity style={styles.iconHitbox} onPress={closeViewer} activeOpacity={0.84}>
            <Ionicons name="chevron-down" size={26} color="#fff" />
          </TouchableOpacity>
        </BlurView>
        <BlurView intensity={78} tint="dark" style={styles.titleGlass}>
          <Text style={styles.viewerTitle} numberOfLines={1}>
            {currentPhoto.fileName || 'Cloud photo'}
          </Text>
        </BlurView>
        <BlurView intensity={78} tint="dark" style={styles.topGlassButton}>
          <TouchableOpacity style={styles.iconHitbox} onPress={expandSheet} activeOpacity={0.84}>
            <Ionicons name="ellipsis-horizontal" size={25} color="#fff" />
          </TouchableOpacity>
        </BlurView>
      </Animated.View>

      <Animated.View style={[styles.bottomBarWrapper, { paddingBottom: Math.max(insets.bottom + 12, 28) }, controlsAnimatedStyle]}>
        <BlurView intensity={84} tint="dark" style={styles.bottomBar}>
          {mode === 'trash' ? (
            <>
              <ViewerAction icon="refresh-outline" label="Restore" onPress={handleRestore} />
              <ViewerAction icon="trash-outline" label="Delete" onPress={handlePermanentDelete} />
            </>
          ) : (
            <>
              <ViewerAction 
                icon={isSharing ? "hourglass-outline" : "share-outline"} 
                label={isSharing ? "Wait..." : "Share"} 
                onPress={handleShare} 
                disabled={isSharing} 
              />
              {!isGuest ? (
                <ViewerAction icon={isFavorite ? 'heart' : 'heart-outline'} label="Love" onPress={handleFavorite} />
              ) : null}
              <ViewerAction icon="information-circle-outline" label="Info" onPress={expandSheet} />
              <ViewerAction icon="trash-outline" label="Bin" onPress={handleDelete} />
            </>
          )}
        </BlurView>
      </Animated.View>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['46%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: isDark ? '#101010' : '#fbfbfb' }}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#555' : '#c8c8c8' }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={[styles.sheetTitle, { color: isDark ? '#fff' : '#000' }]}>Details</Text>
          <InfoRow icon="document-text-outline" label={currentPhoto.fileName || 'Unknown file'} isDark={isDark} />
          <InfoRow icon={currentPhoto.uri ? 'phone-portrait-outline' : 'cloud-outline'} label={currentPhoto.uri ? 'Local library' : 'CloudGallery'} isDark={isDark} />
          
          {currentPhoto.tags && currentPhoto.tags.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.sheetSubtitle, { color: isDark ? '#ccc' : '#555' }]}>AI Tags</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {currentPhoto.tags.map((tag: string) => (
                  <View key={tag} style={[styles.tagChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#fff' : '#000' }}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {currentPhoto.ocrText ? (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.sheetSubtitle, { color: isDark ? '#ccc' : '#555' }]}>Extracted Text</Text>
              <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => {
                  Haptics.selectionAsync();
                  Clipboard.setStringAsync(currentPhoto.ocrText || '');
                  Alert.alert('Copied', 'Text copied to clipboard');
                }}
                style={[styles.ocrContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              >
                <Text style={{ color: isDark ? '#ddd' : '#444', fontSize: 13, lineHeight: 18 }} numberOfLines={4}>
                  {currentPhoto.ocrText}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
                  <Ionicons name="copy-outline" size={14} color={isDark ? '#aaa' : '#666'} />
                  <Text style={{ fontSize: 12, color: isDark ? '#aaa' : '#666', fontWeight: '600' }}>Tap to copy</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const ViewerAction = ({
  icon,
  label,
  onPress,
  disabled
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity style={[styles.viewerAction, disabled && { opacity: 0.5 }]} onPress={onPress} activeOpacity={0.82} disabled={disabled}>
    <Ionicons name={icon} size={25} color="#fff" />
    <Text style={styles.viewerActionText}>{label}</Text>
  </TouchableOpacity>
);

const InfoRow = ({ icon, label, isDark }: { icon: keyof typeof Ionicons.glyphMap; label: string; isDark: boolean }) => (
  <View style={styles.sheetRow}>
    <View style={[styles.sheetIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)' }]}>
      <Ionicons name={icon} size={21} color={isDark ? '#fff' : '#000'} />
    </View>
    <Text style={[styles.sheetText, { color: isDark ? '#d8d8d8' : '#333' }]} numberOfLines={2}>
      {label}
    </Text>
  </View>
);

const PhotoItem = memo(
  ({
    item,
    index,
    activeIndex,
    token,
    controlsOpacity,
    dragTranslateX,
    dragTranslateY,
    dragScale,
    backgroundOpacity,
    expandSheet,
    closeViewer,
    toggleControls,
  }: any) => {
    const isActive = index === activeIndex;
    const [hasZoomed, setHasZoomed] = useState(false);
    const [wantsOriginal, setWantsOriginal] = useState(false);
    const [loadingPhase, setLoadingPhase] = useState<'init' | 'medium' | 'original' | 'done'>('init');
    
    // Auto-fetch original shortly after landing on photo
    useEffect(() => {
      let timer: NodeJS.Timeout;
      if (isActive) {
        timer = setTimeout(() => setWantsOriginal(true), 400);
      } else {
        setWantsOriginal(false);
        setHasZoomed(false);
        setLoadingPhase('init');
      }
      return () => clearTimeout(timer);
    }, [isActive]);

    // Progressive Loading
    const useOriginal = wantsOriginal || hasZoomed;
    const imageUri = getPhotoUri(item, token, useOriginal ? 'original' : 'medium');

    const localScale = useSharedValue(1);
    const imageTranslateX = useSharedValue(0);
    const imageTranslateY = useSharedValue(0);
    const pinchStartScale = useSharedValue(1);
    const pinchStartX = useSharedValue(0);
    const pinchStartY = useSharedValue(0);
    const pinchOriginX = useSharedValue(0);
    const pinchOriginY = useSharedValue(0);
    const panStartX = useSharedValue(0);
    const panStartY = useSharedValue(0);

    useEffect(() => {
      if (!isActive) {
        localScale.value = 1;
        imageTranslateX.value = 0;
        imageTranslateY.value = 0;
      }
    }, [isActive, imageTranslateX, imageTranslateY, localScale]);

    const resetZoom = () => {
      'worklet';
      localScale.value = withSpring(1, { damping: 28, stiffness: 300, mass: 0.9 });
      imageTranslateX.value = withSpring(0, { damping: 28, stiffness: 300, mass: 0.9 });
      imageTranslateY.value = withSpring(0, { damping: 28, stiffness: 300, mass: 0.9 });
    };

    const pinchGesture = Gesture.Pinch()
      .onBegin((event) => {
        pinchStartScale.value = localScale.value;
        pinchStartX.value = imageTranslateX.value;
        pinchStartY.value = imageTranslateY.value;
        pinchOriginX.value = event.focalX - width / 2;
        pinchOriginY.value = event.focalY - height / 2;
      })
      .onUpdate((event) => {
        const nextScale = clamp(pinchStartScale.value * event.scale, 1, 5);
        const scaleFactor = nextScale / Math.max(1, pinchStartScale.value);
        const nextX = pinchOriginX.value - scaleFactor * (pinchOriginX.value - pinchStartX.value);
        const nextY = pinchOriginY.value - scaleFactor * (pinchOriginY.value - pinchStartY.value);

        localScale.value = nextScale;
        imageTranslateX.value = clampToBounds(nextX, nextScale, width);
        imageTranslateY.value = clampToBounds(nextY, nextScale, height);
        controlsOpacity.value = withTiming(0, { duration: 100 });
        if (nextScale > 1.2 && !hasZoomed) {
          runOnJS(setHasZoomed)(true);
        }
      })
      .onEnd(() => {
        if (localScale.value <= 1.02) {
          resetZoom();
          return;
        }

        imageTranslateX.value = withSpring(clampToBounds(imageTranslateX.value, localScale.value, width), {
          damping: 28,
          stiffness: 300,
          mass: 0.9,
        });
        imageTranslateY.value = withSpring(clampToBounds(imageTranslateY.value, localScale.value, height), {
          damping: 28,
          stiffness: 300,
          mass: 0.9,
        });
      });

    const verticalPanGesture = Gesture.Pan()
      .activeOffsetY([-10, 10])
      .failOffsetX([-20, 20])
      .onBegin(() => {
        panStartX.value = imageTranslateX.value;
        panStartY.value = imageTranslateY.value;
      })
      .onUpdate((event) => {
        if (localScale.value > 1.01) return;

        if (event.translationY < -72) {
          dragTranslateY.value = withSpring(0, { damping: 28, stiffness: 300, mass: 0.9 });
          runOnJS(expandSheet)();
          return;
        }

        dragTranslateX.value = event.translationX * 0.18;
        dragTranslateY.value = event.translationY;
        const distance = Math.abs(event.translationY);
        dragScale.value = interpolate(distance, [0, height * 0.62], [1, 0.78], Extrapolation.CLAMP);
        backgroundOpacity.value = interpolate(distance, [0, 260], [1, 0.12], Extrapolation.CLAMP);
        controlsOpacity.value = withTiming(0, { duration: 100 });
      })
      .onEnd((event) => {
        if (localScale.value > 1.01) return;

        const shouldClose = event.translationY > 110 || event.velocityY > 720;

        if (shouldClose) {
          runOnJS(closeViewer)();
          return;
        }

        dragTranslateX.value = withSpring(0, { damping: 28, stiffness: 300, mass: 0.9 });
        dragTranslateY.value = withSpring(0, { damping: 28, stiffness: 300, mass: 0.9 });
        dragScale.value = withSpring(1, { damping: 28, stiffness: 300, mass: 0.9 });
        backgroundOpacity.value = withTiming(1, { duration: 180 });
      });

    const zoomPanGesture = Gesture.Pan()
      .minDistance(4)
      .onTouchesDown((e, state) => {
        if (localScale.value <= 1.01) {
          state.fail();
        }
      })
      .onBegin(() => {
        panStartX.value = imageTranslateX.value;
        panStartY.value = imageTranslateY.value;
      })
      .onUpdate((event) => {
        if (localScale.value > 1.01) {
          imageTranslateX.value = clampToBounds(panStartX.value + event.translationX, localScale.value, width);
          imageTranslateY.value = clampToBounds(panStartY.value + event.translationY, localScale.value, height);
          controlsOpacity.value = withTiming(0, { duration: 100 });
        }
      })
      .onEnd(() => {
        if (localScale.value > 1.01) {
          imageTranslateX.value = withSpring(clampToBounds(imageTranslateX.value, localScale.value, width), {
            damping: 22,
            stiffness: 220,
          });
          imageTranslateY.value = withSpring(clampToBounds(imageTranslateY.value, localScale.value, height), {
            damping: 22,
            stiffness: 220,
          });
        }
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event) => {
        if (localScale.value > 1.01) {
          resetZoom();
          return;
        }

        const targetScale = 2.65;
        const originX = event.x - width / 2;
        const originY = event.y - height / 2;

        localScale.value = withSpring(targetScale, { damping: 20, stiffness: 220 });
        imageTranslateX.value = withSpring(clampToBounds(-originX * (targetScale - 1), targetScale, width), {
          damping: 20,
          stiffness: 220,
        });
        imageTranslateY.value = withSpring(clampToBounds(-originY * (targetScale - 1), targetScale, height), {
          damping: 20,
          stiffness: 220,
        });
        controlsOpacity.value = withTiming(0, { duration: 120 });
      });

    const singleTap = Gesture.Tap().onEnd(() => {
      runOnJS(toggleControls)();
    });

    const composedGesture = Gesture.Simultaneous(pinchGesture, Gesture.Exclusive(zoomPanGesture, verticalPanGesture), Gesture.Exclusive(doubleTap, singleTap));

    const imageAnimatedStyle = useAnimatedStyle(() => {
      if (!isActive) return {};

      return {
        transform: [
          { translateX: dragTranslateX.value + imageTranslateX.value },
          { translateY: dragTranslateY.value + imageTranslateY.value },
          { scale: dragScale.value * localScale.value },
        ],
      };
    });

    return (
      <View style={styles.imageContainer}>
        <GestureDetector gesture={composedGesture}>
          <AnimatedImage
            sharedTransitionTag={item._id}
            source={imageUri}
            placeholder={item.blurhash || DEFAULT_BLURHASH}
            contentFit="contain"
            style={[styles.image, imageAnimatedStyle]}
            cachePolicy="memory-disk"
            onLoadStart={() => { 
              if (useOriginal && loadingPhase !== 'init') {
                setLoadingPhase('original');
              } else {
                setLoadingPhase('medium');
              }
            }}
            onLoadEnd={() => setLoadingPhase('done')}
          />
        </GestureDetector>
        
        {loadingPhase === 'medium' && isActive && (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.loadingOverlay}>
            <BlurView intensity={35} tint="dark" style={styles.loadingGlass}>
              <ActivityIndicator color="#fff" size="small" />
            </BlurView>
          </Animated.View>
        )}

        {loadingPhase === 'original' && isActive && (
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.originalLoading}>
            <BlurView intensity={45} tint="dark" style={styles.originalLoadingGlass}>
              <ActivityIndicator color="#fff" size={14} />
            </BlurView>
          </Animated.View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    flex: 1,
  },
  background: {
    backgroundColor: '#000',
  },
  imageContainer: {
    alignItems: 'center',
    height,
    justifyContent: 'center',
    width,
  },
  image: {
    height,
    width,
  },
  loadingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingGlass: {
    padding: 12,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  originalLoading: {
    position: 'absolute',
    bottom: 85,
    right: 16,
    zIndex: 20,
  },
  originalLoadingGlass: {
    padding: 8,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    left: 0,
    paddingHorizontal: 14,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  topGlassButton: {
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    overflow: 'hidden',
    width: 48,
  },
  iconHitbox: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  titleGlass: {
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 14,
  },
  viewerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  bottomBarWrapper: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 14,
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
  bottomBar: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-around',
    minHeight: 74,
    overflow: 'hidden',
    paddingHorizontal: 10,
  },
  viewerAction: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 68,
  },
  viewerActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  sheetTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 18,
  },
  sheetRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 14,
  },
  sheetIcon: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginRight: 14,
    width: 44,
  },
  sheetText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  emptyViewer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyViewerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 18,
  },
  emptyButton: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  sheetSubtitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  ocrContainer: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.2)',
  },
});
