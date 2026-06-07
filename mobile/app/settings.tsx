import React, { useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, useColorScheme, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../src/store/useAuthStore';
import { usePhotoStore } from '../src/store/usePhotoStore';
import { useBackupStore } from '../src/store/useBackupStore';

const SettingRow = ({ icon, label, value, onPress, isSwitch, switchValue, onSwitch, isDark, color }: any) => (
  <TouchableOpacity
    style={[styles.row, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
    onPress={onPress}
    disabled={!onPress && !isSwitch}
    activeOpacity={0.7}
  >
    <View style={[styles.iconBox, { backgroundColor: color || (isDark ? '#333' : '#eee') }]}>
      <Ionicons name={icon} size={18} color="#fff" />
    </View>
    <Text style={[styles.rowLabel, { color: isDark ? '#fff' : '#000' }]}>{label}</Text>
    {value && <Text style={[styles.rowValue, { color: isDark ? '#888' : '#888' }]}>{value}</Text>}
    {isSwitch && (
      <Switch
        value={switchValue}
        onValueChange={onSwitch}
        trackColor={{ false: isDark ? '#333' : '#ddd', true: '#34C759' }}
      />
    )}
    {!isSwitch && onPress && <Ionicons name="chevron-forward" size={18} color={isDark ? '#555' : '#ccc'} />}
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const { user, logout } = useAuthStore();
  const { autoBackupEnabled, backupOverCellular, setSettings } = useBackupStore();
  const { photos } = usePhotoStore();

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    logout();
    router.replace('/(auth)/login');
  };

  const cloudCount = useMemo(() => photos.filter(p => !p.uri).length, [photos]);
  const cloudUsage = (cloudCount * 2.4).toFixed(1); // Mock 2.4MB per photo

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#f2f2f7' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 15, backgroundColor: isDark ? '#121212' : '#fff' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={[styles.card, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
          <View style={styles.profileHeader}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.avatar}
              contentFit="cover"
            />
            <View>
              <Text style={[styles.profileName, { color: isDark ? '#fff' : '#000' }]}>{user?.username || 'Guest User'}</Text>
              <Text style={[styles.profileEmail, { color: isDark ? '#aaa' : '#666' }]}>{user?.email || 'Local Storage Mode'}</Text>
            </View>
          </View>
        </View>

        {/* Cloud Usage */}
        <Text style={[styles.sectionTitle, { color: isDark ? '#888' : '#888' }]}>CLOUD STORAGE</Text>
        <View style={[styles.card, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
          <SettingRow
            icon="cloud-outline"
            label="Cloud Usage"
            value={`${cloudUsage} MB`}
            color="#0A84FF"
            isDark={isDark}
          />
          <SettingRow
            icon="sync-outline"
            label="Auto Backup"
            isSwitch
            switchValue={autoBackupEnabled}
            onSwitch={(val: boolean) => setSettings({ autoBackupEnabled: val })}
            color="#34C759"
            isDark={isDark}
          />
          <SettingRow
            icon="cellular-outline"
            label="Backup over Cellular"
            isSwitch
            switchValue={backupOverCellular}
            onSwitch={(val: boolean) => setSettings({ backupOverCellular: val })}
            color="#5E5CE6"
            isDark={isDark}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: isDark ? '#888' : '#888' }]}>APP SETTINGS</Text>
        <View style={[styles.card, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
          <SettingRow
            icon="color-palette-outline"
            label="Theme"
            value="System"
            color="#FF9500"
            isDark={isDark}
          />
          <SettingRow
            icon="trash-outline"
            label="Clear Thumbnail Cache"
            onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
            color="#FF3B30"
            isDark={isDark}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: isDark ? '#888' : '#888' }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
          <SettingRow
            icon="information-circle-outline"
            label="Version"
            value={Constants.expoConfig?.version || '1.0.0'}
            color="#8E8E93"
            isDark={isDark}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => {}}
            color="#30B0C7"
            isDark={isDark}
          />
        </View>

        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>CloudGallery App</Text>
          <Text style={styles.footerText}>Flagship Mobile Architecture</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: '#eee',
  },
  profileName: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  profileEmail: { fontSize: 14, fontWeight: '500' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  rowValue: { fontSize: 16, marginRight: 8 },
  logoutBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
  footer: { alignItems: 'center', marginTop: 40 },
  footerText: { color: '#888', fontSize: 12, marginTop: 4 },
});
