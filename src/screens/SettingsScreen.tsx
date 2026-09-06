import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  StatusBar,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../ThemeContext';
import TimeStepper from '../components/TimeStepper';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import {
  getPregnancyWeek,
  getDaysUntilDue,
  createReminder,
  REMINDER_NAME_PLACEHOLDER,
} from '../storage/storage';
import { TOGGLEABLE_TABS } from '../navTabs';
import { RootStackParamList, ReminderConfig } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_OF_WEEK = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function MiniCalendarPicker({
  selectedDate,
  onSelectDate,
  colors,
}: {
  selectedDate: string | undefined;
  onSelectDate: (date: string) => void;
  colors: ThemeColors;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => {
    if (selectedDate) {
      const [y] = selectedDate.split('-');
      return parseInt(y);
    }
    return today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) {
      const [, m] = selectedDate.split('-');
      return parseInt(m) - 1;
    }
    return today.getMonth();
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrev = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else { setViewMonth(viewMonth - 1); }
  };
  const handleNext = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else { setViewMonth(viewMonth + 1); }
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  while (rows.length > 0 && rows[rows.length - 1].length < 7) {
    rows[rows.length - 1].push(null);
  }

  const s = useMemo(() => calendarPickerStyles(colors), [colors]);

  return (
    <View style={s.container}>
      <View style={s.navRow}>
        <TouchableOpacity onPress={handlePrev} style={s.navButton}>
          <Text style={s.navText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={handleNext} style={s.navButton}>
          <Text style={s.navText}>{'>'}</Text>
        </TouchableOpacity>
      </View>
      <View style={s.row}>
        {DAYS_OF_WEEK.map((d) => (
          <View key={d} style={s.cell}>
            <Text style={s.dayHeader}>{d}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={s.row}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={s.cell} />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={ci}
                style={[s.cell, isSelected && s.cellSelected]}
                onPress={() => onSelectDate(dateStr)}
              >
                <Text style={[s.dayText, isSelected && s.dayTextSelected]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function calendarPickerStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    navButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navText: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.primary,
    },
    monthLabel: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.text,
    },
    row: {
      flexDirection: 'row',
    },
    cell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.full,
      margin: 1,
    },
    cellSelected: {
      backgroundColor: colors.primary,
    },
    dayHeader: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    dayText: {
      fontSize: fontSize.sm,
      color: colors.text,
    },
    dayTextSelected: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });
}

function formatTime(hour: number, minute: number): string {
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

function ReminderEditor({
  config,
  onChange,
  onDelete,
  colors,
}: {
  config: ReminderConfig;
  onChange: (next: ReminderConfig) => void;
  onDelete: () => void;
  colors: ThemeColors;
}) {
  const s = useMemo(() => reminderEditorStyles(colors), [colors]);
  const [titleDraft, setTitleDraft] = useState(config.title);
  const [bodyDraft, setBodyDraft] = useState(config.body);

  // Keep local drafts in sync if config changes from outside
  React.useEffect(() => {
    setTitleDraft(config.title);
  }, [config.title]);
  React.useEffect(() => {
    setBodyDraft(config.body);
  }, [config.body]);

  return (

    <View style={s.container}>
      <View style={s.headerRow}>
        <Text style={s.label}>{config.title || 'Reminder'}</Text>
        <TouchableOpacity onPress={onDelete} style={s.deleteBtn} activeOpacity={0.6}>
          <Text style={s.deleteBtnText}>×</Text>
        </TouchableOpacity>
      </View>
      <View style={s.timeRow}>
        <TimeStepper
          value={{ hour: config.hour, minute: config.minute }}
          onChange={(t) => onChange({ ...config, ...t })}
          colors={colors}
        />
        <View style={s.previewBox}>
          <Text style={s.previewTime}>{formatTime(config.hour, config.minute)}</Text>
        </View>
      </View>
      <Text style={[s.stepperCaption, { marginTop: spacing.sm }]}>Title</Text>
      <TextInput
        style={s.titleInput}
        value={titleDraft}
        onChangeText={setTitleDraft}
        onBlur={() => {
          const trimmed = titleDraft.trim();
          if (trimmed && trimmed !== config.title) {
            onChange({ ...config, title: trimmed });
          } else if (!trimmed) {
            // Revert local draft if user cleared it — title can't be empty
            setTitleDraft(config.title);
          }
        }}
        placeholder="Notification title"
        placeholderTextColor={colors.checkboxEmpty}
        returnKeyType="done"
      />
      <Text style={[s.stepperCaption, { marginTop: spacing.sm }]}>Message</Text>
      <TextInput
        style={s.bodyInput}
        value={bodyDraft}
        onChangeText={setBodyDraft}
        onBlur={() => {
          if (bodyDraft.trim() !== config.body) {
            onChange({ ...config, body: bodyDraft.trim() });
          }
        }}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        placeholder="Enter reminder text"
        placeholderTextColor={colors.checkboxEmpty}
      />
      <Text style={s.stepperCaption}>
        Write {REMINDER_NAME_PLACEHOLDER} where the name from "Your Name" should appear.
      </Text>
    </View>
  );
}

function reminderEditorStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    label: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.text,
    },
    deleteBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dangerLight,
    },
    deleteBtnText: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.danger,
      lineHeight: 24,
      marginTop: -2,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    stepperCaption: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontWeight: '600',
      marginBottom: 4,
    },
    previewBox: {
      flex: 1,
      alignItems: 'flex-end',
      justifyContent: 'center',
      height: 36,
    },
    previewTime: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.primary,
    },
    titleInput: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.text,
    },
    bodyInput: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      fontSize: fontSize.md,
      color: colors.text,
      minHeight: 70,
    },
  });
}

