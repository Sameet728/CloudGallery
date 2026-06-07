import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function RegisterScreen() {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const controlWidth = Math.max(244, Math.min(width - 110, 280));
  const cardWidth = controlWidth + 36;
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const setGuestMode = useAuthStore((state) => state.setGuestMode);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', { username, email, password });
      await login(response.data.token, response.data);
    } catch (error: any) {
      Alert.alert('Registration Failed', error.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top + 18 }]}
    >
      <StatusBar style="light" backgroundColor="transparent" translucent />

      <Image
        placeholder="LKO2?U%2Tw=w]~RBVZRi};RPxuwH"
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.2)' }]} />

      <View style={styles.hero}>
        <BlurView intensity={78} tint={isDark ? 'dark' : 'light'} style={styles.logoBubble}>
          <Ionicons name="sparkles-outline" size={32} color={isDark ? '#fff' : '#000'} />
        </BlurView>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: isDark ? '#aaa' : '#595959' }]}>CloudGallery</Text>
      </View>

      <BlurView intensity={85} tint={isDark ? 'dark' : 'light'} style={[styles.authCard, { width: cardWidth }]}>
        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.input, { width: controlWidth, color: isDark ? '#fff' : '#000', backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
            placeholder="Username"
            placeholderTextColor={isDark ? '#8d8d8d' : '#686868'}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={[styles.input, { width: controlWidth, color: isDark ? '#fff' : '#000', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            placeholder="Email"
            placeholderTextColor={isDark ? '#8d8d8d' : '#686868'}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={[styles.input, { width: controlWidth, color: isDark ? '#fff' : '#000', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            placeholder="Password"
            placeholderTextColor={isDark ? '#8d8d8d' : '#686868'}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.btnWrapper, { width: controlWidth }]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.86}
        >
          <BlurView intensity={65} tint={isDark ? 'light' : 'dark'} style={styles.primaryButton}>
            {loading ? <ActivityIndicator color={isDark ? '#000' : '#fff'} /> : <Text style={[styles.primaryText, { color: isDark ? '#000' : '#fff' }]}>Sign Up</Text>}
          </BlurView>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btnWrapper, { width: controlWidth, marginTop: 12 }]} onPress={() => router.back()} activeOpacity={0.84}>
          <BlurView intensity={35} tint={isDark ? 'light' : 'dark'} style={styles.secondaryButton}>
            <Text style={[styles.secondaryText, { color: isDark ? '#000' : '#fff' }]}>Login</Text>
          </BlurView>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btnWrapper, { width: controlWidth, marginTop: 12 }]} onPress={setGuestMode} activeOpacity={0.84}>
          <BlurView intensity={35} tint={isDark ? 'light' : 'dark'} style={styles.secondaryButton}>
            <Text style={[styles.guestText, { color: isDark ? '#000' : '#fff' }]}>View local photos</Text>
          </BlurView>
        </TouchableOpacity>
      </BlurView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'stretch',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 26,
  },
  logoBubble: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    height: 68,
    justifyContent: 'center',
    marginBottom: 18,
    overflow: 'hidden',
    width: 68,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 44,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },
  authCard: {
    alignSelf: 'center',
    maxWidth: 430,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 18,
  },
  inputGroup: {
    gap: 10,
    marginBottom: 16,
  },
  input: {
    alignSelf: 'stretch',
    borderRadius: 22,
    fontSize: 16,
    fontWeight: '800',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  btnWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '900',
  },
  guestText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
