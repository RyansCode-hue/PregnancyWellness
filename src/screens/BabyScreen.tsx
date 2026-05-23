import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import {
  getFeedings,
  startBreastFeeding,
  endFeeding,
  addBottleFeeding,
  addBreastFeedingComplete,
  deleteFeeding,
  getSleeps,
  startSleep,
  endSleep,
  addSleepComplete,
  deleteSleep,
  getDiapers,
  addDiaper,
  deleteDiaper,
} from '../storage/storage';
import {
  FeedingSession,
  SleepSession,
  DiaperEvent,
  FeedSide,
  FeedHold,
  FEED_HOLDS,
  AmountUnit,
  DiaperKind,
  RootStackParamList,
} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Baby'>;

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatHMS(totalSec: number): string {
  if (totalSec < 0) totalSec = 0;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatTimeOfDay(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// Returns "Today", "Yesterday", or a short date (Mon 3) for older entries — so the
// recent list still makes sense if a manual entry was logged for a previous day.
function formatRelativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diffDays = Math.round((that.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dayNames[d.getDay()]} ${d.getDate()}`;
}

// Compose an ISO timestamp from a time-of-day + day offset (0 = today, -1 = yesterday).
function makeIsoFromTime(hour: number, minute: number, dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function durationSeconds(start: string, end: string): number {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
}

const SIDE_LABEL: Record<FeedSide, string> = { left: 'Left', right: 'Right', both: 'Both' };
const DIAPER_LABEL: Record<DiaperKind, string> = { wet: 'Wet', dirty: 'Dirty', both: 'Both' };

// ─── Screen ──────────────────────────────────────────────────────────────

export default function BabyScreen(_props: Props) {
  const { colors, isDark } = useTheme();
  const s = makeStyles(colors);

  const [feedings, setFeedings] = useState<FeedingSession[]>([]);
  const [sleeps, setSleeps] = useState<SleepSession[]>([]);
  const [diapers, setDiapers] = useState<DiaperEvent[]>([]);
  const [tickNow, setTickNow] = useState(Date.now());

  // Feeding form state
  const [feedMode, setFeedMode] = useState<'breast' | 'bottle'>('breast');
  const [side, setSide] = useState<FeedSide>('left');
  const [holdSelection, setHoldSelection] = useState<FeedHold | 'Custom' | null>(null);
  const [holdCustom, setHoldCustom] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<AmountUnit>('oz');

  const activeBreastFeed = feedings.find((f) => f.type === 'breast' && !f.end) ?? null;
  const activeSleep = sleeps.find((sl) => !sl.end) ?? null;

  const load = async () => {
    const [f, sl, d] = await Promise.all([getFeedings(), getSleeps(), getDiapers()]);
    setFeedings(f);
    setSleeps(sl);
    setDiapers(d);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  // Single 1s tick drives every live timer on the screen.
  useEffect(() => {
    const id = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Feeding handlers ─────────────────────────────────────────────────

  const handleBreastToggle = async () => {
    if (activeBreastFeed) {
      await endFeeding(activeBreastFeed.id, new Date().toISOString());
    } else {
      const hold = holdSelection && holdSelection !== 'Custom' ? holdSelection : undefined;
      const custom =
        holdSelection === 'Custom' && holdCustom.trim() ? holdCustom.trim() : undefined;
      await startBreastFeeding(new Date().toISOString(), side, hold, custom);
    }
    await load();
  };

  const handleBottleLog = async () => {
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0) return;
    await addBottleFeeding(new Date().toISOString(), n, unit);
    setAmount('');
    await load();
  };

  const handleManualFeed = async (entry: ManualFeedEntry) => {
    if (entry.type === 'breast') {
      await addBreastFeedingComplete(
        entry.start,
        entry.end,
        entry.side,
        entry.hold,
        entry.holdCustom,
      );
    } else {
      await addBottleFeeding(entry.time, entry.amount, entry.unit);
    }
    await load();
  };

  const handleDeleteFeed = (id: string) => {
    Alert.alert('Delete feeding', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFeeding(id);
          await load();
        },
      },
    ]);
  };

  // ─── Sleep handlers ───────────────────────────────────────────────────

  const handleSleepToggle = async () => {
    if (activeSleep) {
      await endSleep(activeSleep.id, new Date().toISOString());
    } else {
      await startSleep(new Date().toISOString());
    }
    await load();
  };

  const handleManualSleep = async (start: string, end: string) => {
    await addSleepComplete(start, end);
    await load();
  };

  const handleDeleteSleep = (id: string) => {
    Alert.alert('Delete sleep', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSleep(id);
          await load();
        },
      },
    ]);
  };

  // ─── Diaper handlers ──────────────────────────────────────────────────

  const handleDiaperLog = async (kind: DiaperKind) => {
    await addDiaper(kind, new Date().toISOString());
    await load();
  };

  const handleManualDiaper = async (kind: DiaperKind, time: string) => {
    await addDiaper(kind, time);
    await load();
  };

  const handleDeleteDiaper = (id: string) => {
    Alert.alert('Delete diaper', 'Remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDiaper(id);
          await load();
        },
      },
    ]);
  };

  // ─── Derived ──────────────────────────────────────────────────────────

  const activeBreastElapsedSec = activeBreastFeed
    ? Math.floor((tickNow - new Date(activeBreastFeed.start).getTime()) / 1000)
    : 0;
  const activeSleepElapsedSec = activeSleep
    ? Math.floor((tickNow - new Date(activeSleep.start).getTime()) / 1000)
    : 0;

  const recentFeedings = [...feedings].sort(
    (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
  ).slice(0, 10);
  const recentSleeps = [...sleeps].sort(
    (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
  ).slice(0, 10);
  const recentDiapers = [...diapers].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  ).slice(0, 10);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={s.subHeader}>
          <Text style={s.headerTitle}>Baby</Text>
        </View>

        {/* ── Feeding ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Feeding</Text>

          {/* Breast / Bottle segmented control */}
          <View style={s.segment}>
            <TouchableOpacity
              style={[s.segmentBtn, feedMode === 'breast' && s.segmentBtnActive]}
              onPress={() => setFeedMode('breast')}
              activeOpacity={0.7}
            >
              <Text
                style={[s.segmentText, feedMode === 'breast' && s.segmentTextActive]}
              >
                Breast
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.segmentBtn, feedMode === 'bottle' && s.segmentBtnActive]}
              onPress={() => setFeedMode('bottle')}
              activeOpacity={0.7}
            >
              <Text
                style={[s.segmentText, feedMode === 'bottle' && s.segmentTextActive]}
              >
                Bottle
              </Text>
            </TouchableOpacity>
          </View>

          {feedMode === 'breast' ? (
            <>
              <Text style={s.fieldLabel}>Side</Text>
              <View style={s.pillRow}>
                {(['left', 'right', 'both'] as FeedSide[]).map((sd) => (
                  <Pill
                    key={sd}
                    label={SIDE_LABEL[sd]}
                    active={side === sd}
                    onPress={() => setSide(sd)}
                    colors={colors}
                  />
                ))}
              </View>

              <Text style={s.fieldLabel}>Hold</Text>
              <View style={s.pillRow}>
                {FEED_HOLDS.map((h) => (
                  <Pill
                    key={h}
                    label={h}
                    active={holdSelection === h}
                    onPress={() => setHoldSelection(holdSelection === h ? null : h)}
                    colors={colors}
                  />
                ))}
                <Pill
                  label="Custom"
                  active={holdSelection === 'Custom'}
                  onPress={() =>
                    setHoldSelection(holdSelection === 'Custom' ? null : 'Custom')
                  }
                  colors={colors}
                />
              </View>
              {holdSelection === 'Custom' && (
                <TextInput
                  style={s.textInput}
                  placeholder="Describe the hold"
                  placeholderTextColor={colors.checkboxEmpty}
                  value={holdCustom}
                  onChangeText={setHoldCustom}
                  returnKeyType="done"
                />
              )}

              <TouchableOpacity
                onPress={handleBreastToggle}
                activeOpacity={0.85}
                style={[s.bigButton, activeBreastFeed && s.bigButtonActive]}
              >
                <Text style={s.bigButtonLabel}>{activeBreastFeed ? 'Stop' : 'Start'}</Text>
                <Text style={s.bigButtonTime}>
                  {activeBreastFeed
                    ? formatHMS(activeBreastElapsedSec)
                    : 'Tap when feeding starts'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.fieldLabel}>Amount</Text>
              <View style={s.amountRow}>
                <TextInput
                  style={[s.textInput, s.amountInput]}
                  placeholder="0"
                  placeholderTextColor={colors.checkboxEmpty}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
                <View style={s.unitToggle}>
                  {(['oz', 'ml'] as AmountUnit[]).map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[s.unitBtn, unit === u && s.unitBtnActive]}
                      onPress={() => setUnit(u)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.unitText, unit === u && s.unitTextActive]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={handleBottleLog}
                activeOpacity={0.85}
                style={[
                  s.bigButton,
                  !(parseFloat(amount) > 0) && s.bigButtonDisabled,
                ]}
                disabled={!(parseFloat(amount) > 0)}
              >
                <Text style={s.bigButtonLabel}>Log feed</Text>
                <Text style={s.bigButtonTime}>
                  {parseFloat(amount) > 0 ? `${amount} ${unit}` : 'Enter an amount'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <ManualFeedingForm
            mode={feedMode}
            onSubmit={handleManualFeed}
            colors={colors}
          />

          {recentFeedings.length > 0 && (
            <View style={s.listSection}>
              <Text style={s.listTitle}>Recent</Text>
              {recentFeedings.map((f) => (
                <FeedingRow
                  key={f.id}
                  feeding={f}
                  colors={colors}
                  onDelete={handleDeleteFeed}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Sleep ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Sleep</Text>

          <TouchableOpacity
            onPress={handleSleepToggle}
            activeOpacity={0.85}
            style={[s.bigButton, activeSleep && s.bigButtonActive]}
          >
            <Text style={s.bigButtonLabel}>{activeSleep ? 'Wake' : 'Start sleep'}</Text>
            <Text style={s.bigButtonTime}>
              {activeSleep
                ? formatHMS(activeSleepElapsedSec)
                : 'Tap when baby falls asleep'}
            </Text>
          </TouchableOpacity>

          <ManualSleepForm onSubmit={handleManualSleep} colors={colors} />

          {recentSleeps.length > 0 && (
            <View style={s.listSection}>
              <Text style={s.listTitle}>Recent</Text>
              {recentSleeps.map((sl) => (
                <SleepRow
                  key={sl.id}
                  sleep={sl}
                  tickNow={tickNow}
                  colors={colors}
                  onDelete={handleDeleteSleep}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Diaper ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Diapers</Text>
          <View style={s.diaperRow}>
            {(['wet', 'dirty', 'both'] as DiaperKind[]).map((k) => (
              <TouchableOpacity
                key={k}
                style={s.diaperBtn}
                activeOpacity={0.7}
                onPress={() => handleDiaperLog(k)}
              >
                <Text style={s.diaperBtnLabel}>{DIAPER_LABEL[k]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ManualDiaperForm onSubmit={handleManualDiaper} colors={colors} />

          {recentDiapers.length > 0 && (
            <View style={s.listSection}>
              <Text style={s.listTitle}>Recent</Text>
              {recentDiapers.map((d) => (
                <DiaperRow
                  key={d.id}
                  diaper={d}
                  colors={colors}
                  onDelete={handleDeleteDiaper}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Pill ────────────────────────────────────────────────────────────────

function Pill({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const s = makeStyles(colors);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.pill, active && s.pillActive]}
    >
      <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── TimeStepper ─────────────────────────────────────────────────────────
// Compact hour/min/AM-PM stepper plus a Today/Yesterday toggle. Mirrors the
// pattern used by ReminderEditor in SettingsScreen but stays local to this
// screen since the form is only used here.

type TimeValue = { hour: number; minute: number; dayOffset: 0 | -1 };

function TimeStepper({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: TimeValue;
  onChange: (v: TimeValue) => void;
  colors: ThemeColors;
}) {
  const s = makeStyles(colors);
  const isPM = value.hour >= 12;
  const hour12 = ((value.hour + 11) % 12) + 1;

  const to24 = (h12: number, pm: boolean): number => {
    const base = h12 % 12;
    return pm ? base + 12 : base;
  };
  const bumpHour = (delta: number) => {
    const nextH12 = ((hour12 - 1 + delta + 12) % 12) + 1;
    onChange({ ...value, hour: to24(nextH12, isPM) });
  };
  const toggleAmPm = () => onChange({ ...value, hour: (value.hour + 12) % 24 });
  const bumpMinute = (delta: number) => {
    const next = ((value.minute + delta) % 60 + 60) % 60;
    onChange({ ...value, minute: next });
  };

  return (
    <View style={s.stepperWrap}>
      <Text style={s.stepperLabel}>{label}</Text>
      <View style={s.stepperRow}>
        <Stepper value={hour12} onMinus={() => bumpHour(-1)} onPlus={() => bumpHour(1)} colors={colors} />
        <Text style={s.stepperColon}>:</Text>
        <Stepper
          value={String(value.minute).padStart(2, '0')}
          onMinus={() => bumpMinute(-5)}
          onPlus={() => bumpMinute(5)}
          colors={colors}
        />
        <TouchableOpacity style={s.ampmBtn} onPress={toggleAmPm} activeOpacity={0.7}>
          <Text style={[s.ampmText, !isPM && s.ampmTextActive]}>AM</Text>
          <Text style={s.ampmDivider}>·</Text>
          <Text style={[s.ampmText, isPM && s.ampmTextActive]}>PM</Text>
        </TouchableOpacity>
      </View>
      <View style={s.dayToggle}>
        <TouchableOpacity
          style={[s.dayBtn, value.dayOffset === 0 && s.dayBtnActive]}
          onPress={() => onChange({ ...value, dayOffset: 0 })}
          activeOpacity={0.7}
        >
          <Text style={[s.dayText, value.dayOffset === 0 && s.dayTextActive]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.dayBtn, value.dayOffset === -1 && s.dayBtnActive]}
          onPress={() => onChange({ ...value, dayOffset: -1 })}
          activeOpacity={0.7}
        >
          <Text style={[s.dayText, value.dayOffset === -1 && s.dayTextActive]}>Yesterday</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Stepper({
  value,
  onMinus,
  onPlus,
  colors,
}: {
  value: number | string;
  onMinus: () => void;
  onPlus: () => void;
  colors: ThemeColors;
}) {
  const s = makeStyles(colors);
  return (
    <View style={s.stepperGroup}>
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

// Default to "now, rounded down to the nearest 5 minutes" so the picker feels usable
// without making the user step from midnight.
function defaultNow(): TimeValue {
  const d = new Date();
  return {
    hour: d.getHours(),
    minute: Math.floor(d.getMinutes() / 5) * 5,
    dayOffset: 0,
  };
}

// ─── Manual feeding form ─────────────────────────────────────────────────

type ManualFeedEntry =
  | {
      type: 'breast';
      start: string;
      end: string;
      side: FeedSide;
      hold?: FeedHold;
      holdCustom?: string;
    }
  | { type: 'bottle'; time: string; amount: number; unit: AmountUnit };

function ManualFeedingForm({
  mode,
  onSubmit,
  colors,
}: {
  mode: 'breast' | 'bottle';
  onSubmit: (entry: ManualFeedEntry) => void;
  colors: ThemeColors;
}) {
  const s = makeStyles(colors);
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState<TimeValue>(defaultNow);
  const [endTime, setEndTime] = useState<TimeValue>(defaultNow);
  const [side, setSide] = useState<FeedSide>('left');
  const [holdSel, setHoldSel] = useState<FeedHold | 'Custom' | null>(null);
  const [holdCustom, setHoldCustom] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<AmountUnit>('oz');

  const handleSave = () => {
    if (mode === 'breast') {
      const startIso = makeIsoFromTime(startTime.hour, startTime.minute, startTime.dayOffset);
      const endIso = makeIsoFromTime(endTime.hour, endTime.minute, endTime.dayOffset);
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        Alert.alert('Invalid times', 'End must be after start.');
        return;
      }
      const hold = holdSel && holdSel !== 'Custom' ? holdSel : undefined;
      const custom =
        holdSel === 'Custom' && holdCustom.trim() ? holdCustom.trim() : undefined;
      onSubmit({ type: 'breast', start: startIso, end: endIso, side, hold, holdCustom: custom });
    } else {
      const n = parseFloat(amount);
      if (!isFinite(n) || n <= 0) {
        Alert.alert('Invalid amount', 'Enter a number greater than zero.');
        return;
      }
      const iso = makeIsoFromTime(startTime.hour, startTime.minute, startTime.dayOffset);
      onSubmit({ type: 'bottle', time: iso, amount: n, unit });
      setAmount('');
    }
    setOpen(false);
    setHoldSel(null);
    setHoldCustom('');
  };

  if (!open) {
    return (
      <TouchableOpacity
        style={s.expandBtn}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={s.expandBtnText}>＋ Add past entry</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.manualForm}>
      {mode === 'breast' ? (
        <>
          <TimeStepper label="Start" value={startTime} onChange={setStartTime} colors={colors} />
          <TimeStepper label="End" value={endTime} onChange={setEndTime} colors={colors} />
          <Text style={s.fieldLabel}>Side</Text>
          <View style={s.pillRow}>
            {(['left', 'right', 'both'] as FeedSide[]).map((sd) => (
              <Pill
                key={sd}
                label={SIDE_LABEL[sd]}
                active={side === sd}
                onPress={() => setSide(sd)}
                colors={colors}
              />
            ))}
          </View>
          <Text style={s.fieldLabel}>Hold (optional)</Text>
          <View style={s.pillRow}>
            {FEED_HOLDS.map((h) => (
              <Pill
                key={h}
                label={h}
                active={holdSel === h}
                onPress={() => setHoldSel(holdSel === h ? null : h)}
                colors={colors}
              />
            ))}
            <Pill
              label="Custom"
              active={holdSel === 'Custom'}
              onPress={() => setHoldSel(holdSel === 'Custom' ? null : 'Custom')}
              colors={colors}
            />
          </View>
          {holdSel === 'Custom' && (
            <TextInput
              style={s.textInput}
              placeholder="Describe the hold"
              placeholderTextColor={colors.checkboxEmpty}
              value={holdCustom}
              onChangeText={setHoldCustom}
              returnKeyType="done"
            />
          )}
        </>
      ) : (
        <>
          <TimeStepper label="Time" value={startTime} onChange={setStartTime} colors={colors} />
          <Text style={s.fieldLabel}>Amount</Text>
          <View style={s.amountRow}>
            <TextInput
              style={[s.textInput, s.amountInput]}
              placeholder="0"
              placeholderTextColor={colors.checkboxEmpty}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <View style={s.unitToggle}>
              {(['oz', 'ml'] as AmountUnit[]).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[s.unitBtn, unit === u && s.unitBtnActive]}
                  onPress={() => setUnit(u)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.unitText, unit === u && s.unitTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      <View style={s.formActions}>
        <TouchableOpacity
          style={[s.formBtn, s.formBtnSecondary]}
          onPress={() => setOpen(false)}
          activeOpacity={0.7}
        >
          <Text style={s.formBtnSecondaryText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.formBtn, s.formBtnPrimary]}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <Text style={s.formBtnPrimaryText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Manual sleep form ───────────────────────────────────────────────────

function ManualSleepForm({
  onSubmit,
  colors,
}: {
  onSubmit: (start: string, end: string) => void;
  colors: ThemeColors;
}) {
  const s = makeStyles(colors);
  const [open, setOpen] = useState(false);
  // Sleep often starts the previous day, so default start = yesterday for ergonomics.
  const [startTime, setStartTime] = useState<TimeValue>(() => ({
    ...defaultNow(),
    dayOffset: -1,
  }));
  const [endTime, setEndTime] = useState<TimeValue>(defaultNow);

  const handleSave = () => {
    const startIso = makeIsoFromTime(startTime.hour, startTime.minute, startTime.dayOffset);
    const endIso = makeIsoFromTime(endTime.hour, endTime.minute, endTime.dayOffset);
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      Alert.alert('Invalid times', 'End must be after start.');
      return;
    }
    onSubmit(startIso, endIso);
    setOpen(false);
  };

  if (!open) {
    return (
      <TouchableOpacity
        style={s.expandBtn}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={s.expandBtnText}>＋ Add past entry</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.manualForm}>
      <TimeStepper label="Start" value={startTime} onChange={setStartTime} colors={colors} />
      <TimeStepper label="End" value={endTime} onChange={setEndTime} colors={colors} />
      <View style={s.formActions}>
        <TouchableOpacity
          style={[s.formBtn, s.formBtnSecondary]}
          onPress={() => setOpen(false)}
          activeOpacity={0.7}
        >
          <Text style={s.formBtnSecondaryText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.formBtn, s.formBtnPrimary]}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <Text style={s.formBtnPrimaryText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Manual diaper form ──────────────────────────────────────────────────

function ManualDiaperForm({
  onSubmit,
  colors,
}: {
  onSubmit: (kind: DiaperKind, time: string) => void;
  colors: ThemeColors;
}) {
  const s = makeStyles(colors);
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState<TimeValue>(defaultNow);
  const [kind, setKind] = useState<DiaperKind>('wet');

  const handleSave = () => {
    onSubmit(kind, makeIsoFromTime(time.hour, time.minute, time.dayOffset));
    setOpen(false);
  };

  if (!open) {
    return (
      <TouchableOpacity
        style={s.expandBtn}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={s.expandBtnText}>＋ Add past entry</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.manualForm}>
      <Text style={s.fieldLabel}>Kind</Text>
      <View style={s.pillRow}>
        {(['wet', 'dirty', 'both'] as DiaperKind[]).map((k) => (
          <Pill
            key={k}
            label={DIAPER_LABEL[k]}
            active={kind === k}
            onPress={() => setKind(k)}
            colors={colors}
          />
        ))}
      </View>
      <TimeStepper label="Time" value={time} onChange={setTime} colors={colors} />
      <View style={s.formActions}>
        <TouchableOpacity
          style={[s.formBtn, s.formBtnSecondary]}
          onPress={() => setOpen(false)}
          activeOpacity={0.7}
        >
          <Text style={s.formBtnSecondaryText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.formBtn, s.formBtnPrimary]}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <Text style={s.formBtnPrimaryText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── List rows ───────────────────────────────────────────────────────────

function SwipeRow({
  children,
  onDelete,
  colors,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  colors: ThemeColors;
}) {
  const s = makeStyles(colors);
  const swipeableRef = useRef<Swipeable>(null);
  return (
    <Swipeable
      ref={swipeableRef}
      overshootRight={false}
      friction={2}
      renderRightActions={() => (
        <View style={s.swipeActions}>
          <RectButton
            style={[s.swipeAction, s.swipeDelete]}
            onPress={() => {
              swipeableRef.current?.close();
              onDelete();
            }}
          >
            <Text style={s.swipeActionText}>Delete</Text>
          </RectButton>
        </View>
      )}
    >
      <View style={s.row}>{children}</View>
    </Swipeable>
  );
}

function FeedingRow({
  feeding,
  colors,
  onDelete,
}: {
  feeding: FeedingSession;
  colors: ThemeColors;
  onDelete: (id: string) => void;
}) {
  const s = makeStyles(colors);
  const meta: string[] = [];
  if (feeding.type === 'breast') {
    if (feeding.side) meta.push(SIDE_LABEL[feeding.side]);
    if (feeding.hold) meta.push(feeding.hold);
    else if (feeding.holdCustom) meta.push(feeding.holdCustom);
  } else {
    if (feeding.amount != null && feeding.unit) {
      meta.push(`${feeding.amount} ${feeding.unit}`);
    }
  }

  const durationLabel =
    feeding.type === 'breast' && feeding.end
      ? formatHMS(durationSeconds(feeding.start, feeding.end))
      : feeding.type === 'breast' && !feeding.end
        ? '— in progress'
        : '';

  const day = formatRelativeDay(feeding.start);

  return (
    <SwipeRow onDelete={() => onDelete(feeding.id)} colors={colors}>
      <View style={s.rowLeft}>
        <Text style={s.rowTime}>
          {feeding.type === 'breast' ? 'Breast' : 'Bottle'} · {formatTimeOfDay(feeding.start)}
          {day !== 'Today' ? `  (${day})` : ''}
        </Text>
        {meta.length > 0 && <Text style={s.rowGap}>{meta.join(' · ')}</Text>}
      </View>
      {!!durationLabel && <Text style={s.rowDuration}>{durationLabel}</Text>}
    </SwipeRow>
  );
}

function SleepRow({
  sleep,
  tickNow,
  colors,
  onDelete,
}: {
  sleep: SleepSession;
  tickNow: number;
  colors: ThemeColors;
  onDelete: (id: string) => void;
}) {
  const s = makeStyles(colors);
  const elapsedSec = sleep.end
    ? durationSeconds(sleep.start, sleep.end)
    : Math.floor((tickNow - new Date(sleep.start).getTime()) / 1000);
  const day = formatRelativeDay(sleep.start);

  return (
    <SwipeRow onDelete={() => onDelete(sleep.id)} colors={colors}>
      <View style={s.rowLeft}>
        <Text style={s.rowTime}>
          {formatTimeOfDay(sleep.start)}
          {sleep.end ? ` → ${formatTimeOfDay(sleep.end)}` : ' → in progress'}
          {day !== 'Today' ? `  (${day})` : ''}
        </Text>
      </View>
      <Text style={s.rowDuration}>{formatHMS(elapsedSec)}</Text>
    </SwipeRow>
  );
}

function DiaperRow({
  diaper,
  colors,
  onDelete,
}: {
  diaper: DiaperEvent;
  colors: ThemeColors;
  onDelete: (id: string) => void;
}) {
  const s = makeStyles(colors);
  const day = formatRelativeDay(diaper.time);
  return (
    <SwipeRow onDelete={() => onDelete(diaper.id)} colors={colors}>
      <View style={s.rowLeft}>
        <Text style={s.rowTime}>
          {DIAPER_LABEL[diaper.kind]} · {formatTimeOfDay(diaper.time)}
          {day !== 'Today' ? `  (${day})` : ''}
        </Text>
      </View>
    </SwipeRow>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

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
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.text,
    },
    card: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cardTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    fieldLabel: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },

    // Segmented (Breast/Bottle)
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: borderRadius.sm,
      padding: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: spacing.sm,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: borderRadius.sm - 2,
    },
    segmentBtnActive: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },

    // Pill row (side, hold, diaper kind)
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    pill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    pillActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    pillText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.text,
    },
    pillTextActive: {
      color: colors.primaryDark,
    },

    // Text input (custom hold, amount)
    textInput: {
      marginTop: spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      fontSize: fontSize.md,
      color: colors.text,
      backgroundColor: colors.background,
    },

    // Amount row (input + unit toggle)
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    amountInput: {
      flex: 1,
      marginTop: 0,
    },
    unitToggle: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: borderRadius.sm,
      padding: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    unitBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.sm - 2,
    },
    unitBtnActive: {
      backgroundColor: colors.primary,
    },
    unitText: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: colors.textSubtle,
    },
    unitTextActive: {
      color: '#FFFFFF',
    },

    // Big action button (Start/Stop, Log)
    bigButton: {
      marginTop: spacing.md,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      backgroundColor: colors.primaryDark,
    },
    bigButtonActive: {
      backgroundColor: colors.danger,
    },
    bigButtonDisabled: {
      opacity: 0.4,
    },
    bigButtonLabel: {
      fontSize: fontSize.xl,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    bigButtonTime: {
      fontSize: fontSize.md,
      color: '#FFFFFF',
      opacity: 0.85,
      marginTop: 2,
    },

    // Diaper row (three buttons)
    diaperRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    diaperBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      backgroundColor: colors.primaryDark,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    diaperBtnLabel: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },

    // Expand "Add past entry" button
    expandBtn: {
      marginTop: spacing.sm,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    expandBtnText: {
      fontSize: fontSize.sm,
      color: colors.primary,
      fontWeight: '700',
    },

    // Inline manual-entry form
    manualForm: {
      marginTop: spacing.sm,
      padding: spacing.sm,
      borderRadius: borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    formActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    formBtn: {
      flex: 1,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.sm,
      alignItems: 'center',
    },
    formBtnPrimary: {
      backgroundColor: colors.primary,
    },
    formBtnPrimaryText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: fontSize.md,
    },
    formBtnSecondary: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    formBtnSecondaryText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: fontSize.md,
    },

    // Time stepper
    stepperWrap: {
      marginTop: spacing.sm,
    },
    stepperLabel: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    stepperGroup: {
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
    stepperColon: {
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
    dayToggle: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    dayBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm - 2,
      borderRadius: borderRadius.full,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dayBtnActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    dayText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    dayTextActive: {
      color: colors.primaryDark,
    },

    // List rows
    listSection: {
      marginTop: spacing.md,
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
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.primary,
      marginLeft: spacing.sm,
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
