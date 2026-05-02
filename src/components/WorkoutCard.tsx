import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { ThemeColors, spacing, fontSize, borderRadius } from '../theme';
import { Workout, WorkoutDayRecord } from '../types';
import { DAY_NAMES_SHORT } from '../storage/storage';
import { CheckIcon, NotesIcon, ChevronUpIcon } from './Icons';

interface WorkoutCardProps {
  workout: Workout;
  record: WorkoutDayRecord[string] | undefined;
  onToggle: () => void;
  onSaveNotes: (notes: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
  colors: ThemeColors;
  /** For 'weekly' frequency: total sessions logged this week (Mon-Sun). */
  weekCount?: number;
  /** For 'weekly' frequency: tapping an empty circle bumps today's count. */
  onIncrementSession?: () => void;
  /** For 'weekly' frequency: tapping a filled circle removes one from today. */
  onDecrementSession?: () => void;
}

export default function WorkoutCard({
  workout,
  record,
  onToggle,
  onSaveNotes,
  onEdit,
  onDelete,
  disabled = false,
  colors,
  weekCount,
  onIncrementSession,
  onDecrementSession,
}: WorkoutCardProps) {
  const s = makeStyles(colors);
  const completed = record?.completed || false;
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(record?.notes || '');
  const swipeableRef = useRef<Swipeable>(null);

  const isGoal = workout.frequency === 'weekly';
  const goal = workout.weeklyGoal ?? 1;
  const filledCount = Math.min(weekCount ?? 0, goal);
  const goalMet = isGoal && (weekCount ?? 0) >= goal;
  // For goal workouts, the card is "complete" only when the whole weekly goal is met,
  // not when a single day has been logged. For day workouts, today's completion is enough.
  const isCardComplete = isGoal ? goalMet : completed;

  const daysLabel = isGoal
    ? `${weekCount ?? 0} of ${goal} this week`
    : workout.assignedDays.map((d) => DAY_NAMES_SHORT[d]).join(', ');

  const handleToggleNotes = () => {
    if (showNotes && notes !== (record?.notes || '')) {
      onSaveNotes(notes);
    }
    setShowNotes(!showNotes);
  };

  // Tap an empty circle to log a new session today. Tap a filled circle to
  // remove one session from today (floor at 0). Lets you stack multiple
  // sessions on the same day or spread them across the week.
  const handleGoalBoxPress = (boxIndex: number) => {
    if (disabled) return;
    if (boxIndex < filledCount) {
      onDecrementSession?.();
    } else {
      onIncrementSession?.();
    }
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

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View style={[s.card, isCardComplete && s.cardComplete]}>
      <View style={s.topRow}>
        {/* Checkbox — single big one for day-assigned workouts only */}
        {!isGoal && (
          <TouchableOpacity
            style={[s.checkbox, completed && s.checkboxChecked]}
            onPress={() => !disabled && onToggle()}
            activeOpacity={0.6}
            disabled={disabled}
          >
            {completed && <CheckIcon size={22} color="#FFFFFF" strokeWidth={3} />}
          </TouchableOpacity>
        )}

        {/* Info */}
        <View style={s.info}>
          <Text style={[s.name, isCardComplete && s.nameComplete]}>
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

      {/* Per-session checkboxes for weekly-goal workouts */}
      {isGoal && (
        <View style={s.goalCheckboxRow}>
          {Array.from({ length: goal }).map((_, i) => {
            const isFilled = i < filledCount;
            return (
              <TouchableOpacity
                key={i}
                style={[s.goalCheckbox, isFilled && s.checkboxChecked]}
                onPress={() => handleGoalBoxPress(i)}
                activeOpacity={0.6}
                disabled={disabled}
              >
                {isFilled && <CheckIcon size={18} color="#FFFFFF" strokeWidth={3} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

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

      {isCardComplete && (
        <View style={s.completeBadge}>
          <Text style={s.completeBadgeText}>
            {goalMet ? 'Goal reached!' : 'Done!'}
          </Text>
        </View>
      )}
      </View>
    </Swipeable>
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
    goalCheckboxRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    goalCheckbox: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      borderWidth: 2.5,
      borderColor: '#F59E0B',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    goalCheckboxToday: {
      borderColor: colors.success,
      borderWidth: 3,
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
