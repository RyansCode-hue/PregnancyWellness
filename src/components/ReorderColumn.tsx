import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemeColors, spacing, borderRadius } from '../theme';

interface ReorderColumnProps {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  colors: ThemeColors;
  /** Arrow color; matches the card's accent (primary for supplements, amber for workouts). */
  accentColor: string;
}

// Right-side column of two stacked arrow buttons used by the list cards. Renders
// nothing when neither callback is provided (e.g. read-only future dates).
export default function ReorderColumn({
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  colors,
  accentColor,
}: ReorderColumnProps) {
  const s = useMemo(() => makeStyles(colors, accentColor), [colors, accentColor]);
  if (!onMoveUp && !onMoveDown) return null;
  return (
    <View style={s.moveCol}>
      <TouchableOpacity
        style={[s.moveBtn, !canMoveUp && s.moveBtnDisabled]}
        onPress={onMoveUp}
        disabled={!canMoveUp || !onMoveUp}
        activeOpacity={0.5}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Text style={[s.moveArrow, !canMoveUp && s.moveArrowDisabled]}>▲</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.moveBtn, !canMoveDown && s.moveBtnDisabled]}
        onPress={onMoveDown}
        disabled={!canMoveDown || !onMoveDown}
        activeOpacity={0.5}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Text style={[s.moveArrow, !canMoveDown && s.moveArrowDisabled]}>▼</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ThemeColors, accentColor: string) {
  return StyleSheet.create({
    moveCol: {
      width: 32,
      marginLeft: spacing.sm,
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 2,
    },
    moveBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.sm,
    },
    moveBtnDisabled: {
      opacity: 0.35,
    },
    moveArrow: {
      fontSize: 14,
      fontWeight: '700',
      color: accentColor,
      lineHeight: 16,
    },
    moveArrowDisabled: {
      color: colors.textSubtle,
    },
  });
}
