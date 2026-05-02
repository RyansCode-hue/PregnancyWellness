import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ThemeColors, spacing, fontSize, borderRadius } from '../theme';
import { formatDate, DayCombinedStatus } from '../storage/storage';
import { PillIcon, DumbbellIcon, CheckIcon, XIcon } from './Icons';

const CELL_HEIGHT = 59;

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface CalendarGridProps {
  year: number;
  month: number;
  statuses: Record<string, DayCombinedStatus>;
  onDayPress: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  colors: ThemeColors;
}

function StatusIcon({
  type,
  status,
  colors,
}: {
  type: 'supplement' | 'workout';
  status: 'complete' | 'incomplete';
  colors: ThemeColors;
}) {
  const iconColor = status === 'complete' ? colors.success : colors.danger;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {type === 'supplement' ? (
        <PillIcon size={9} color={iconColor} strokeWidth={2} />
      ) : (
        <DumbbellIcon size={9} color={iconColor} strokeWidth={2} />
      )}
      {status === 'complete' ? (
        <CheckIcon size={7} color={iconColor} strokeWidth={3} />
      ) : (
        <XIcon size={7} color={iconColor} strokeWidth={3} />
      )}
    </View>
  );
}

export default function CalendarGrid({
  year,
  month,
  statuses,
  onDayPress,
  onPrevMonth,
  onNextMonth,
  colors,
}: CalendarGridProps) {
  const todayStr = formatDate(new Date());
  const s = makeStyles(colors);

  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const rows: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        rows.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      rows.push(currentWeek);
    }

    return rows;
  }, [year, month]);

  const canGoNext = () => {
    const today = new Date();
    return year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onPrevMonth} style={s.navButton}>
          <Text style={s.navText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={s.monthTitle}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity
          onPress={onNextMonth}
          style={[s.navButton, !canGoNext() && s.navDisabled]}
          disabled={!canGoNext()}
        >
          <Text style={[s.navText, !canGoNext() && s.navTextDisabled]}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.weekRow}>
        {DAYS_OF_WEEK.map((d) => (
          <View key={d} style={s.cell}>
            <Text style={s.dayOfWeekText}>{d}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={s.weekRow}>
          {week.map((day, di) => {
            if (day === null) {
              return <View key={di} style={s.cell} />;
            }

            const dateStr = formatDate(new Date(year, month, day));
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            const status = statuses[dateStr];

            const hasSup = status && status.supplement !== 'none';
            const hasWorkout = status && status.workout !== 'none';

            return (
              <TouchableOpacity
                key={di}
                style={[s.cell, isToday && s.todayCell]}
                onPress={() => onDayPress(dateStr)}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    s.dayText,
                    isToday && s.todayText,
                    isFuture && s.futureText,
                  ]}
                >
                  {day}
                </Text>
                {!isFuture && (hasSup || hasWorkout) && (
                  <View style={s.iconsRow}>
                    {hasSup && (
                      <StatusIcon
                        type="supplement"
                        status={status.supplement as 'complete' | 'incomplete'}
                        colors={colors}
                      />
                    )}
                    {hasWorkout && (
                      <StatusIcon
                        type="workout"
                        status={status.workout as 'complete' | 'incomplete'}
                        colors={colors}
                      />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.sm,
      marginBottom: spacing.md,
    },
    navButton: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    navDisabled: {
      opacity: 0.3,
    },
    navText: {
      fontSize: 28,
      color: colors.primary,
      fontWeight: '600',
      marginTop: -2,
    },
    navTextDisabled: {
      color: colors.textSubtle,
    },
    monthTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.text,
    },
    weekRow: {
      flexDirection: 'row',
      overflow: 'hidden',
    },
    dayOfWeekText: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontWeight: '600',
      textAlign: 'center',
    },
    cell: {
      flex: 1,
      height: CELL_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 1,
    },
    todayCell: {
      backgroundColor: colors.primaryLight,
      borderRadius: borderRadius.sm,
    },
    dayText: {
      fontSize: fontSize.md,
      color: colors.text,
      fontWeight: '500',
    },
    todayText: {
      color: colors.primaryDark,
      fontWeight: '700',
    },
    futureText: {
      color: colors.checkboxEmpty,
    },
    iconsRow: {
      flexDirection: 'row',
      gap: 2,
      marginTop: 1,
    },
  });
}
