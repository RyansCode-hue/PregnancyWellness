import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import {
  PillIcon,
  CalendarIcon,
  HeartIcon,
  GearIcon,
  TimerIcon,
  BabyIcon,
} from './Icons';
import { RootStackParamList } from '../types';
import { setTabAnimationDirection } from '../navAnimation';
import { NavbarRoute, getEnabledTabs } from '../navTabs';

interface AppHeaderProps {
  activeRoute: NavbarRoute;
}

// Per-tab metadata (label + icon). Centralizing this avoids drift between the
// header buttons and the navigation order. The Contractions tab keeps the
// short label "Timer" because that's what users typed in the prior version.
type TabMeta = {
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  strokeWidth: number;
};

const TAB_META: Record<NavbarRoute, TabMeta> = {
  Calendar: { label: 'Calendar', Icon: CalendarIcon, strokeWidth: 2 },
  Labor: { label: 'Labor', Icon: HeartIcon, strokeWidth: 2 },
  Contractions: { label: 'Timer', Icon: TimerIcon, strokeWidth: 2 },
  Baby: { label: 'Baby', Icon: BabyIcon, strokeWidth: 2 },
  Settings: { label: 'Settings', Icon: GearIcon, strokeWidth: 1.8 },
};

export default function AppHeader({ activeRoute }: AppHeaderProps) {
  const { colors, settings } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const s = makeStyles(colors);

  // Visible left-to-right tab list, derived from the user's settings.
  const tabs = getEnabledTabs(settings.enabledTabs);

  // Reasonable Android fallback when SafeArea reports 0 — keep nav off the status bar.
  const topInset =
    insets.top > 0
      ? insets.top
      : Platform.OS === 'android'
        ? StatusBar.currentHeight ?? 24
        : 0;

  const goTo = (route: NavbarRoute) => {
    if (route === activeRoute) return;
    // Pick slide direction from the visible nav order so the new tab enters from
    // whichever side it sits on _right now_ (not the canonical full order, which
    // could disagree once tabs are hidden). Set this BEFORE navigate so the
    // Stack.Navigator's screenOptions reads the right value at render time.
    const currentIdx = tabs.indexOf(activeRoute);
    const nextIdx = tabs.indexOf(route);
    setTabAnimationDirection(nextIdx > currentIdx ? 'slide_from_right' : 'slide_from_left');
    navigation.navigate(route);
  };

  return (
    <View style={[s.wrapper, { paddingTop: topInset }]}>
      {/* Title row */}
      <View style={s.titleRow}>
        <PillIcon size={28} color={colors.primary} />
        <View>
          <Text style={s.title}>Pregnancy Wellness</Text>
          <Text style={s.subtitle}>Supplement + Workout Tracker</Text>
        </View>
      </View>

      {/* Nav row — five tabs fit comfortably with flex:1 on phone widths. */}
      <View style={s.navRow}>
        {tabs.map((route) => {
          const meta = TAB_META[route];
          const Icon = meta.Icon;
          const active = activeRoute === route;
          return (
            <NavButton
              key={route}
              label={meta.label}
              active={active}
              onPress={() => goTo(route)}
              colors={colors}
            >
              <Icon
                size={20}
                color={active ? colors.primary : colors.textSubtle}
                strokeWidth={meta.strokeWidth}
              />
            </NavButton>
          );
        })}
      </View>
    </View>
  );
}

function NavButton({
  label,
  active,
  onPress,
  children,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  const s = makeStyles(colors);
  return (
    <TouchableOpacity
      style={[s.navButton, active && s.navButtonActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {children}
      <Text style={[s.navLabel, active && s.navLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    title: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    navRow: {
      flexDirection: 'row',
      // Tightened from spacing.md → spacing.sm so 5 labels don't clip on a 360px device.
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.sm,
      gap: spacing.xs,
    },
    navButton: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: spacing.sm,
      paddingHorizontal: 2,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background,
    },
    navButtonActive: {
      backgroundColor: colors.primaryLight,
    },
    navLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    navLabelActive: {
      color: colors.primary,
    },
  });
}
