import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { ThemeColors, spacing, fontSize, borderRadius } from '../theme';
import { Supplement } from '../types';
import { CheckIcon } from './Icons';

interface SupplementCardProps {
  supplement: Supplement;
  doses: boolean[];
  onToggleDose: (doseIndex: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
  colors: ThemeColors;
  // Linked supplements info
  linkedNames?: string[]; // names of linked supplements
  doseSources?: (string | null)[]; // source supplement ID per dose
  supplementNames?: Record<string, string>; // id -> name mapping for source labels
  // Reorder buttons. If both callbacks are omitted the column is not rendered.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export default function SupplementCard({
  supplement,
  doses,
  onToggleDose,
  onEdit,
  onDelete,
  disabled = false,
  colors,
  linkedNames,
  doseSources,
  supplementNames,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: SupplementCardProps) {
  const s = makeStyles(colors);
  const completedCount = doses.filter(Boolean).length;
  const allDone = completedCount === supplement.dosesPerDay;
  const swipeableRef = useRef<Swipeable>(null);

  const hasLinks = linkedNames && linkedNames.length > 0;

  // Get a short label for the source of a dose
  const getSourceLabel = (doseIndex: number): string | null => {
    if (!doseSources || !supplementNames) return null;
    const sourceId = doseSources[doseIndex];
    if (!sourceId) return null;
    // If the source is this supplement itself, show its own name
    const name = supplementNames[sourceId];
    return name || null;
  };

  const closeSwipeable = () => swipeableRef.current?.close();

  const renderRightActions = () => (
    <View style={s.swipeActions}>
      <RectButton
        style={[s.swipeAction, s.swipeEdit]}
        onPress={() => {
          closeSwipeable();
          onEdit();
        }}
      >
        <Text style={s.swipeActionText}>Edit</Text>
      </RectButton>
      <RectButton
        style={[s.swipeAction, s.swipeDelete]}
        onPress={() => {
          closeSwipeable();
          onDelete();
        }}
      >
        <Text style={s.swipeActionText}>Delete</Text>
      </RectButton>
    </View>
  );

  const showMoveButtons = !!(onMoveUp || onMoveDown);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
    <View style={[s.card, allDone && s.cardComplete]}>
      <View style={s.cardBody}>
        {/* Header row */}
        <View style={s.headerRow}>
          <View style={s.nameContainer}>
            <Text style={[s.name, allDone && s.nameComplete]}>
              {supplement.name}
            </Text>
            {hasLinks && (
              <Text style={s.linkedText}>
                Linked with {linkedNames!.join(', ')}
              </Text>
            )}
            {supplement.whenToTake ? (
              <Text style={s.whenText}>{supplement.whenToTake}</Text>
            ) : null}
          </View>
          <Text style={[s.countText, allDone && s.countComplete]}>
            {completedCount}/{supplement.dosesPerDay}
          </Text>
        </View>

        {/* Checkboxes */}
        <View style={s.checkboxRow}>
          {doses.map((checked, i) => {
            const sourceLabel = checked ? getSourceLabel(i) : null;
            return (
              <View key={i} style={s.checkboxContainer}>
                <TouchableOpacity
                  style={[
                    s.checkbox,
                    checked && s.checkboxChecked,
                  ]}
                  onPress={() => !disabled && onToggleDose(i)}
                  activeOpacity={0.6}
                  disabled={disabled}
                >
                  {checked && <CheckIcon size={16} color="#FFFFFF" strokeWidth={3} />}
                </TouchableOpacity>
                {sourceLabel && hasLinks && (
                  <Text style={s.sourceLabel} numberOfLines={1}>
                    {sourceLabel}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {allDone && (
          <View style={s.completeBadge}>
            <Text style={s.completeBadgeText}>All taken!</Text>
          </View>
        )}
      </View>

      {showMoveButtons && (
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
      )}
    </View>
    </Swipeable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    cardComplete: {
      borderLeftColor: colors.success,
      backgroundColor: colors.successLight,
    },
    cardBody: {
      flex: 1,
    },
    // Right-side reorder column. Two stacked arrow buttons, vertically distributed.
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
      color: colors.primary,
      lineHeight: 16,
    },
    moveArrowDisabled: {
      color: colors.textSubtle,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    nameContainer: {
      flex: 1,
    },
    name: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: colors.text,
    },
    nameComplete: {
      color: colors.success,
    },
    linkedText: {
      fontSize: fontSize.sm,
      color: '#7C3AED',
      fontWeight: '500',
      marginTop: 2,
    },
    whenText: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    countText: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.primary,
    },
    countComplete: {
      color: colors.success,
    },
    checkboxRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    checkboxContainer: {
      alignItems: 'center',
      gap: 2,
    },
    checkbox: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.sm,
      borderWidth: 2,
      borderColor: colors.checkboxEmpty,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    checkboxChecked: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    sourceLabel: {
      fontSize: 9,
      color: colors.textSubtle,
      fontWeight: '600',
      maxWidth: 44,
      textAlign: 'center',
    },
    completeBadge: {
      marginTop: spacing.sm,
      backgroundColor: colors.successLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      alignSelf: 'flex-start',
    },
    completeBadgeText: {
      color: colors.success,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    swipeActions: {
      flexDirection: 'row',
      marginBottom: spacing.sm,
    },
    swipeAction: {
      width: 72,
      justifyContent: 'center',
      alignItems: 'center',
    },
    swipeEdit: {
      backgroundColor: colors.primary,
    },
    swipeDelete: {
      backgroundColor: colors.danger,
      borderTopRightRadius: borderRadius.md,
      borderBottomRightRadius: borderRadius.md,
    },
    swipeActionText: {
      color: '#FFFFFF',
      fontSize: fontSize.md,
      fontWeight: '700',
    },
  });
}
