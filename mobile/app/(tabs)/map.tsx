import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, useColorScheme, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/useAuthStore';
import * as Location from 'expo-location';
import { usePhotoStore } from '../../src/store/usePhotoStore';

type PhotoLocation = {
  _id: string;
  location: { latitude: number; longitude: number };
  blurhash?: string;
};

export default function MapScreen() {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, isGuest } = useAuthStore();
  
  const [locations, setLocations] = useState<PhotoLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }

    const fetchLocations = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }

        const response = await api.get('/photos/locations');
        setLocations(response.data);
      } catch (e) {
        console.error('Failed to fetch locations', e);
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, [isGuest]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#000' : '#fff' }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const initialRegion = userLocation ? {
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  } : {
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <MapView 
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        userInterfaceStyle={isDark ? 'dark' : 'light'}
      >
        {locations.map(photo => (
          <Marker
            key={photo._id}
            coordinate={photo.location}
            onPress={() => {
              // Can navigate to photo
              router.push(`/photo/${photo._id}`);
            }}
          >
            <View style={styles.markerContainer}>
              <Image 
                source={`${api.defaults.baseURL}/photos/${photo._id}/url?resolution=thumbnail&token=${token}`}
                style={styles.markerImage}
                placeholder={photo.blurhash}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Places</Text>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    width: '100%',
    paddingBottom: 15,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#ddd',
  },
  markerImage: {
    width: '100%',
    height: '100%',
  },
});
