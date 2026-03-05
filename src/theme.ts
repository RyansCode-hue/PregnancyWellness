export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  background: string;
  card: string;
  success: string;
  successLight: string;
  danger: string;
  dangerLight: string;
  text: string;
  textSubtle: string;
  border: string;
  checkboxEmpty: string;
  overlay: string;
}

export const lightColors: ThemeColors = {
  primary: '#0D9488',
  primaryLight: '#99F6E4',
  primaryDark: '#0F766E',
  background: '#FFFFFF',
  card: '#FFFFFF',
  success: '#16A34A',
  successLight: '#DCFCE7',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  text: '#1E293B',
  textSubtle: '#64748B',
  border: '#E2E8F0',
  checkboxEmpty: '#CBD5E1',
  overlay: 'rgba(0,0,0,0.5)',
};

export const darkColors: ThemeColors = {
  primary: '#2DD4BF',
  primaryLight: '#134E4A',
  primaryDark: '#5EEAD4',
  background: '#0F172A',
  card: '#1E293B',
  success: '#4ADE80',
  successLight: '#14532D',
  danger: '#F87171',
  dangerLight: '#7F1D1D',
  text: '#F1F5F9',
  textSubtle: '#94A3B8',
  border: '#334155',
  checkboxEmpty: '#475569',
  overlay: 'rgba(0,0,0,0.7)',
};

// Default export for backwards compat
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const fontSize = {
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
};
