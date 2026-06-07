import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useColorScheme, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import api from '../src/services/api';

type NotificationItem = {
  _id: string;
  type: 'invite' | 'system' | 'upload_success' | 'upload_fail';
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
};

export default function NotificationsScreen() {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handlePress = async (notification: NotificationItem) => {
    Haptics.selectionAsync();
    if (!notification.read) {
      try {
        await api.put(`/notifications/${notification._id}/read`);
        setNotifications(prev => prev.map(n => n._id === notification._id ? { ...n, read: true } : n));
      } catch (e) {
        console.error(e);
      }
    }
    
    if (notification.actionUrl) {
      router.push(notification.actionUrl as any);
    }
  };

  const markAllAsRead = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity 
      style={[styles.itemContainer, { backgroundColor: isDark ? (item.read ? '#000' : '#1c1c1e') : (item.read ? '#fff' : '#f0f4ff') }]} 
      activeOpacity={0.7}
      onPress={() => handlePress(item)}
    >
      <View style={[styles.iconBox, { backgroundColor: isDark ? '#333' : '#e5e5ea' }]}>
        <Ionicons 
          name={item.type === 'invite' ? 'people' : item.type === 'system' ? 'information' : 'cloud-done'} 
          size={20} 
          color={isDark ? '#fff' : '#000'} 
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.itemTitle, { color: isDark ? '#fff' : '#000' }]}>{item.title}</Text>
        <Text style={[styles.itemMessage, { color: isDark ? '#aaa' : '#666' }]}>{item.message}</Text>
        <Text style={[styles.itemTime, { color: isDark ? '#666' : '#999' }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const bg = isDark ? '#050505' : '#f2f2f7';
  const textPrimary = isDark ? '#ffffff' : '#000000';

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={textPrimary} />
          <Text style={[styles.backText, { color: textPrimary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Notifications</Text>
        <TouchableOpacity style={styles.headerRight} onPress={markAllAsRead}>
          <Text style={{ color: '#007AFF', fontSize: 16 }}>Read All</Text>
        </TouchableOpacity>
      </BlurView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={60} color={isDark ? '#444' : '#ccc'} />
          <Text style={[styles.emptyText, { color: isDark ? '#fff' : '#000' }]}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: insets.top + 70, paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

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
  headerRight: { width: 80, alignItems: 'flex-end', paddingRight: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 12 },
  itemContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  itemMessage: { fontSize: 14 },
  itemTime: { fontSize: 12, marginTop: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#007AFF', marginLeft: 12 },
});
