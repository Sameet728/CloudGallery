import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, typography } from '../theme/theme';

export function EmptyState({ icon, title, description, style }: { icon: keyof typeof Ionicons.glyphMap; title: string; description?: string; style?: any }) {
  const isDark = (useColorScheme() ?? 'dark') === 'dark';
  const themeColors = isDark ? colors.dark : colors.light;

  return (
    <Animated.View entering={FadeInDown.duration(400).springify()} style={[styles.container, style]}>
      <View style={[styles.iconContainer, { backgroundColor: themeColors.iconBg }]}>
        <Ionicons name={icon} size={48} color={themeColors.textSecondary} />
      </View>
      <Text style={[styles.title, { color: themeColors.textPrimary }]}>{title}</Text>
      {description && <Text style={[styles.description, { color: themeColors.textSecondary }]}>{description}</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.l,
  },
  title: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    letterSpacing: typography.heading.letterSpacing,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    textAlign: 'center',
    maxWidth: 280,
  },
});
