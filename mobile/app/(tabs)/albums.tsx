import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import { usePhotoStore } from '../../src/store/usePhotoStore';
import { useUploadStore } from '../../src/store/useUploadStore';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_W = (SCREEN_W - 18 * 2 - CARD_GAP) / 2;
const DEFAULT_BLURHASH = 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH';

type UserAlbum = {
  _id: string;
  name: string;
  description?: string;
  shareToken?: string;
  isPublic?: boolean;
  createdAt: string;
};

type AlbumWithPhotos = UserAlbum & { photos: any[] };

export default function AlbumsScreen() {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, isGuest } = useAuthStore();
  const { photos, fetchPhotos } = usePhotoStore();
  const uploadItems = useUploadStore((state) => state.items);

  const aggregatedPhotos = useMemo(() => {
    const pendingUploads = uploadItems
      .filter(i => i.status !== 'done' && i.status !== 'cancelled')
      .map(i => ({
        _id: i.id,
        uri: i.asset.uri,
        fileName: i.asset.fileName || 'Uploading...',
        creationTime: Date.now(),
        isUploadingObject: true,
        uploadProgress: i.progress,
        uploadStatus: i.status
      }));
    return [...pendingUploads, ...photos];
  }, [photos, uploadItems]);

  const [userAlbums, setUserAlbums] = useState<AlbumWithPhotos[]>([]);
  const [sharedAlbums, setSharedAlbums] = useState<AlbumWithPhotos[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [shareModalAlbum, setShareModalAlbum] = useState<AlbumWithPhotos | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [newAlbumModalVisible, setNewAlbumModalVisible] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');

  // Share Modal State
  const [shareTab, setShareTab] = useState<'link' | 'email'>('link');
  const [inviteEmail, setInviteEmail] = useState('');

  const fetchUserAlbums = useCallback(async () => {
    try {
      const { data } = await api.get('/albums');
      
      // Fetch photos for owned albums
      const ownedWithPhotos = await Promise.all(
        (data.owned || []).map(async (album: UserAlbum) => {
          try {
            const { data: detail } = await api.get(`/albums/${album._id}/photos`);
            return { ...album, photos: detail.photos || [] };
          } catch {
            return { ...album, photos: [] };
          }
        })
      );
      
      const sharedWithMe = data.shared || [];
      const myPublicAlbums = ownedWithPhotos.filter(a => a.isPublic);
      
      setUserAlbums(ownedWithPhotos);
      setSharedAlbums([...myPublicAlbums, ...sharedWithMe]);
    } catch (e) {
      console.log('fetchUserAlbums error:', e);
    }
  }, []);

  const fetchPeople = useCallback(async () => {
    if (isGuest) return;
    try {
      const { data } = await api.get('/people');
      // Sort to show named people first, then descending by face count
      const sorted = data.sort((a: any, b: any) => {
        const aNamed = a.name !== 'Unknown Person';
        const bNamed = b.name !== 'Unknown Person';
        if (aNamed && !bNamed) return -1;
        if (!aNamed && bNamed) return 1;
        return b.faces.length - a.faces.length;
      });
      setPeople(sorted);
    } catch {}
  }, [isGuest]);

  useFocusEffect(
    useCallback(() => {
      fetchUserAlbums();
      fetchPeople();
    }, [fetchUserAlbums, fetchPeople])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchPhotos(isGuest), fetchUserAlbums(), fetchPeople()]);
    setRefreshing(false);
  }, [isGuest, fetchPhotos, fetchUserAlbums, fetchPeople]);

  const localPhotos = useMemo(() => aggregatedPhotos.filter((p: any) => !!p.uri), [aggregatedPhotos]);
  const cloudPhotos = useMemo(() => aggregatedPhotos.filter((p: any) => !p.uri), [aggregatedPhotos]);
  const favPhotos = useMemo(() => aggregatedPhotos.filter((p: any) => p.favorite), [aggregatedPhotos]);

  const getUri = (photo: any) =>
    photo.uri || `${api.defaults.baseURL}/photos/${photo._id}/url?resolution=thumbnail${token ? `&token=${token}` : ''}`;

  const nav = (route: string) => {
    Haptics.selectionAsync();
    router.push(route as any);
  };

  const handleGenerateShareLink = async (album: AlbumWithPhotos) => {
    try {
      const { data } = await api.post(`/albums/${album._id}/share-link`);
      const link = `${(api.defaults.baseURL || '').replace('/api', '')}/s/${data.shareToken}`;
      setShareLink(link);
      setShareModalAlbum({ ...album, shareToken: data.shareToken, isPublic: true });
      setUserAlbums((prev) =>
        prev.map((a) => a._id === album._id ? { ...a, shareToken: data.shareToken, isPublic: true } : a)
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to generate share link.');
    }
  };

  const handleRevokeLink = async (album: AlbumWithPhotos) => {
    Alert.alert('Revoke Link', 'Anyone with the current link will lose access.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/albums/${album._id}/share-link`);
            setShareLink('');
            setShareModalAlbum(null);
            setUserAlbums((prev) =>
              prev.map((a) => a._id === album._id ? { ...a, shareToken: undefined, isPublic: false } : a)
            );
          } catch {
            Alert.alert('Error', 'Failed to revoke link.');
          }
        },
      },
    ]);
  };

  const openShareModal = async (album: AlbumWithPhotos) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (album.shareToken && album.isPublic) {
      const link = `${(api.defaults.baseURL || '').replace('/api', '')}/s/${album.shareToken}`;
      setShareLink(link);
    } else {
      setShareLink('');
    }
    setShareModalAlbum(album);
    setShareTab('link');
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !shareModalAlbum) return;
    try {
      await api.post(`/albums/${shareModalAlbum._id}/invite`, { email: inviteEmail.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Sent', `Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to send invite.');
    }
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(shareLink);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Share link copied to clipboard.');
  };

  const handleNativeShare = async () => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareLink, { dialogTitle: `View ${shareModalAlbum?.name} album` });
    } else {
      handleCopyLink();
    }
  };

  const createNewAlbum = async () => {
    const name = newAlbumName.trim();
    if (!name) return;
    try {
      await api.post('/albums', { name });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewAlbumModalVisible(false);
      setNewAlbumName('');
      fetchUserAlbums();
    } catch {
      Alert.alert('Error', 'Failed to create album.');
    }
  };

  const sharedPhotosPool = useMemo(() => {
    return sharedAlbums.flatMap(a => a.photos);
  }, [sharedAlbums]);

  const smartAlbums = [
    { id: 'cloud',     title: 'Cloud',     subtitle: 'Synced originals', icon: 'cloud-outline' as const,           route: '/album/cloud',     count: cloudPhotos.length,  covers: cloudPhotos.slice(0, 4) },
    { id: 'favorites', title: 'Favorites', subtitle: 'Pinned by you',    icon: 'heart-outline' as const,           route: '/album/favorites', count: favPhotos.length,    covers: favPhotos.slice(0, 4) },
    { id: 'local',     title: 'Local',     subtitle: 'On this device',   icon: 'phone-portrait-outline' as const,  route: '/album/local',     count: localPhotos.length,  covers: localPhotos.slice(0, 4) },
    { id: 'shared',    title: 'Shared',    subtitle: 'Shared spaces',    icon: 'people-outline' as const,          route: '/shared-list',count: sharedAlbums.length, covers: sharedPhotosPool.slice(0, 4) },
  ];

  const utilityAlbums = [
    { id: 'ai',      title: 'AI Search',          subtitle: 'Smart visual search',        icon: 'sparkles-outline' as const,      route: '/search' },
    { id: 'bin',     title: 'Recently Deleted',   subtitle: 'Removed items',              icon: 'trash-outline' as const,         route: '/trash' },
    { id: 'account', title: 'Account',            subtitle: isGuest ? 'Sign in' : 'Profile & settings', icon: 'person-circle-outline' as const, route: '/profile' },
  ];

  const bg = isDark ? '#050505' : '#f2f2f7';
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const textPrimary = isDark ? '#ffffff' : '#000000';
  const textSecondary = isDark ? '#8e8e93' : '#6c6c70';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const CoverMosaic = ({ covers, size }: { covers: any[]; size?: 'full' | 'half' }) => (
    <View style={size === 'full' ? styles.mosaicFull : styles.mosaicHalf}>
      {[0, 1, 2, 3].map((i) => {
        const photo = covers[i];
        return photo ? (
          <Image
            key={photo._id}
            source={getUri(photo)}
            placeholder={photo.blurhash || DEFAULT_BLURHASH}
            contentFit="cover"
            transition={300}
            cachePolicy="disk"
            style={size === 'full' ? styles.mosaicCellFull : styles.mosaicCellHalf}
          />
        ) : (
          <View key={`e-${i}`} style={[size === 'full' ? styles.mosaicCellFull : styles.mosaicCellHalf, { backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea' }]} />
        );
      })}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textSecondary} />}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View>
            <Text style={[styles.kicker, { color: textSecondary }]}>Library</Text>
            <Text style={[styles.title, { color: textPrimary }]}>Albums</Text>
          </View>
          <View style={styles.headerActions}>
            {!isGuest && (
              <TouchableOpacity
                onPress={() => { setNewAlbumName(''); setNewAlbumModalVisible(true); }}
                activeOpacity={0.7}
                style={[styles.avatarBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
              >
                <Ionicons name="add" size={22} color={textPrimary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => nav('/profile')}
              activeOpacity={0.7}
              style={[styles.avatarBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
            >
              <Ionicons name="person-outline" size={18} color={textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Recents banner ── */}
        {aggregatedPhotos.length > 0 && (
          <Animated.View entering={FadeInDown.duration(380).delay(60)} style={styles.recentsBannerWrap}>
            <TouchableOpacity activeOpacity={0.88} onPress={() => nav('/(tabs)')} style={[styles.recentsBanner, { backgroundColor: cardBg }]}>
              <CoverMosaic covers={aggregatedPhotos.slice(0, 4)} size="full" />
              <BlurView intensity={isDark ? 80 : 70} tint={isDark ? 'dark' : 'light'} style={styles.recentsMeta}>
                  <Text style={[styles.recentsSubtitle, { color: textSecondary }]}>{aggregatedPhotos.length}</Text>
                <Ionicons name="chevron-forward" size={18} color={textSecondary} />
              </BlurView>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── People Scroller ── */}
        {people.length > 0 && (
          <Animated.View entering={FadeInDown.duration(380).delay(90)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>People</Text>
              <TouchableOpacity onPress={() => nav('/people')}>
                <Text style={{ color: '#007AFF', fontWeight: '600' }}>View All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.peopleScrollContent}
            >
              {people.slice(0, 6).map(person => {
                const coverFace = person.faces[0];
                const imageUri = coverFace?.photoId?._id 
                  ? `${api.defaults.baseURL}/photos/${coverFace.photoId._id}/url?resolution=thumbnail${token ? `&token=${token}` : ''}`
                  : null;

                return (
                  <TouchableOpacity 
                    key={person._id} 
                    activeOpacity={0.8}
                    style={styles.personItem}
                    onPress={() => {
                      if (person.name !== 'Unknown Person') {
                        router.push({
                          pathname: '/person/[id]',
                          params: { id: person._id, name: person.name, coverPhotoId: coverFace?.photoId?._id }
                        });
                      } else {
                        nav('/people');
                      }
                    }}
                  >
                    <View style={[styles.personAvatar, { borderColor: isDark ? '#333' : '#ddd' }]}>
                      {imageUri ? (
                        <Image source={imageUri} style={styles.personImage} contentFit="cover" transition={200} />
                      ) : (
                        <Ionicons name="person" size={24} color={textSecondary} />
                      )}
                    </View>
                    <Text style={[styles.personName, { color: textPrimary }]} numberOfLines={1}>
                      {person.name === 'Unknown Person' ? 'Name Me' : person.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── Smart Albums grid ── */}
        <Animated.View entering={FadeInDown.duration(380).delay(120)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>My Albums</Text>
          <View style={styles.albumGrid}>
            {smartAlbums.map((album) => (
              <TouchableOpacity
                key={album.id}
                activeOpacity={0.85}
                onPress={() => nav(album.route)}
                style={[styles.albumCard, { backgroundColor: cardBg }]}
              >
                {album.covers.length > 0 ? (
                  <CoverMosaic covers={album.covers} size="half" />
                ) : (
                  <View style={[styles.albumCoverEmpty, { backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea' }]}>
                    <Ionicons name={album.icon} size={28} color={textSecondary} />
                  </View>
                )}
                <View style={styles.albumCardFooter}>
                  <Text style={[styles.albumCardTitle, { color: textPrimary }]} numberOfLines={1}>{album.title}</Text>
                  <Text style={[styles.albumCardCount, { color: textSecondary }]}>{album.count}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* ── User-created Albums ── */}
        {!isGuest && userAlbums.length > 0 && (
          <Animated.View entering={FadeInDown.duration(380).delay(170)} style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Created Albums</Text>
              <TouchableOpacity onPress={() => { setNewAlbumName(''); setNewAlbumModalVisible(true); }}>
                <Text style={{ color: '#007AFF', fontSize: 14, fontWeight: '600' }}>+ New</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.albumGrid}>
              {userAlbums.map((album) => (
                <TouchableOpacity
                  key={album._id}
                  activeOpacity={0.85}
                  onPress={() => nav(`/album/user/${album._id}`)}
                  onLongPress={() => openShareModal(album)}
                  delayLongPress={400}
                  style={[styles.albumCard, { backgroundColor: cardBg }]}
                >
                  {album.photos.length > 0 ? (
                    <CoverMosaic covers={album.photos} size="half" />
                  ) : (
                    <View style={[styles.albumCoverEmpty, { backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea' }]}>
                      <Ionicons name="images-outline" size={28} color={textSecondary} />
                    </View>
                  )}
                  <View style={styles.albumCardFooter}>
                    <Text style={[styles.albumCardTitle, { color: textPrimary }]} numberOfLines={1}>{album.name}</Text>
                    <View style={styles.albumCardRight}>
                      <Text style={[styles.albumCardCount, { color: textSecondary }]}>{album.photos.length}</Text>
                      {album.isPublic && (
                        <Ionicons name="link-outline" size={13} color="#007AFF" style={{ marginLeft: 5 }} />
                      )}
                    </View>
                  </View>
                  {/* Share button */}
                  <TouchableOpacity
                    style={[styles.shareBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
                    onPress={() => openShareModal(album)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="share-outline" size={15} color={textPrimary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Utilities list ── */}
        <Animated.View entering={FadeInDown.duration(380).delay(200)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>More</Text>
          <View style={[styles.utilList, { backgroundColor: cardBg, borderColor: divider }]}>
            {utilityAlbums.map((item, idx) => (
              <View key={item.id}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => nav(item.route)} style={styles.utilRow}>
                  <View style={[styles.utilIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                    <Ionicons name={item.icon} size={18} color={textPrimary} />
                  </View>
                  <View style={styles.utilText}>
                    <Text style={[styles.utilTitle, { color: textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.utilSubtitle, { color: textSecondary }]}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={textSecondary} />
                </TouchableOpacity>
                {idx < utilityAlbums.length - 1 && (
                  <View style={[styles.utilDivider, { backgroundColor: divider, marginLeft: 56 }]} />
                )}
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Share Link Modal ── */}
      <Modal
        visible={!!shareModalAlbum}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalAlbum(null)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShareModalAlbum(null)}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
            <View style={styles.modalHandle} />
            
            {/* Share Tabs */}
            <View style={styles.shareTabs}>
              <TouchableOpacity
                style={[styles.shareTabBtn, shareTab === 'link' && styles.shareTabActive, { borderBottomColor: shareTab === 'link' ? '#007AFF' : 'transparent' }]}
                onPress={() => setShareTab('link')}
              >
                <Text style={[styles.shareTabText, { color: shareTab === 'link' ? '#007AFF' : textSecondary }]}>Public Link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareTabBtn, shareTab === 'email' && styles.shareTabActive, { borderBottomColor: shareTab === 'email' ? '#007AFF' : 'transparent' }]}
                onPress={() => setShareTab('email')}
              >
                <Text style={[styles.shareTabText, { color: shareTab === 'email' ? '#007AFF' : textSecondary }]}>Invite People</Text>
              </TouchableOpacity>
            </View>

            {shareTab === 'link' ? (
              <View style={{ gap: 16 }}>
                <Text style={[styles.modalSub, { color: textSecondary }]}>
                  {shareModalAlbum?.name} · {shareModalAlbum?.photos.length} photos
                </Text>
                
                {shareLink ? (
                  <>
                    <View style={[styles.linkBox, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}>
                      <Ionicons name="link-outline" size={16} color={textSecondary} style={{ marginRight: 8 }} />
                      <Text style={[styles.linkText, { color: textSecondary }]} numberOfLines={1}>{shareLink}</Text>
                    </View>
                    <View style={styles.shareActions}>
                      <TouchableOpacity style={[styles.shareActionBtn, { backgroundColor: '#007AFF' }]} onPress={handleNativeShare}>
                        <Ionicons name="share-outline" size={18} color="#fff" />
                        <Text style={[styles.shareActionText, { color: '#fff' }]}>Share</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.shareActionBtn, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]} onPress={handleCopyLink}>
                        <Ionicons name="copy-outline" size={18} color={textPrimary} />
                        <Text style={[styles.shareActionText, { color: textPrimary }]}>Copy Link</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.revokeBtn} onPress={() => handleRevokeLink(shareModalAlbum!)}>
                      <Text style={styles.revokeText}>Revoke Link</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.shareActionBtn, { backgroundColor: '#007AFF', paddingVertical: 16 }]}
                    onPress={() => shareModalAlbum && handleGenerateShareLink(shareModalAlbum)}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#fff" />
                    <Text style={[styles.shareActionText, { color: '#fff' }]}>Create Share Link</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                <Text style={[styles.modalSub, { color: textSecondary }]}>
                  Private sharing requires the person to have a CloudGallery account.
                </Text>
                <View style={[styles.inviteInputRow, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}>
                  <Ionicons name="mail-outline" size={18} color={textSecondary} style={{ marginLeft: 16, marginRight: 8 }} />
                  <TextInput
                    style={[styles.modalInput, { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }]}
                    placeholder="User's email address"
                    placeholderTextColor={textSecondary}
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary, { opacity: inviteEmail.trim() ? 1 : 0.5, borderRadius: 14 }]}
                  onPress={handleInvite}
                  disabled={!inviteEmail.trim()}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Send Invite</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── New Album Modal ── */}
      <Modal
        visible={newAlbumModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNewAlbumModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setNewAlbumModalVisible(false)}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#1c1c1e' : '#fff' }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: textPrimary }]}>New Album</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7', color: textPrimary }]}
              placeholder="Album name"
              placeholderTextColor={textSecondary}
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createNewAlbum}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7' }]}
                onPress={() => setNewAlbumModalVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, { opacity: newAlbumName.trim() ? 1 : 0.5 }]}
                onPress={createNewAlbum}
                disabled={!newAlbumName.trim()}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  section: {
    paddingHorizontal: 18,
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  peopleScrollContent: {
    paddingRight: 18,
    gap: 16,
  },
  personItem: {
    alignItems: 'center',
    width: 72,
  },
  personAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personImage: {
    width: '100%',
    height: '100%',
  },
  personName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  kicker: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 4 },
  avatarBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  recentsBannerWrap: { paddingHorizontal: 18, marginBottom: 28 },
  recentsBanner: { borderRadius: 20, overflow: 'hidden', height: 220 },
  mosaicFull: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  mosaicCellFull: { width: '50%', height: '50%' },
  mosaicHalf: { width: '100%', aspectRatio: 1, flexDirection: 'row', flexWrap: 'wrap' },
  mosaicCellHalf: { width: '50%', height: '50%' },
  recentsMeta: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  recentsTitle: { fontSize: 17, fontWeight: '700' },
  recentsSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 1 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },

  albumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  albumCard: { width: CARD_W, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  albumCoverEmpty: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  albumCardFooter: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  albumCardTitle: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 4 },
  albumCardRight: { flexDirection: 'row', alignItems: 'center' },
  albumCardCount: { fontSize: 13, fontWeight: '500' },
  shareBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  utilList: { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  utilRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  utilIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  utilText: { flex: 1 },
  utilTitle: { fontSize: 15, fontWeight: '600' },
  utilSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  utilDivider: { height: StyleSheet.hairlineWidth },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  modalSub: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: -6 },
  
  shareTabs: { flexDirection: 'row', marginBottom: 8 },
  shareTabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2 },
  shareTabActive: {},
  shareTabText: { fontSize: 15, fontWeight: '700' },
  
  inviteInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14 },
  
  linkBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  linkText: { flex: 1, fontSize: 13, fontWeight: '500' },
  shareActions: { flexDirection: 'row', gap: 12 },
  shareActionBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14 },
  shareActionText: { fontSize: 15, fontWeight: '700' },
  revokeBtn: { alignItems: 'center', paddingVertical: 8 },
  revokeText: { color: '#FF3B30', fontSize: 14, fontWeight: '600' },

  modalInput: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: '#007AFF' },
  modalBtnText: { fontSize: 16, fontWeight: '700' },
});
