import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { ThemeColors, spacing, fontSize, borderRadius } from '../theme';
import { Workout, WorkoutDayRecord } from '../types';
import { DAY_NAMES_SHORT } from '../storage/storage';
import { CheckIcon, NotesIcon, ChevronUpIcon } from './Icons';

interface WorkoutCardProps {
  workout: Workout;
  record: WorkoutDayRecord[string] | undefined;
  onToggle: () => void;
  onSaveNotes: (notes: string) => void;
  onLongPress: () => void;
  disabled?: boolean;
  colors: ThemeColors;
  /** For 'weekly' frequency: completed count this week (Mon-Sun). */
  weekCount?: number;
}

export default function WorkoutCard({
  workout,
  record,
  onToggle,
  onSaveNotes,
  onLongPress,
  disabled = false,
  colors,
  weekCount,
}: WorkoutCardProps) {
  const s = makeStyles(colors);
  const completed = record?.completed || false;
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(record?.notes || '');

  const isGoal = workout.frequency === 'weekly';
  const goal = workout.weeklyGoal ?? 1;
  const goalMet = isGoal && (weekCount ?? 0) >= goal;

  const daysLabel = isGoal
    ? `${weekCount ?? 0} of ${goal} this week`
    : workout.assignedDays.map((d) => DAY_NAMES_SHORT[d]).join(', ');

  const handleToggleNotes = () => {
    if (showNotes && notes !== (record?.notes || '')) {
      onSaveNotes(notes);
    }
    setShowNotes(!showNotes);
  };

  return (
    <TouchableOpacity
      style={[s.card, (completed || goalMet) && s.cardComplete]}
      onLongPress={onLongPress}
      activeOpacity={0.9}
      delayLongPress={500}
    >
      <View style={s.topRow}>
        {/* Checkbox */}
        <TouchableOpacity
          style={[s.checkbox, completed && s.checkboxChecked]}
          onPress={() => !disabled && onToggle()}
          activeOpacity={0.6}
          disabled={disabled}
        >
          {completed && <CheckIcon size={22} color="#FFFFFF" strokeWidth={3} />}
        </TouchableOpacity>

        {/* Info */}
        <View style={s.info}>
          <Text style={[s.name, completed && s.nameComplete]}>
            {workout.name}
          </Text>
          <Text style={s.daysText}>{daysLabel}</Text>
        </View>

        {/* Notes toggle */}
        {!disabled && (
          <TouchableOpacity style={s.notesToggle} onPress={handleToggleNotes}>
            {showNotes ? (
              <ChevronUpIcon size={16} color={colors.textSubtle} strokeWidth={2} />
            ) : (
              <NotesIcon size={16} color={colors.textSubtle} strokeWidth={2} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Notes input */}
      {showNotes && !disabled && (
        <View style={s.notesContainer}>
          <TextInput
            style={s.notesInput}
            placeholder="How did it go? Any modifications?"
            placeholderTextColor={colors.checkboxEmpty}
            value={notes}
            onChangeText={setNotes}
            onBlur={() => onSaveNotes(notes)}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      )}

      {/* Show saved notes (read-only view) */}
      {!showNotes && record?.notes ? (
        <Text style={s.savedNotes} numberOfLines={2}>
          {record.notes}
        </Text>
      ) : null}

      {(completed || goalMet) && (
        <View style={s.completeBadge}>
          <Text style={s.completeBadgeText}>
            {goalMet && !completed ? 'Goal reached!' : 'Done!'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
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
      borderLeftColor: '#F59E0B', // amber for workouts
    },
    cardComplete: {
      borderLeftColor: colors.success,
      backgroundColor: colors.successLight,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    checkbox: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      borderWidth: 2.5,
      borderColor: '#F59E0B',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    checkboxChecked: {
      backgroundColor: colors.success,
      borderColor: colors.success,
    },
    checkmarkIcon: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
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
    daysText: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    notesToggle: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notesContainer: {
      marginTop: spacing.sm,
    },
    notesInput: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      fontSize: fontSize.md,
      color: colors.text,
      minHeight: 72,
    },
    savedNotes: {
      marginTop: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontStyle: 'italic',
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
  });
}
