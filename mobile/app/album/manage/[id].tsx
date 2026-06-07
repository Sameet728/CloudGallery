import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, useColorScheme, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../../src/services/api';

export default function ManageAccessScreen() {
  const { id } = useLocalSearchParams();
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!identifier.trim()) return;
    setLoading(true);
    try {
      await api.post(`/albums/${id}/invite`, { identifier: identifier.trim(), permission: 'Viewer' });
      Alert.alert('Success', 'User invited successfully');
      setIdentifier('');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to invite user');
    } finally {
      setLoading(false);
    }
  };

  const bg = isDark ? '#050505' : '#f2f2f7';
  const textPrimary = isDark ? '#ffffff' : '#000000';
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={textPrimary} />
          <Text style={[styles.backText, { color: textPrimary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Manage Access</Text>
        <View style={{ width: 80 }} />
      </BlurView>

      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#8e8e93' : '#6c6c70' }]}>INVITE PEOPLE</Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <TextInput
            style={[styles.input, { color: textPrimary }]}
            placeholder="Username or Email"
            placeholderTextColor={isDark ? '#666' : '#999'}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity 
            style={[styles.inviteBtn, { opacity: identifier.trim() ? 1 : 0.5 }]} 
            disabled={!identifier.trim() || loading}
            onPress={handleInvite}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.inviteText}>Invite</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    position: 'absolute', top: 0, width: '100%', zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.2)',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 80, paddingLeft: 8 },
  backText: { fontSize: 16, marginLeft: -2 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  content: { paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  card: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  inviteBtn: { backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  inviteText: { color: '#fff', fontWeight: '600' },
});
