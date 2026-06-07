export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
};

export const radius = {
  xs: 8,
  s: 12,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 32,
  round: 9999,
};

export const colors = {
  light: {
    background: '#f7f7f7',
    surface: '#ffffff',
    surfaceSecondary: '#f2f2f7',
    textPrimary: '#000000',
    textSecondary: '#6c6c70',
    textMuted: '#aaa',
    primary: '#007AFF',
    destructive: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
    border: 'rgba(0,0,0,0.08)',
    overlay: 'rgba(255,255,255,0.7)',
    iconBg: 'rgba(0,0,0,0.06)',
  },
  dark: {
    background: '#050505',
    surface: '#1c1c1e',
    surfaceSecondary: '#2c2c2e',
    textPrimary: '#ffffff',
    textSecondary: '#8e8e93',
    textMuted: '#555',
    primary: '#0A84FF',
    destructive: '#FF453A',
    success: '#30D158',
    warning: '#FF9F0A',
    border: 'rgba(255,255,255,0.08)',
    overlay: 'rgba(0,0,0,0.7)',
    iconBg: 'rgba(255,255,255,0.1)',
  }
};

export const typography = {
  display: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  heading: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '400', letterSpacing: 0 },
  bodySemibold: { fontSize: 16, fontWeight: '600', letterSpacing: 0 },
  caption: { fontSize: 13, fontWeight: '500', letterSpacing: 0.1 },
  small: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
} as const;
