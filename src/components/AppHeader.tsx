import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import { PillIcon, CalendarIcon, HeartIcon, GearIcon, TimerIcon } from './Icons';
import { RootStackParamList } from '../types';
import { setTabAnimationDirection } from '../navAnimation';

type NavbarRoute = 'Calendar' | 'Labor' | 'Contractions' | 'Settings';

const ORDER: NavbarRoute[] = ['Calendar', 'Labor', 'Contractions', 'Settings'];

interface AppHeaderProps {
  activeRoute: NavbarRoute;
}

export default function AppHeader({ activeRoute }: AppHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const s = makeStyles(colors);

  // Reasonable Android fallback when SafeArea reports 0 — keep nav off the status bar.
  const topInset =
    insets.top > 0
      ? insets.top
      : Platform.OS === 'android'
        ? StatusBar.currentHeight ?? 24
        : 0;

  const goTo = (route: NavbarRoute) => {
    if (route === activeRoute) return;
    // Pick slide direction from the navbar's left-to-right order so the new
    // tab enters from whichever side it sits on. Set this BEFORE navigate so
    // the Stack.Navigator's screenOptions reads the right value at render time.
    const currentIdx = ORDER.indexOf(activeRoute);
    const nextIdx = ORDER.indexOf(route);
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

      {/* Nav row */}
      <View style={s.navRow}>
        <NavButton
          label="Calendar"
          active={activeRoute === 'Calendar'}
          onPress={() => goTo('Calendar')}
          colors={colors}
        >
          <CalendarIcon
            size={20}
            color={activeRoute === 'Calendar' ? colors.primary : colors.textSubtle}
            strokeWidth={2}
          />
        </NavButton>

        <NavButton
          label="Labor"
          active={activeRoute === 'Labor'}
          onPress={() => goTo('Labor')}
          colors={colors}
        >
          <HeartIcon
            size={20}
            color={activeRoute === 'Labor' ? colors.primary : colors.textSubtle}
            strokeWidth={2}
          />
        </NavButton>

        <NavButton
          label="Timer"
          active={activeRoute === 'Contractions'}
          onPress={() => goTo('Contractions')}
          colors={colors}
        >
          <TimerIcon
            size={20}
            color={activeRoute === 'Contractions' ? colors.primary : colors.textSubtle}
            strokeWidth={2}
          />
        </NavButton>

        <NavButton
          label="Settings"
          active={activeRoute === 'Settings'}
          onPress={() => goTo('Settings')}
          colors={colors}
        >
          <GearIcon
            size={20}
            color={activeRoute === 'Settings' ? colors.primary : colors.textSubtle}
            strokeWidth={1.8}
          />
        </NavButton>
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
      <Text style={[s.navLabel, active && s.navLabelActive]}>{label}</Text>
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
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    navButton: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: spacing.sm,
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
