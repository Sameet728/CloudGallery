// @ts-nocheck
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
  PanResponder,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { FlashList } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { EmptyState } from '../../src/components/EmptyState';
import { Skeleton } from '../../src/components/Skeleton';
import { colors, radius, spacing, typography } from '../../src/theme/theme';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { usePhotoStore } from '../../src/store/usePhotoStore';
import { useUploadStore } from '../../src/store/useUploadStore';
import { MemoriesCarousel } from '../../src/components/MemoriesCarousel';
import { SplashOverlay } from '../../src/components/SplashOverlay';

const AnimatedImage = Animated.createAnimatedComponent(Image) as any;
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as any;

const GRID_GAP = 1.5;
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

type PhotoItem = {
  _id: string;
  uri?: string;
  fileName?: string;
  creationTime?: number;
  uploadDate?: string;
  favorite?: boolean;
  blurhash?: string;
};

import { generateMemories } from '../../src/utils/memories';

type RowItem =
  | { type: 'header'; title: string; meta: string }
  | { type: 'row'; items: PhotoItem[] };

const getPhotoUri = (photo: PhotoItem, token?: string | null, resolution: string = 'thumbnail') =>
  photo.uri || `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=${resolution}${token ? `&token=${token}` : ''}`;

const formatGroup = (photo: PhotoItem) => {
  const date = new Date(photo.uploadDate || photo.creationTime || Date.now());
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const columnCount = Math.max(3, Math.floor(width / 130)); // Responsive columns for large screens
  const itemSize = (width - GRID_GAP * (columnCount - 1)) / columnCount;
  const { isGuest, token } = useAuthStore();
  const { photos, loading, galleryError, fetchPhotos } = usePhotoStore();
  const { addUploads } = useUploadStore();
  const colorScheme = useColorScheme() ?? 'dark';
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [albumModalVisible, setAlbumModalVisible] = useState(false);
  const [albumName, setAlbumName] = useState('');
  const [showSplashOverlay, setShowSplashOverlay] = useState(true);

  // Header height: safeArea top + 10 padding + 46 title row + 12 gap + 34 chips + 15 bottom padding
  const HEADER_HEIGHT = insets.top + 10 + 46 + 12 + 34 + 15;

  // Scroll-to-hide animation
  const lastScrollY = useSharedValue(0);
  const headerVisible = useSharedValue(1);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      const currentY = event.contentOffset.y;
      const diff = currentY - lastScrollY.value;

      if (currentY < 10) {
        // Always show at top
        headerVisible.value = withTiming(1, { duration: 220 });
      } else if (diff > 6) {
        // Scrolling down — hide
        headerVisible.value = withTiming(0, { duration: 220 });
      } else if (diff < -6) {
        // Scrolling up — show
        headerVisible.value = withTiming(1, { duration: 220 });
      }

      lastScrollY.value = currentY;
    },
  });

  const headerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(headerVisible.value, [0, 1], [-HEADER_HEIGHT, 0]) }],
    opacity: interpolate(headerVisible.value, [0, 0.6, 1], [0, 0.85, 1]),
  }));



  useFocusEffect(
    useCallback(() => {
      fetchPhotos(isGuest);
    }, [fetchPhotos, isGuest])
  );

  const pickImage = async () => {
    if (isSelecting) { cancelSelection(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("You've refused to allow this app to access your photos!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled && result.assets) {
      addUploads(result.assets);
      // Start uploads immediately in the background
      const { startUploads } = useUploadStore.getState();
      startUploads(fetchPhotos, isGuest);
    }
  };

  const enterSelectionMode = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSelecting(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    Haptics.selectionAsync();
  }, []);

  const cancelSelection = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }, []);

  const selectedPhotos = useMemo(() => photos.filter((p) => selectedIds.has(p._id)), [photos, selectedIds]);

  const deleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      `Move ${selectedIds.size} photo${selectedIds.size > 1 ? 's' : ''} to Bin?`,
      'You can restore them from Recently Deleted within 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Bin', style: 'destructive',
          onPress: async () => {
            try {
              // Use PUT /photos/:id/trash — the correct soft-delete endpoint
              await Promise.all([...selectedIds].map((id) => api.put(`/photos/${id}/trash`)));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              cancelSelection();
              fetchPhotos(isGuest);
            } catch (e: any) {
              console.error('Delete error:', e?.response?.data || e);
              Alert.alert('Error', 'Failed to move photos to bin. Please try again.');
            }
          },
        },
      ]
    );
  }, [selectedIds, isGuest, cancelSelection, fetchPhotos]);

  const shareSelected = useCallback(async () => {
    const photo = selectedPhotos[0];
    if (!photo) return;
    try {
      const uri = getPhotoUri(photo, token, 'thumbnail');
      const local = photo.uri ? uri : `${FileSystem.cacheDirectory}share_${photo._id}.jpg`;
      if (!photo.uri) await FileSystem.downloadAsync(uri, local);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(local);
    } catch (e) {
      Alert.alert('Error', 'Could not share photo.');
    }
  }, [selectedPhotos, token]);

  const createAlbumWithSelected = useCallback(async () => {
    const name = albumName.trim();
    if (!name) return;
    try {
      const { data: album } = await api.post('/albums', { name });
      await Promise.all([...selectedIds].map((id) => api.post(`/albums/${album._id}/photos`, { photoId: id })));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAlbumModalVisible(false);
      setAlbumName('');
      cancelSelection();
      Alert.alert('Album created!', `"${name}" contains ${selectedIds.size} photo${selectedIds.size > 1 ? 's' : ''}.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to create album.');
    }
  }, [albumName, selectedIds]);

  const listData = useMemo<RowItem[]>(() => {
    const groups = new Map<string, PhotoItem[]>();
    photos.forEach((photo) => {
      const key = formatGroup(photo);
      const arr = groups.get(key) || [];
      arr.push(photo);
      groups.set(key, arr);
    });
    const flat: RowItem[] = [];
    groups.forEach((sectionPhotos, date) => {
      flat.push({ type: 'header', title: date, meta: `${sectionPhotos.length} ${sectionPhotos.length === 1 ? 'item' : 'items'}` });
      for (let i = 0; i < sectionPhotos.length; i += columnCount) {
        flat.push({ type: 'row', items: sectionPhotos.slice(i, i + columnCount) });
      }
    });
    return flat;
  }, [photos, columnCount]);

  const visualPhotos = useMemo(() => {
    return listData
      .filter((item) => item.type === 'row')
      .flatMap((row) => row.items || []);
  }, [listData]);

  // Math-based layout mapping for drag-to-select
  const memoriesCount = useMemo(() => generateMemories(photos).length, [photos]);
  const itemLayouts = useMemo(() => {
    let y = HEADER_HEIGHT;
    if (memoriesCount > 0) y += 236; // Approx height of MemoriesCarousel + padding
    
    const layouts = [];
    for (let i = 0; i < listData.length; i++) {
      const item = listData[i];
      if (item.type === 'header') {
        layouts.push({ type: 'header', y, height: 56 });
        y += 56;
      } else {
        layouts.push({ type: 'row', y, height: itemSize, items: item.items });
        y += itemSize + GRID_GAP;
      }
    }
    return layouts;
  }, [listData, itemSize, memoriesCount]);

  // Refs for PanResponder
  const isSelectingRef = useRef(isSelecting);
  const selectedIdsRef = useRef(selectedIds);
  const itemLayoutsRef = useRef(itemLayouts);
  const itemSizeRef = useRef(itemSize);
  const dragModeRef = useRef<'select' | 'deselect'>('select');
  const lastHoveredIdRef = useRef<string | null>(null);

  useEffect(() => { isSelectingRef.current = isSelecting; }, [isSelecting]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { itemLayoutsRef.current = itemLayouts; }, [itemLayouts]);
  useEffect(() => { itemSizeRef.current = itemSize; }, [itemSize]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return isSelectingRef.current && Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: (evt) => {
        if (!isSelectingRef.current) return;
        // Determine drag mode based on the first item tapped
        const listY = evt.nativeEvent.pageY + lastScrollY.value;
        const listX = evt.nativeEvent.pageX;
        const row = itemLayoutsRef.current.find(l => listY >= l.y && listY <= l.y + l.height);
        
        if (row && row.type === 'row' && row.items) {
          const colIndex = Math.floor(listX / itemSizeRef.current);
          const photo = row.items[colIndex];
          if (photo) {
            dragModeRef.current = selectedIdsRef.current.has(photo._id) ? 'deselect' : 'select';
            lastHoveredIdRef.current = photo._id;
            // Apply initial toggle
            setSelectedIds(prev => {
              const next = new Set(prev);
              if (dragModeRef.current === 'select') next.add(photo._id);
              else next.delete(photo._id);
              return next;
            });
            Haptics.selectionAsync();
          }
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isSelectingRef.current) return;
        const listY = evt.nativeEvent.pageY + lastScrollY.value;
        const listX = evt.nativeEvent.pageX;

        const row = itemLayoutsRef.current.find(l => listY >= l.y && listY <= l.y + l.height);
        if (row && row.type === 'row' && row.items) {
          const colIndex = Math.floor(listX / itemSizeRef.current);
          const photo = row.items[colIndex];
          
          if (photo && photo._id !== lastHoveredIdRef.current) {
            lastHoveredIdRef.current = photo._id;
            setSelectedIds(prev => {
              const next = new Set(prev);
              if (dragModeRef.current === 'select') next.add(photo._id);
              else next.delete(photo._id);
              return next;
            });
            Haptics.selectionAsync();
          }
        }
      },
    })
  ).current;

  const stats = useMemo(() => {
    const cloudCount = photos.filter((p) => !p.uri).length;
    return {
      cloud: cloudCount,
      local: photos.length - cloudCount,
      favorites: photos.filter((p) => p.favorite).length,
    };
  }, [photos]);

  const renderItem = useCallback(({ item }: { item: RowItem }) => {
    if (item.type === 'header') {
      return (
        <View style={[styles.sectionHeader, { backgroundColor: isDark ? '#050505' : '#f7f7f7' }]}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#f0f0f0' : '#111' }]}>{item.title}</Text>
          <Text style={[styles.sectionMeta, { color: isDark ? '#888' : '#888' }]}>{item.meta}</Text>
        </View>
      );
    }
    return (
      <View style={styles.row}>
        {item.items.map((photo) => (
          <PhotoTile
            key={photo._id}
            photo={photo}
            photos={visualPhotos}
            token={token}
            itemSize={itemSize}
            isDark={isDark}
            isSelecting={isSelecting}
            isSelected={selectedIds.has(photo._id)}
            onLongPress={enterSelectionMode}
            onSelect={toggleSelect}
          />
        ))}
        {item.items.length < columnCount &&
          Array.from({ length: columnCount - item.items.length }).map((_, i) => (
            <View key={`filler-${i}`} style={{ width: itemSize, height: itemSize }} />
          ))}
      </View>
    );
  }, [isDark, visualPhotos, token, itemSize, isSelecting, selectedIds, enterSelectionMode, toggleSelect, columnCount]);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#050505' : '#f7f7f7' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />

      {/* Scrollable gallery — paddingTop pushes content below the fixed header */}
      {loading && photos.length === 0 ? (
        <View style={{ paddingTop: HEADER_HEIGHT, paddingHorizontal: 0 }}>
          {Array.from({ length: 4 }).map((_, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {Array.from({ length: columnCount }).map((_, colIndex) => (
                <Skeleton 
                  key={colIndex} 
                  width={itemSize} 
                  height={itemSize} 
                  borderRadius={0} 
                  style={{ marginRight: colIndex === columnCount - 1 ? 0 : 1.5 }} 
                />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flex: 1 }} {...panResponder.panHandlers}>
          <AnimatedFlashList
            data={listData}
            renderItem={renderItem}
            getItemType={(item: RowItem) => item.type}
            estimatedItemSize={itemSize}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            drawDistance={height * 1.5} // Aggressive memory management
            overrideItemLayout={(layout, item) => {
              if (item.type === 'header') {
                layout.size = 60; // Approximate header height
              } else {
                layout.size = itemSize + GRID_GAP;
              }
            }}
            ListHeaderComponent={<MemoriesCarousel />}
            contentContainerStyle={{
              paddingTop: HEADER_HEIGHT,
              paddingBottom: insets.bottom + 120,
            }}
            ListEmptyComponent={
              <EmptyState 
                icon={galleryError ? 'warning-outline' : 'images-outline'}
                title={galleryError ? 'Gallery unavailable' : isGuest ? 'No local photos' : 'No photos yet'}
                description={galleryError ? galleryError : undefined}
                style={{ marginTop: 60 }}
              />
            }
          />
        </View>
      )}

      {/* ── Multi-select Action Bar ─────────────────────────────────── */}
      {isSelecting && (
        <Animated.View
          entering={FadeInUp.duration(280)}
          exiting={FadeOutDown.duration(220)}
          style={[styles.actionBar, {
            bottom: insets.bottom + 80,
            backgroundColor: isDark ? 'rgba(18,18,20,0.98)' : 'rgba(255,255,255,0.98)',
            shadowColor: isDark ? '#000' : '#000',
          }]}
        >
          {/* Count pill */}
          <View style={[styles.actionCountPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)' }]}>
            <View style={styles.actionCountDot} />
            <Text style={[styles.actionCountText, { color: isDark ? '#fff' : '#000' }]}>
              {selectedIds.size} {selectedIds.size === 1 ? 'photo' : 'photos'} selected
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionBtns}>
            {/* Share */}
            <TouchableOpacity
              style={[styles.actionBtn, { opacity: selectedIds.size === 1 ? 1 : 0.35 }]}
              onPress={shareSelected}
              disabled={selectedIds.size !== 1}
            >
              <View style={[styles.actionBtnIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="share-outline" size={20} color={isDark ? '#fff' : '#000'} />
              </View>
              <Text style={[styles.actionBtnLabel, { color: isDark ? '#aaa' : '#666' }]}>Share</Text>
            </TouchableOpacity>

            {/* Album */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => { setAlbumName(''); setAlbumModalVisible(true); }}
            >
              <View style={[styles.actionBtnIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="albums-outline" size={20} color={isDark ? '#fff' : '#000'} />
              </View>
              <Text style={[styles.actionBtnLabel, { color: isDark ? '#aaa' : '#666' }]}>Add to Album</Text>
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity style={styles.actionBtn} onPress={deleteSelected}>
              <View style={[styles.actionBtnIcon, { backgroundColor: 'rgba(255,59,48,0.12)' }]}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </View>
              <Text style={[styles.actionBtnLabel, { color: '#FF3B30' }]}>Move to Bin</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity style={styles.actionBtn} onPress={cancelSelection}>
              <View style={[styles.actionBtnIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="close" size={20} color={isDark ? '#aaa' : '#666'} />
              </View>
              <Text style={[styles.actionBtnLabel, { color: isDark ? '#aaa' : '#666' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── Create Album Modal ────────────────────────────────────────── */}
      <Modal visible={albumModalVisible} transparent animationType="slide" onRequestClose={() => setAlbumModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setAlbumModalVisible(false)}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>New Album</Text>
            <Text style={[styles.modalSub, { color: isDark ? '#aaa' : '#666' }]}>
              {selectedIds.size} photo{selectedIds.size > 1 ? 's' : ''} will be added
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: isDark ? '#fff' : '#000' }]}
              placeholder="Album name"
              placeholderTextColor={isDark ? '#666' : '#aaa'}
              value={albumName}
              onChangeText={setAlbumName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createAlbumWithSelected}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]} onPress={() => setAlbumModalVisible(false)}>
                <Text style={[styles.modalBtnText, { color: isDark ? '#fff' : '#000' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary, { opacity: albumName.trim() ? 1 : 0.5 }]} onPress={createAlbumWithSelected} disabled={!albumName.trim()}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      <Animated.View style={[styles.headerWrapper, headerAnimStyle]}>
      <BlurView
        intensity={85}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.header, { paddingTop: insets.top + 10, height: HEADER_HEIGHT }]}
      >
        {/* Row 1: Title + Actions */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#111' }]}>Photos</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
              onPress={() => { Haptics.selectionAsync(); router.push('/search'); }}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={19} color={isDark ? '#fff' : '#111'} />
            </TouchableOpacity>
            {!isGuest && (
              <>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
                  onPress={() => { Haptics.selectionAsync(); router.push('/notifications'); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="notifications-outline" size={19} color={isDark ? '#fff' : '#111'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
                  onPress={pickImage}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={22} color={isDark ? '#fff' : '#111'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
                  onPress={() => { Haptics.selectionAsync(); router.push('/settings'); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="settings-outline" size={19} color={isDark ? '#fff' : '#111'} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Row 2: Stat chips */}
        <View style={styles.chipsRow}>
          <StatChip value={stats.cloud} label="Cloud" isDark={isDark} />
          <StatChip value={stats.local} label="Local" isDark={isDark} />
          <StatChip value={stats.favorites} label="Fav" isDark={isDark} />
        </View>

        {/* Bottom separator */}
        <View style={[styles.headerDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
      </BlurView>
      </Animated.View>

      {showSplashOverlay && <SplashOverlay onComplete={() => setShowSplashOverlay(false)} />}
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatChip = ({ value, label, isDark }: { value: number; label: string; isDark: boolean }) => (
  <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]}>
    <Text style={[styles.chipValue, { color: isDark ? '#fff' : '#111' }]}>{value}</Text>
    <Text style={[styles.chipLabel, { color: isDark ? '#aaa' : '#666' }]}>{label}</Text>
  </View>
);

const PhotoTile = memo(({
  photo,
  photos,
  token,
  itemSize,
  isDark,
  isSelecting,
  isSelected,
  onLongPress,
  onSelect,
}: {
  photo: PhotoItem;
  photos: PhotoItem[];
  token?: string | null;
  itemSize: number;
  isDark: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  onLongPress: (id: string) => void;
  onSelect: (id: string) => void;
}) => {
  const router = useRouter();
  const tileRef = useRef<any>(null);
  const imageUri = getPhotoUri(photo, token);

  const scale = useSharedValue(isSelected ? 0.94 : 1);
  const checkScale = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 0.92 : 1, { damping: 24, stiffness: 300 });
    checkScale.value = withSpring(isSelected ? 1 : 0, { damping: 16, stiffness: 200 });
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const openPhoto = () => {
    if (isSelecting) { onSelect(photo._id); return; }
    Haptics.selectionAsync();
    const flatIndex = Math.max(0, photos.findIndex((p) => p._id === photo._id));
    usePhotoStore.getState().setViewingPhotos(photos);
    router.push({
      pathname: '/photo/[id]',
      params: {
        id: photo._id,
        initialIndex: flatIndex,
        mode: 'custom',
      },
    });
  };

  const handleLongPress = () => {
    onLongPress(photo._id);
  };

  const badge = photo.favorite ? '★ Fav' : photo.uri ? 'Local' : 'Cloud';

  return (
    <TouchableOpacity
      ref={tileRef}
      onPress={openPhoto}
      onLongPress={handleLongPress}
      delayLongPress={360}
      activeOpacity={0.88}
    >
      <Animated.View
        style={[
          styles.tile,
          { width: itemSize, height: itemSize, backgroundColor: isDark ? '#1a1a1a' : '#e2e2e2', borderRadius: 4 },
          animatedStyle,
        ]}
      >
      <AnimatedImage
        sharedTransitionTag={photo._id}
        source={imageUri}
        placeholder={photo.blurhash || DEFAULT_BLURHASH}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
      {/* Selection dim overlay */}
      {isSelecting && (
        <View style={[styles.selectionOverlay, { backgroundColor: isSelected ? 'rgba(0,122,255,0.25)' : 'rgba(0,0,0,0.15)' }]} />
      )}
      {/* Checkmark */}
      {isSelecting && (
        <Animated.View style={[styles.checkmark, { borderColor: isSelected ? '#007AFF' : 'rgba(255,255,255,0.6)', backgroundColor: isSelected ? '#007AFF' : 'rgba(0,0,0,0.3)' }, checkStyle]}>
          {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
        </Animated.View>
      )}
      {/* Subtle gradient scrim at bottom */}
      {!isSelecting && <View style={styles.tileScrim} />}
      {/* Badge — only show when not selecting */}
      {!isSelecting && (
        <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
          <Text style={[styles.badgeText, { color: isDark ? '#fff' : '#000' }]}>{badge}</Text>
        </View>
      )}
      </Animated.View>
    </TouchableOpacity>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Fixed animated header wrapper
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  // Fixed header
  header: {
    paddingHorizontal: 18,
    paddingBottom: 15,
    justifyContent: 'flex-end',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  headerDivider: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionMeta: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },

  // Grid
  row: {
    flexDirection: 'row',
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tile: {
    overflow: 'hidden',
  },
  tileScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  badge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },

  // Loader
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loaderText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  uploadCta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
  },
  uploadCtaText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Multi-select tile states
  tileSelected: {
    transform: [{ scale: 0.94 }],
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Improved Action bar
  actionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 24,
    overflow: 'visible',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  actionCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
  },
  actionCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtns: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 16,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  actionBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Create album modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: -8,
  },
  modalInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: '#007AFF',
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

