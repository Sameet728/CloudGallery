import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, useColorScheme, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, spacing, radius, typography } from '../../src/theme/theme';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const ScaleButton = ({ onPress, children, style, onLayout, hitSlop }: any) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.75}
      hitSlop={hitSlop}
      onPressIn={() => { scale.value = withSpring(0.9, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
      onPress={onPress}
      onLayout={onLayout}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
};

function CustomTabBar({ state, navigation, openMenu }: any) {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const themeColors = isDark ? colors.dark : colors.light;

  const glassBg = isDark ? 'rgba(30,30,30,0.45)' : 'rgba(255,255,255,0.45)';
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)';
  const activeBg = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.95)';

  const indexRouteIdx = state.routes.findIndex((route: any) => route.name === 'index');
  const albumsRouteIdx = state.routes.findIndex((route: any) => route.name === 'albums');

  const activeIndex = state.index === albumsRouteIdx ? 1 : 0;
  const translateX = useSharedValue(0);
  const [pillWidth, setPillWidth] = useState(0);

  useEffect(() => {
    translateX.value = withSpring(activeIndex * pillWidth, {
      damping: 24,
      stiffness: 240,
      mass: 1,
    });
  }, [activeIndex, pillWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const navigateTo = (name: string, index: number) => {
    if (state.index === index) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(name);
  };

  return (
    <View style={[styles.floatingTabBarWrapper, { bottom: Math.max(insets.bottom + 12, 24) }]}>
      <BlurView intensity={75} tint={isDark ? 'dark' : 'light'} style={[styles.sideButton, { backgroundColor: glassBg, borderColor: glassBorder }]}>
        <ScaleButton style={styles.iconHitbox} onPress={() => navigateTo('map', -1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="map-outline" size={20} color={themeColors.textPrimary} />
        </ScaleButton>
      </BlurView>

      <BlurView intensity={75} tint={isDark ? 'dark' : 'light'} style={[styles.centerPill, { backgroundColor: glassBg, borderColor: glassBorder }]}>
        <View style={styles.centerToggle}>
          <Animated.View style={[styles.activePillIndicator, animatedStyle, { backgroundColor: activeBg, width: pillWidth }]} />
          
          <ScaleButton
            style={styles.toggleButton}
            onLayout={(e: any) => setPillWidth(e.nativeEvent.layout.width)}
            onPress={() => navigateTo('index', indexRouteIdx)}
          >
            <Text style={[styles.toggleText, { color: activeIndex === 0 ? themeColors.textPrimary : themeColors.textSecondary }]}>
              Photos
            </Text>
          </ScaleButton>
          <ScaleButton
            style={styles.toggleButton}
            onPress={() => navigateTo('albums', albumsRouteIdx)}
          >
            <Text style={[styles.toggleText, { color: activeIndex === 1 ? themeColors.textPrimary : themeColors.textSecondary }]}>
              Albums
            </Text>
          </ScaleButton>
        </View>
      </BlurView>

      <BlurView intensity={75} tint={isDark ? 'dark' : 'light'} style={[styles.sideButton, { backgroundColor: glassBg, borderColor: glassBorder }]}>
        <ScaleButton style={styles.iconHitbox} onPress={openMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="menu-outline" size={22} color={themeColors.textPrimary} />
        </ScaleButton>
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const themeColors = isDark ? colors.dark : colors.light;
  const bottomSheetRef = useRef<BottomSheet>(null);
  const router = useRouter();

  const openMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    bottomSheetRef.current?.expand();
  };

  const handleMenuPress = (route: string) => {
    Haptics.selectionAsync();
    bottomSheetRef.current?.close();
    router.push(route as any);
  };

  const MenuRow = ({
    icon,
    title,
    detail,
    route,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    detail: string;
    route: string;
  }) => (
    <TouchableOpacity style={styles.menuRow} onPress={() => handleMenuPress(route)} activeOpacity={0.84}>
      <View style={[styles.menuIconBox, { backgroundColor: themeColors.iconBg }]}>
        <Ionicons name={icon} size={22} color={themeColors.textPrimary} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={[styles.menuText, { color: themeColors.textPrimary }]}>{title}</Text>
        <Text style={[styles.menuDetail, { color: themeColors.textSecondary }]}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={themeColors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} openMenu={openMenu} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Photos' }} />
        <Tabs.Screen name="albums" options={{ title: 'Albums' }} />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen name="trash" options={{ href: null }} />
        <Tabs.Screen name="map" options={{ href: null }} />
      </Tabs>

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['58%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: themeColors.surface }}
        handleIndicatorStyle={{ backgroundColor: themeColors.textMuted }}
      >
        <BottomSheetView style={styles.sheetContent}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetEyebrow, { color: themeColors.textSecondary }]}>More</Text>
              <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>Library</Text>
            </View>
            <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={styles.sheetClose}>
              <TouchableOpacity style={styles.iconHitbox} onPress={() => bottomSheetRef.current?.close()} activeOpacity={0.84}>
                <Ionicons name="close" size={20} color={themeColors.textPrimary} />
              </TouchableOpacity>
            </BlurView>
          </View>

          <View style={styles.menuList}>
            <MenuRow icon="people-circle-outline" title="People & Faces" detail="Manage detected faces" route="/people" />
            <MenuRow icon="sparkles-outline" title="AI Search" detail="Find people, text, and scenes" route="/search" />
            <MenuRow icon="cloud-upload-outline" title="Upload Center" detail="Manage transfers" route="/upload" />
            <MenuRow icon="people-outline" title="Shared" detail="Collaborative albums" route="/shared-list" />
            <MenuRow icon="cloud-outline" title="Cloud" detail="Synced photos" route="/album/cloud" />
            <MenuRow icon="trash-outline" title="Bin" detail="Recently deleted" route="/trash" />
            <MenuRow icon="person-circle-outline" title="Account" detail="Profile and storage" route="/profile" />
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingTabBarWrapper: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    position: 'absolute',
  },
  iconHitbox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  sideButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
    width: 48,
  },
  centerPill: {
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  centerToggle: {
    flexDirection: 'row',
    position: 'relative',
  },
  activePillIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 22,
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: 22,
    justifyContent: 'center',
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetEyebrow: {
    fontSize: typography.small.fontSize,
    fontWeight: typography.small.fontWeight,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    letterSpacing: typography.heading.letterSpacing,
    lineHeight: typography.heading.fontSize * 1.1,
  },
  sheetClose: {
    borderRadius: radius.xl,
    height: 44,
    overflow: 'hidden',
    width: 44,
  },
  menuList: {
    gap: 8,
  },
  menuRow: {
    alignItems: 'center',
    borderRadius: radius.xl,
    flexDirection: 'row',
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.m - 2,
  },
  menuIconBox: {
    alignItems: 'center',
    borderRadius: radius.xl,
    height: 44,
    justifyContent: 'center',
    marginRight: spacing.m,
    width: 44,
  },
  menuCopy: {
    flex: 1,
  },
  menuText: {
    fontSize: typography.bodySemibold.fontSize,
    fontWeight: typography.bodySemibold.fontWeight,
  },
  menuDetail: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    marginTop: 2,
  },
});
