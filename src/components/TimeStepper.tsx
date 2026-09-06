import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemeColors, spacing, fontSize, borderRadius } from '../theme';

export interface ClockTime {
  hour: number; // 0-23
  minute: number; // 0-59
}

interface TimeStepperProps {
  value: ClockTime;
  onChange: (next: ClockTime) => void;
  colors: ThemeColors;
  /** Minutes per tap on the minute stepper. */
  minuteStep?: number;
}

// Convert a 12-hour value (1..12) + AM/PM back to 0..23
function to24(h12: number, pm: boolean): number {
  const base = h12 % 12; // 12 → 0, 1..11 → 1..11
  return pm ? base + 12 : base;
}

// Compact "H : MM  AM·PM" stepper. Hours cycle 1..12 preserving AM/PM; minutes wrap
// within the hour rather than rolling the hour over.
export default function TimeStepper({ value, onChange, colors, minuteStep = 5 }: TimeStepperProps) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const isPM = value.hour >= 12;
  const hour12 = ((value.hour + 11) % 12) + 1; // 1..12

  const bumpHour = (delta: number) => {
    const nextH12 = ((hour12 - 1 + delta + 12) % 12) + 1;
    onChange({ ...value, hour: to24(nextH12, isPM) });
  };
  const toggleAmPm = () => onChange({ ...value, hour: (value.hour + 12) % 24 });
  const bumpMinute = (delta: number) => {
    onChange({ ...value, minute: ((value.minute + delta) % 60 + 60) % 60 });
  };

  return (
    <View style={s.row}>
      <Stepper value={hour12} onMinus={() => bumpHour(-1)} onPlus={() => bumpHour(1)} s={s} />
      <Text style={s.colon}>:</Text>
      <Stepper
        value={String(value.minute).padStart(2, '0')}
        onMinus={() => bumpMinute(-minuteStep)}
        onPlus={() => bumpMinute(minuteStep)}
        s={s}
      />
      <TouchableOpacity style={s.ampmBtn} onPress={toggleAmPm} activeOpacity={0.7}>
        <Text style={[s.ampmText, !isPM && s.ampmTextActive]}>AM</Text>
        <Text style={s.ampmDivider}>·</Text>
        <Text style={[s.ampmText, isPM && s.ampmTextActive]}>PM</Text>
      </TouchableOpacity>
    </View>
  );
}

function Stepper({
  value,
  onMinus,
  onPlus,
  s,
}: {
  value: number | string;
  onMinus: () => void;
  onPlus: () => void;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.group}>
      <TouchableOpacity style={s.stepBtn} onPress={onMinus} activeOpacity={0.7}>
        <Text style={s.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={s.stepValue}>{value}</Text>
      <TouchableOpacity style={s.stepBtn} onPress={onPlus} activeOpacity={0.7}>
        <Text style={s.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    group: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 2,
    },
    stepBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.primary,
    },
    stepValue: {
      minWidth: 28,
      textAlign: 'center',
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    colon: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
      marginHorizontal: 2,
    },
    ampmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm - 2,
      backgroundColor: colors.card,
      borderRadius: borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginLeft: spacing.xs,
    },
    ampmText: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: colors.textSubtle,
    },
    ampmTextActive: {
      color: colors.primary,
    },
    ampmDivider: {
      marginHorizontal: 4,
      color: colors.textSubtle,
    },
  });
}