export default function SettingsScreen({ navigation }: Props) {
  const { colors, isDark, toggleDarkMode, settings, updateSettings } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [nameInput, setNameInput] = useState(settings.partnerName || '');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      await updateSettings({ partnerName: trimmed });
    }
  };

  const handleSelectDate = async (dateStr: string) => {
    await updateSettings({ dueDate: dateStr });
    setShowDatePicker(false);
  };

  const handleToggleReminders = async () => {
    await updateSettings({ remindersEnabled: !settings.remindersEnabled });
  };

  const handleUpdateReminder = async (next: ReminderConfig) => {
    await updateSettings({
      reminders: settings.reminders.map((r) => (r.id === next.id ? next : r)),
    });
  };

  const handleDeleteReminder = async (id: string) => {
    await updateSettings({
      reminders: settings.reminders.filter((r) => r.id !== id),
    });
  };

  const handleAddReminder = async () => {
    await updateSettings({
      reminders: [...settings.reminders, createReminder()],
    });
  };

  const pregnancyWeek = settings.dueDate ? getPregnancyWeek(settings.dueDate) : null;
  const daysUntil = settings.dueDate ? getDaysUntilDue(settings.dueDate) : null;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={styles.subHeader}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Partner Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Name</Text>
          <Text style={styles.sectionDesc}>
            Inserted into reminder messages wherever they say {REMINDER_NAME_PLACEHOLDER}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Amy"
              placeholderTextColor={colors.checkboxEmpty}
              value={nameInput}
              onChangeText={setNameInput}
              onBlur={handleSaveName}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Due Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Due Date</Text>
          <Text style={styles.sectionDesc}>
            Shows your pregnancy week on the home screen
          </Text>

          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setShowDatePicker(!showDatePicker)}
          >
            <Text style={settings.dueDate ? styles.datePickerText : styles.datePickerPlaceholder}>
              {settings.dueDate
                ? (() => {
                    const [y, m, d] = settings.dueDate.split('-');
                    return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
                  })()
                : 'Tap to select date'}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <View style={{ marginTop: spacing.sm }}>
              <MiniCalendarPicker
                selectedDate={settings.dueDate}
                onSelectDate={handleSelectDate}
                colors={colors}
              />
            </View>
          )}

          {pregnancyWeek && (
            <View style={styles.pregnancyInfo}>
              <Text style={styles.pregnancyWeekText}>
                Week {pregnancyWeek.week}, Day {pregnancyWeek.day}
              </Text>
              {daysUntil !== null && daysUntil > 0 && (
                <Text style={styles.daysUntilText}>
                  {daysUntil} days until due date
                </Text>
              )}
            </View>
          )}
          {settings.dueDate && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => updateSettings({ dueDate: undefined })}
            >
              <Text style={styles.clearButtonText}>Clear due date</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dark Mode */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.sectionTitle}>Dark Mode</Text>
              <Text style={styles.sectionDesc}>
                Easier on the eyes for late-night checks
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleDarkMode}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Visible Tabs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visible Tabs</Text>
          <Text style={styles.sectionDesc}>
            Hide tabs you don't use. Settings always stays visible.
          </Text>
          {TOGGLEABLE_TABS.map((tab) => (
            <View
              key={tab}
              style={[styles.toggleRow, { marginTop: spacing.sm }]}
            >
              <View style={styles.toggleInfo}>
                <Text style={styles.sectionTitle}>{tab}</Text>
              </View>
              <Switch
                value={settings.enabledTabs[tab]}
                onValueChange={(v) =>
                  updateSettings({
                    enabledTabs: { ...settings.enabledTabs, [tab]: v },
                  })
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>

        {/* Reminders */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.sectionTitle}>Daily Reminders</Text>
              <Text style={styles.sectionDesc}>
                Add as many or as few notifications as you want
              </Text>
            </View>
            <Switch
              value={settings.remindersEnabled}
              onValueChange={handleToggleReminders}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {settings.remindersEnabled && (
            <>
              {settings.reminders.length === 0 && (
                <Text style={[styles.sectionDesc, { marginTop: spacing.sm, fontStyle: 'italic' }]}>
                  No reminders yet. Tap below to add one.
                </Text>
              )}
              {settings.reminders.map((reminder) => (
                <ReminderEditor
                  key={reminder.id}
                  config={reminder}
                  onChange={handleUpdateReminder}
                  onDelete={() => handleDeleteReminder(reminder.id)}
                  colors={colors}
                />
              ))}
              <TouchableOpacity
                style={styles.addReminderButton}
                onPress={handleAddReminder}
                activeOpacity={0.8}
              >
                <Text style={styles.addReminderButtonText}>＋ Add reminder</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Weekly Report */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Report</Text>
          <Text style={styles.sectionDesc}>
            View your supplement and workout history by week
          </Text>
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => navigation.navigate('WeeklyReport')}
            activeOpacity={0.8}
          >
            <Text style={styles.reportButtonText}>View Weekly Reports</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Pregnancy Wellness</Text>
          <Text style={styles.footerSubtext}>Made with love for your pregnancy journey</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: 80,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    sectionDesc: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginBottom: spacing.md,
      lineHeight: 18,
    },
    inputRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.lg,
      color: colors.text,
      flex: 1,
    },
    datePickerButton: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    datePickerText: {
      fontSize: fontSize.lg,
      color: colors.text,
      fontWeight: '600',
    },
    datePickerPlaceholder: {
      fontSize: fontSize.lg,
      color: colors.checkboxEmpty,
    },
    pregnancyInfo: {
      backgroundColor: colors.primaryLight,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      marginTop: spacing.sm,
    },
    pregnancyWeekText: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.primary,
    },
    daysUntilText: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    clearButton: {
      marginTop: spacing.sm,
    },
    clearButtonText: {
      color: colors.danger,
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    addReminderButton: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    addReminderButtonText: {
      color: colors.primary,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    reportButton: {
      backgroundColor: colors.primaryDark,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 4,
    },
    reportButtonText: {
      color: '#FFFFFF',
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    toggleInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    footer: {
      alignItems: 'center',
      paddingTop: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    footerSubtext: {
      fontSize: fontSize.sm,
      color: colors.checkboxEmpty,
      marginTop: 4,
    },
  });
}
