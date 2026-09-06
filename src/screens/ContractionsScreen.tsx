import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import {
  getContractions,
  addContraction,
  endContraction,
  deleteContraction,
  clearContractions,
  estimateLaborStage,
} from '../storage/storage';
import { Contraction, LaborStage, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Contractions'>;

// The timer never classifies as "pushing" — by then you're not tracking
// contractions any more, so only these three stages are reachable.
const STAGE_LABEL: Partial<Record<LaborStage, string>> = {
  early: 'Early Labor',
  active: 'Active Labor',
  transition: 'Transition',
};

const STAGE_DESCRIPTION: Partial<Record<LaborStage, string>> = {
  early: 'Mild contractions, 5–20 min apart, 30–45s long.',
  active: 'Stronger and regular, 3–5 min apart, 40–60s long.',
  transition: 'Very intense, less than 3 min apart, 60–90s long.',
};

function formatHMS(totalSec: number): string {
  if (totalSec < 0) totalSec = 0;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function ContractionsScreen(_props: Props) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [contractions, setContractions] = useState<Contraction[]>([]);
  const [tickNow, setTickNow] = useState(Date.now());

  const active = contractions.find((c) => !c.end) ?? null;

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  // While a contraction is in progress, tick every second so the elapsed
  // counter and the "since last contraction started" counter both update live.
  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    setContractions(await getContractions());
  };

  const handleToggle = async () => {
    if (active) {
      await endContraction(active.id, new Date().toISOString());
    } else {
      await addContraction(new Date().toISOString());
    }
    await load();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete contraction',
      'Remove this entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteContraction(id);
            await load();
          },
        },
      ],
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear all contractions',
      'This removes every logged contraction. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearContractions();
            await load();
          },
        },
      ],
    );
  };

  // Stage estimate over the last 4 completed contractions.
  const estimate = estimateLaborStage(contractions);

  // Time since last completed contraction's start (for the idle state caption).
  const lastCompleted = [...contractions].reverse().find((c) => c.end);
  const sinceLastSec = lastCompleted
    ? Math.floor((tickNow - new Date(lastCompleted.start).getTime()) / 1000)
    : null;

  // Live elapsed time of the current contraction.
  const activeElapsedSec = active
    ? Math.floor((tickNow - new Date(active.start).getTime()) / 1000)
    : 0;

  // For each completed contraction, the duration and the gap to the previous
  // contraction's start (so the user can eyeball the trend).
  const completed = contractions.filter((c) => c.end);
  const recent = [...completed].slice(-10).reverse();

  return (
    <View style={s.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.subHeader}>
          <Text style={s.headerTitle}>Contractions</Text>
          {completed.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
              <Text style={s.clearText}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Big toggle button + live timer */}
        <TouchableOpacity
          onPress={handleToggle}
          activeOpacity={0.85}
          style={[s.bigButton, active && s.bigButtonActive]}
        >
          <Text style={[s.bigButtonLabel, active && s.bigButtonLabelActive]}>
            {active ? 'Stop' : 'Start'}
          </Text>
          <Text style={[s.bigButtonTime, active && s.bigButtonTimeActive]}>
            {active ? formatHMS(activeElapsedSec) : 'Tap when one starts'}
          </Text>
          {!active && sinceLastSec !== null && (
            <Text style={s.bigButtonHint}>
              Last started {formatHMS(sinceLastSec)} ago
            </Text>
          )}
        </TouchableOpacity>

        {/* Stage estimate */}
        {estimate.stage ? (
          <View style={s.estimateCard}>
            <Text style={s.estimateLabel}>You appear to be in</Text>
            <Text style={s.estimateStage}>{STAGE_LABEL[estimate.stage]}</Text>
            <Text style={s.estimateDescription}>
              {STAGE_DESCRIPTION[estimate.stage]}
            </Text>
            <View style={s.estimateStatsRow}>
              <View style={s.estimateStat}>
                <Text style={s.estimateStatLabel}>Avg duration</Text>
                <Text style={s.estimateStatValue}>
                  {Math.round(estimate.avgDurationSec)}s
                </Text>
              </View>
              <View style={s.estimateStat}>
                <Text style={s.estimateStatLabel}>Avg interval</Text>
                <Text style={s.estimateStatValue}>
                  {estimate.avgIntervalMin.toFixed(1)} min
                </Text>
              </View>
              <View style={s.estimateStat}>
                <Text style={s.estimateStatLabel}>Sample</Text>
                <Text style={s.estimateStatValue}>
                  {estimate.sampleSize}
                </Text>
              </View>
            </View>
            <Text style={s.estimateDisclaimer}>
              Based on the last {estimate.sampleSize} contractions. This is an
              estimate, not medical advice.
            </Text>
          </View>
        ) : (
          <View style={s.estimateCard}>
            <Text style={s.estimateLabel}>Stage estimate</Text>
            <Text style={s.estimatePlaceholder}>
              Log at least 4 completed contractions to see an estimate.
            </Text>
          </View>
        )}

        {/* Recent contractions list */}
        {recent.length > 0 && (
          <View style={s.listSection}>
            <Text style={s.listTitle}>Recent</Text>
            {recent.map((c, idx) => {
              // recent is already reversed; the previous in-time contraction
              // is at idx + 1 of `recent`.
              const prev = recent[idx + 1];
              const durationSec = c.end
                ? Math.floor(
                    (new Date(c.end).getTime() - new Date(c.start).getTime()) / 1000,
                  )
                : 0;
              const gapMin = prev
                ? (new Date(c.start).getTime() - new Date(prev.start).getTime()) /
                  60000
                : null;
              return (
                <ContractionRow
                  key={c.id}
                  contraction={c}
                  durationSec={durationSec}
                  gapMin={gapMin}
                  colors={colors}
                  onDelete={handleDelete}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ContractionRow({
  contraction,
  durationSec,
  gapMin,
  colors,
  onDelete,
}: {
  contraction: Contraction;
  durationSec: number;
  gapMin: number | null;
  colors: ThemeColors;
  onDelete: (id: string) => void;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View style={s.swipeActions}>
      <RectButton
        style={[s.swipeAction, s.swipeDelete]}
        onPress={() => {
          swipeableRef.current?.close();
          onDelete(contraction.id);
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
      <View style={s.row}>
        <View style={s.rowLeft}>
          <Text style={s.rowTime}>{formatTime(contraction.start)}</Text>
          <Text style={s.rowGap}>
            {gapMin !== null
              ? `${gapMin.toFixed(1)} min apart`
              : 'first logged'}
          </Text>
        </View>
        <Text style={s.rowDuration}>{formatHMS(durationSec)}</Text>
      </View>
    </Swipeable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: spacing.xl * 2,
    },
    subHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.text,
    },
    clearText: {
      fontSize: fontSize.sm,
      color: colors.danger,
      fontWeight: '600',
    },
    bigButton: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      paddingVertical: spacing.xl,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      backgroundColor: colors.primaryDark,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    bigButtonActive: {
      backgroundColor: colors.danger,
    },
    bigButtonLabel: {
      fontSize: fontSize.xxl,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 1,
    },
    bigButtonLabelActive: {
      color: '#FFFFFF',
    },
    bigButtonTime: {
      fontSize: fontSize.lg,
      color: '#FFFFFF',
      opacity: 0.85,
      marginTop: spacing.xs,
    },
    bigButtonTimeActive: {
      fontWeight: '700',
      opacity: 1,
    },
    bigButtonHint: {
      fontSize: fontSize.sm,
      color: '#FFFFFF',
      opacity: 0.75,
      marginTop: spacing.xs,
    },
    estimateCard: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    estimateLabel: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    estimateStage: {
      fontSize: fontSize.xxl,
      fontWeight: '800',
      color: colors.primary,
      marginTop: 4,
    },
    estimateDescription: {
      fontSize: fontSize.md,
      color: colors.text,
      marginTop: spacing.xs,
      lineHeight: 20,
    },
    estimateStatsRow: {
      flexDirection: 'row',
      marginTop: spacing.md,
      gap: spacing.md,
    },
    estimateStat: {
      flex: 1,
    },
    estimateStatLabel: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontWeight: '600',
    },
    estimateStatValue: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
    },
    estimateDisclaimer: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontStyle: 'italic',
      marginTop: spacing.sm,
    },
    estimatePlaceholder: {
      fontSize: fontSize.md,
      color: colors.textSubtle,
      marginTop: spacing.xs,
    },
    listSection: {
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    listTitle: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.sm,
      marginBottom: spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    rowLeft: {
      flex: 1,
    },
    rowTime: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.text,
    },
    rowGap: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    rowDuration: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.primary,
    },
    swipeActions: {
      flexDirection: 'row',
      marginBottom: spacing.xs,
    },
    swipeAction: {
      width: 80,
      justifyContent: 'center',
      alignItems: 'center',
    },
    swipeDelete: {
      backgroundColor: colors.danger,
      borderTopRightRadius: borderRadius.sm,
      borderBottomRightRadius: borderRadius.sm,
    },
    swipeActionText: {
      color: '#FFFFFF',
      fontSize: fontSize.md,
      fontWeight: '700',
    },
  });
}
