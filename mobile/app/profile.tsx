import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, useColorScheme, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';

import { useBackupStore } from '../src/store/useBackupStore';
import { useAuthStore } from '../src/store/useAuthStore';
import { usePhotoStore } from '../src/store/usePhotoStore';
import { registerBackgroundBackup, unregisterBackgroundBackup } from '../src/services/BackgroundBackup';
import { colors, spacing, radius, typography } from '../src/theme/theme';

export default function ProfileScreen() {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isGuest, logout, user } = useAuthStore();
  const { photos } = usePhotoStore();
  
  const initials = isGuest ? 'G' : user?.username?.[0]?.toUpperCase() || 'C';

  const formatStorage = (bytes: number) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const { autoBackupEnabled, backupOverCellular, selectedAlbums, setSettings, toggleAlbum } = useBackupStore();
  const [deviceAlbums, setDeviceAlbums] = useState<MediaLibrary.Album[]>([]);

  useEffect(() => {
    (async () => {
      try {
        let perm = await MediaLibrary.getPermissionsAsync();
        if (perm.status !== 'granted' && perm.canAskAgain) {
          perm = await MediaLibrary.requestPermissionsAsync();
        }
        if (perm.status === 'granted') {
          const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
          // Prioritize common backup folders
          const prioritized = albums.sort((a, b) => {
            const aPriority = ['Camera', 'Screenshots', 'WhatsApp Images', 'Download'].includes(a.title);
            const bPriority = ['Camera', 'Screenshots', 'WhatsApp Images', 'Download'].includes(b.title);
            if (aPriority && !bPriority) return -1;
            if (!aPriority && bPriority) return 1;
            return b.assetCount - a.assetCount;
          });
          setDeviceAlbums(prioritized);
        }
      } catch (e: any) {
        console.log('MediaLibrary permission error:', e.message);
      }
    })();
  }, []);

  const handleToggleAutoBackup = async (val: boolean) => {
    Haptics.selectionAsync();
    setSettings({ autoBackupEnabled: val });
    if (val) {
      await registerBackgroundBackup();
    } else {
      await unregisterBackgroundBackup();
    }
  };

  const themeColors = isDark ? colors.dark : colors.light;
  const bg = themeColors.background;
  const cardBg = themeColors.surface;
  const textPrimary = themeColors.textPrimary;
  const textSecondary = themeColors.textSecondary;

  if (isGuest) {
    return (
      <View style={[styles.screen, { backgroundColor: bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />
        <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={26} color={textPrimary} />
            <Text style={[styles.backText, { color: textPrimary }]}>Back</Text>
          </TouchableOpacity>
        </BlurView>
        <View style={styles.guestCenter}>
          <Ionicons name="person-circle-outline" size={80} color={textSecondary} />
          <Text style={[styles.guestTitle, { color: textPrimary }]}>Sign In to Backup</Text>
          <TouchableOpacity style={[styles.signInBtn, { backgroundColor: textPrimary }]} onPress={() => { logout(); router.replace('/(auth)/login'); }}>
            <Text style={[styles.signInText, { color: bg }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />
      
      <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={26} color={textPrimary} />
          <Text style={[styles.backText, { color: textPrimary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Settings</Text>
        <View style={{ width: 80 }} />
      </BlurView>

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 70, paddingBottom: 60 }}>
        
        <View style={[styles.cardGroup, { backgroundColor: cardBg, marginBottom: 32 }]}>
          <View style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: isDark ? '#333' : '#e5e5ea' }]}>
              <Text style={[styles.avatarText, { color: textPrimary }]}>{initials}</Text>
            </View>
            <Text style={[styles.username, { color: textPrimary }]}>
              {isGuest ? 'Guest Mode' : user?.username || 'CloudGallery'}
            </Text>
            <Text style={[styles.email, { color: textSecondary }]}>
              {isGuest ? 'Local photos only' : user?.email || 'Cloud account'}
            </Text>

            <View style={styles.statGrid}>
              <ProfileStat title="Photos" value={photos.length} isDark={isDark} />
              <ProfileStat title="Cloud" value={isGuest ? 0 : photos.filter((photo) => !photo.uri).length} isDark={isDark} />
              <ProfileStat title="Storage" value={formatStorage(user?.storageUsed || 0)} isDark={isDark} />
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: textSecondary }]}>AUTO BACKUP</Text>
        
        <View style={[styles.cardGroup, { backgroundColor: cardBg }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingTextContent}>
              <Text style={[styles.settingTitle, { color: textPrimary }]}>Background Backup</Text>
              <Text style={[styles.settingSub, { color: textSecondary }]}>Automatically backup selected folders in the background</Text>
            </View>
            <Switch value={autoBackupEnabled} onValueChange={handleToggleAutoBackup} />
          </View>
          
          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
          
          <View style={styles.settingRow}>
            <View style={styles.settingTextContent}>
              <Text style={[styles.settingTitle, { color: textPrimary }]}>Use Cellular Data</Text>
              <Text style={[styles.settingSub, { color: textSecondary }]}>Back up over mobile data when Wi-Fi is unavailable</Text>
            </View>
            <Switch 
              value={backupOverCellular} 
              onValueChange={(val) => {
                Haptics.selectionAsync();
                setSettings({ backupOverCellular: val });
              }} 
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: textSecondary, marginTop: 32 }]}>BACKUP FOLDERS</Text>
        <View style={[styles.cardGroup, { backgroundColor: cardBg }]}>
          {deviceAlbums.map((album, index) => (
            <View key={album.id}>
              <TouchableOpacity 
                style={styles.settingRow} 
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.selectionAsync();
                  toggleAlbum(album.id);
                }}
              >
                <View style={styles.settingTextContent}>
                  <Text style={[styles.settingTitle, { color: textPrimary }]}>{album.title}</Text>
                  <Text style={[styles.settingSub, { color: textSecondary }]}>{album.assetCount} items</Text>
                </View>
                <Switch 
                  value={selectedAlbums.includes(album.id)} 
                  onValueChange={() => toggleAlbum(album.id)} 
                  disabled={true} 
                  pointerEvents="none"
                />
              </TouchableOpacity>
              {index < deviceAlbums.length - 1 && (
                <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
              )}
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: textSecondary, marginTop: 32 }]}>ACCOUNT</Text>
        <View style={[styles.cardGroup, { backgroundColor: cardBg }]}>
          <TouchableOpacity 
            style={styles.settingRow} 
            activeOpacity={0.7}
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: () => {
                    logout();
                    router.replace('/(auth)/login');
                  } 
                }
              ]);
            }}
          >
            <Text style={[styles.settingTitle, { color: '#FF3B30' }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const ProfileStat = ({ title, value, isDark }: { title: string; value: string | number; isDark: boolean }) => (
  <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
    <Text style={[styles.statValue, { color: isDark ? '#fff' : '#000' }]}>{value}</Text>
    <Text style={[styles.statTitle, { color: isDark ? '#bdbdbd' : '#555' }]}>{title}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80, paddingLeft: 8 },
  backText: { fontSize: 16, marginLeft: -2 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: -0.2,
  },
  cardGroup: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingTextContent: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingSub: {
    fontSize: 13,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  guestCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  guestTitle: { fontSize: 24, fontWeight: '800' },
  signInBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  signInText: { fontSize: 16, fontWeight: '700' },
  profileCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: radius.round,
    height: 80,
    justifyContent: 'center',
    marginBottom: spacing.m,
    width: 80,
  },
  avatarText: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight,
  },
  username: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
  },
  statGrid: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    width: '100%',
  },
  statCard: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 13,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 3,
  },
});
