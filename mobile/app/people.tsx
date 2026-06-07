import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../src/services/api';
import { useAuthStore } from '../src/store/useAuthStore';
import { usePhotoStore } from '../src/store/usePhotoStore';

export default function PeopleScreen() {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuthStore();
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Rename Modal State
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [personToRename, setPersonToRename] = useState<any>(null);

  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      const response = await api.get('/people');
      setPeople(response.data);
    } catch (error) {
      console.error('Failed to fetch people:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = (personId: string, currentName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPersonToRename(people.find(p => p._id === personId));
    setRenameInput(currentName === 'Unknown Person' ? '' : currentName);
    setRenameModalVisible(true);
  };

  const submitRename = async () => {
    if (!personToRename || !renameInput || renameInput.trim() === '') return;
    const newName = renameInput.trim();
    const personId = personToRename._id;
    try {
      await api.post(`/people/${personId}/rename`, { name: newName });
      setPeople(people.map(p => p._id === personId ? { ...p, name: newName } : p));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRenameModalVisible(false);
      setPersonToRename(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to rename person');
    }
  };

  const handlePersonPress = (person: any) => {
    Haptics.selectionAsync();
    // Navigate to the dedicated person view
    if (person.name !== 'Unknown Person') {
      router.push({
        pathname: '/person/[id]',
        params: { id: person._id, name: person.name, coverPhotoId: person.faces?.[0]?.photoId?._id }
      });
    } else {
      Alert.alert('Name Required', 'Please name this person before viewing their photos', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rename', onPress: () => handleRename(person._id, person.name) }
      ]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#050505' : '#f7f7f7' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <BlurView intensity={78} tint={isDark ? 'dark' : 'light'} style={styles.headerIcon}>
          <TouchableOpacity style={styles.iconHitbox} onPress={() => router.back()} activeOpacity={0.84}>
            <Ionicons name="chevron-back" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        </BlurView>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>People</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {people.map((person) => {
          const coverFace = person.faces[0];
          const imageUri = `${api.defaults.baseURL}/photos/${coverFace.photoId._id}/url?resolution=thumbnail${token ? `&token=${token}` : ''}`;

          return (
            <TouchableOpacity
              key={person._id}
              activeOpacity={0.8}
              onPress={() => handlePersonPress(person)}
              onLongPress={() => handleRename(person._id, person.name)}
              style={styles.personCard}
            >
              <View style={[styles.imageContainer, { borderColor: isDark ? '#333' : '#ddd' }]}>
                <Image
                  source={imageUri}
                  placeholder={coverFace.photoId?.blurhash || 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH'}
                  style={styles.personImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{person.faces.length}</Text>
                </View>
              </View>
              <Text style={[styles.personName, { color: isDark ? '#fff' : '#000' }]} numberOfLines={1}>
                {person.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {people.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="people-circle-outline" size={64} color={isDark ? '#444' : '#ccc'} />
            <Text style={[styles.emptyText, { color: isDark ? '#aaa' : '#666' }]}>No people detected yet.</Text>
            <Text style={[styles.emptySubtext, { color: isDark ? '#666' : '#999' }]}>Upload photos with clear faces to see them here.</Text>
          </View>
        )}
      </ScrollView>

      {/* Rename Modal */}
      <Modal visible={renameModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>Rename Person</Text>
            <Text style={[styles.modalSubtitle, { color: isDark ? '#888' : '#666' }]}>Enter a name for this person</Text>
            
            <TextInput
              style={[styles.modalInput, { 
                backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7',
                color: isDark ? '#fff' : '#000'
              }]}
              placeholder="e.g. John Doe"
              placeholderTextColor={isDark ? '#888' : '#aaa'}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              autoCapitalize="words"
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: isDark ? '#333' : '#e5e5ea' }]}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: isDark ? '#fff' : '#000' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={submitRename}
              >
                <Text style={styles.modalButtonTextPrimary}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingBottom: 16,
  },
  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconHitbox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 16,
  },
  personCard: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 8,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 2,
    marginBottom: 8,
  },
  personImage: {
    width: '100%',
    height: '100%',
  },
  countBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  personName: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    width: '100%',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  modalInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  modalButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
