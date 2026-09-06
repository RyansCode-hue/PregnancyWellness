import React, { useRef, useState, useMemo } from 'react';
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
import {
  DAY_NAMES_SHORT,
  parseDate,
  formatDate,
  getWorkoutSessions,
  getWorkoutDayTarget,
} from '../storage/storage';
import { CheckIcon, NotesIcon, ChevronUpIcon } from './Icons';
import ReorderColumn from './ReorderColumn';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatLastDone(dateStr: string): string {
  const today = parseDate(formatDate(new Date()));
  const date = parseDate(dateStr);
  const days = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weekday = DAY_NAMES_SHORT[date.getDay()];
  const sameYear = date.getFullYear() === today.getFullYear();
  const tail = sameYear ? '' : `, ${date.getFullYear()}`;
  return `${weekday}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}${tail}`;
}

interface WorkoutCardProps {
  workout: Workout;
  record: WorkoutDayRecord[string] | undefined;
  onSaveNotes: (notes: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
  colors: ThemeColors;
  /** For 'weekly' frequency: total sessions logged this week (Mon-Sun). */
  weekCount?: number;
  /** Log one more session for this day (empty circle / unchecked box tapped). */
  onIncrementSession: () => void;
  /** Remove one of this day's sessions (filled circle / checked box tapped). */
  onDecrementSession: () => void;
  /** For 'weekly' frequency: most recent date this workout was logged (YYYY-MM-DD). */
  lastCompletedDate?: string;
  // Reorder buttons. If both callbacks are omitted the column is not rendered.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export default function WorkoutCard({
  workout,
  record,
  onSaveNotes,
  onEdit,
  onDelete,
  disabled = false,
  colors,
  weekCount,
  onIncrementSession,
  onDecrementSession,
  lastCompletedDate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: WorkoutCardProps) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const todaySessions = getWorkoutSessions(record);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(record?.notes || '');
  const swipeableRef = useRef<Swipeable>(null);

  const isGoal = workout.frequency === 'weekly';
  const dayTarget = getWorkoutDayTarget(workout);
  // Weekly-goal circles show the whole week's sessions; day workouts show today's.
  const circleCount = isGoal ? workout.weeklyGoal ?? 1 : dayTarget;
  const filledCount = Math.min(isGoal ? weekCount ?? 0 : todaySessions, circleCount);
  const goalMet = isGoal && (weekCount ?? 0) >= circleCount;
  // For goal workouts, the card is "complete" only when the whole weekly goal is met,
  // not when a single day has been logged. Day workouts need today's target reached.
  const isCardComplete = isGoal ? goalMet : todaySessions >= dayTarget;
  // A single-session day workout uses one big checkbox; anything else uses circles.
  const showCircles = isGoal || dayTarget > 1;

  const assignedLabel = workout.assignedDays.map((d) => DAY_NAMES_SHORT[d]).join(', ');
  const daysLabel = isGoal
    ? `${weekCount ?? 0} of ${circleCount} this week`
    : dayTarget > 1
      ? `${assignedLabel} · ${Math.min(todaySessions, dayTarget)} of ${dayTarget} today`
      : assignedLabel;

  const handleToggleNotes = () => {
    if (showNotes && notes !== (record?.notes || '')) {
      onSaveNotes(notes);
    }
    setShowNotes(!showNotes);
  };

  // Tap an empty circle to log a new session today. Tap a filled circle to remove
  // one session from today. For weekly goals the filled circles may belong to other
  // days of the week; those cannot be removed from here, so the tap is ignored.
  const handleCirclePress = (boxIndex: number) => {
    if (disabled) return;
    if (boxIndex < filledCount) {
      if (todaySessions > 0) onDecrementSession();
    } else {
      onIncrementSession();
    }
  };

  const handleCheckboxPress = () => {
    if (disabled) return;
    if (todaySessions > 0) onDecrementSession();
    else onIncrementSession();
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
      <View style={s.cardBody}>
      <View style={s.topRow}>
        {/* Checkbox — single big one for once-a-day workouts */}
        {!showCircles && (
          <TouchableOpacity
            style={[s.checkbox, isCardComplete && s.checkboxChecked]}
            onPress={handleCheckboxPress}
            activeOpacity={0.6}
            disabled={disabled}
          >
            {isCardComplete && <CheckIcon size={22} color="#FFFFFF" strokeWidth={3} />}
          </TouchableOpacity>
        )}

        {/* Info */}
        <View style={s.info}>
          <Text style={[s.name, isCardComplete && s.nameComplete]}>
            {workout.name}
          </Text>
          {isGoal && lastCompletedDate && (
            <Text style={s.lastDoneText}>
              Last done: {formatLastDone(lastCompletedDate)}
            </Text>
          )}
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

      {/* Per-session circles: the week's sessions for goals, today's for multi-session days */}
      {showCircles && (
        <View style={s.goalCheckboxRow}>
          {Array.from({ length: circleCount }).map((_, i) => {
            const isFilled = i < filledCount;
            return (
              <TouchableOpacity
                key={i}
                style={[s.goalCheckbox, isFilled && s.checkboxChecked]}
                onPress={() => handleCirclePress(i)}
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

      <ReorderColumn
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        colors={colors}
        accentColor={'#F59E0B'}
      />
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
      borderLeftColor: '#F59E0B', // amber for workouts
    },
    cardComplete: {
      borderLeftColor: colors.success,
      backgroundColor: colors.successLight,
    },
    cardBody: {
      flex: 1,
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
    lastDoneText: {
      fontSize: fontSize.sm,
      color: colors.primary,
      fontWeight: '600',
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
