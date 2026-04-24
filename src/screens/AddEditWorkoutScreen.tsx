import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import { saveWorkout, DAY_NAMES_SHORT } from '../storage/storage';
import { RootStackParamList, DayOfWeek, WorkoutFrequency } from '../types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditWorkout'>;

export default function AddEditWorkoutScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const existing = route.params?.workout;
  const isEditing = !!existing;

  const [name, setName] = useState(existing?.name || '');
  const [frequency, setFrequency] = useState<WorkoutFrequency>(
    existing?.frequency || 'days'
  );
  const [assignedDays, setAssignedDays] = useState<DayOfWeek[]>(
    existing?.assignedDays || []
  );
  const [weeklyGoal, setWeeklyGoal] = useState<string>(
    existing?.weeklyGoal ? String(existing.weeklyGoal) : '3'
  );

  const toggleDay = (day: DayOfWeek) => {
    setAssignedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const selectAllDays = () => {
    setAssignedDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const selectWeekdays = () => {
    setAssignedDays([1, 2, 3, 4, 5]);
  };

  const parsedGoal = Math.max(1, Math.min(7, parseInt(weeklyGoal, 10) || 0));
  const goalValid = frequency !== 'weekly' || parsedGoal >= 1;
  const daysValid = frequency !== 'days' || assignedDays.length > 0;
  const canSave = !!name.trim() && goalValid && daysValid;

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing Name', 'Please enter a workout name.');
      return;
    }
    if (frequency === 'days' && assignedDays.length === 0) {
      Alert.alert('No Days Selected', 'Please select at least one day for this workout.');
      return;
    }
    if (frequency === 'weekly' && parsedGoal < 1) {
      Alert.alert('Invalid Goal', 'Please enter a weekly goal between 1 and 7.');
      return;
    }

    await saveWorkout({
      id: existing?.id || generateId(),
      name: trimmedName,
      frequency,
      assignedDays: frequency === 'days' ? assignedDays : [],
      weeklyGoal: frequency === 'weekly' ? parsedGoal : undefined,
      createdAt: existing?.createdAt || new Date().toISOString(),
    });

    navigation.goBack();
  };

  const daysLabel = assignedDays.length === 7
    ? 'Every day'
    : assignedDays.length === 5 && [1, 2, 3, 4, 5].every((d) => assignedDays.includes(d as DayOfWeek))
      ? 'Weekdays'
      : assignedDays.map((d) => DAY_NAMES_SHORT[d]).join(', ');

  const previewLabel =
    frequency === 'weekly'
      ? `${parsedGoal}× per week (any day)`
      : daysLabel;

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.flex}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.cancelButton}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {isEditing ? 'Edit Workout' : 'New Workout'}
          </Text>
          <View style={s.headerSpacer} />
        </View>

        <ScrollView
          style={s.form}
          contentContainerStyle={s.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Workout Name */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>Workout Name</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Prenatal Yoga, Walk, Stretching"
              placeholderTextColor={colors.checkboxEmpty}
              value={name}
              onChangeText={setName}
              autoFocus={!isEditing}
              returnKeyType="done"
            />
          </View>

          {/* Frequency selector */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>How often?</Text>
            <View style={s.freqRow}>
              <TouchableOpacity
                style={[s.freqOption, frequency === 'days' && s.freqOptionSelected]}
                onPress={() => setFrequency('days')}
                activeOpacity={0.8}
              >
                <Text style={[s.freqOptionTitle, frequency === 'days' && s.freqOptionTitleSelected]}>
                  Specific days
                </Text>
                <Text style={s.freqOptionSubtitle}>Pick weekdays</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.freqOption, frequency === 'weekly' && s.freqOptionSelected]}
                onPress={() => setFrequency('weekly')}
                activeOpacity={0.8}
              >
                <Text style={[s.freqOptionTitle, frequency === 'weekly' && s.freqOptionTitleSelected]}>
                  Weekly goal
                </Text>
                <Text style={s.freqOptionSubtitle}>N times, any day</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Assigned Days (only for 'days' frequency) */}
          {frequency === 'days' && (
            <View style={s.fieldGroup}>
              <Text style={s.label}>Which days?</Text>

              {/* Quick select buttons */}
              <View style={s.quickSelectRow}>
                <TouchableOpacity style={s.quickButton} onPress={selectWeekdays}>
                  <Text style={s.quickButtonText}>Weekdays</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickButton} onPress={selectAllDays}>
                  <Text style={s.quickButtonText}>Every day</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.quickButton}
                  onPress={() => setAssignedDays([])}
                >
                  <Text style={s.quickButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>

              {/* Day chips */}
              <View style={s.dayRow}>
                {DAY_NAMES_SHORT.map((dayName, i) => {
                  const selected = assignedDays.includes(i as DayOfWeek);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.dayChip, selected && s.dayChipSelected]}
                      onPress={() => toggleDay(i as DayOfWeek)}
                    >
                      <Text
                        style={[s.dayChipText, selected && s.dayChipTextSelected]}
                      >
                        {dayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Weekly goal input */}
          {frequency === 'weekly' && (
            <View style={s.fieldGroup}>
              <Text style={s.label}>How many times per week?</Text>
              <View style={s.goalRow}>
                <TouchableOpacity
                  style={s.goalStep}
                  onPress={() => setWeeklyGoal(String(Math.max(1, parsedGoal - 1)))}
                  activeOpacity={0.7}
                >
                  <Text style={s.goalStepText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={s.goalInput}
                  value={weeklyGoal}
                  onChangeText={(t) => setWeeklyGoal(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={s.goalStep}
                  onPress={() => setWeeklyGoal(String(Math.min(7, parsedGoal + 1)))}
                  activeOpacity={0.7}
                >
                  <Text style={s.goalStepText}>+</Text>
                </TouchableOpacity>
                <Text style={s.goalSuffix}>per week</Text>
              </View>
              <Text style={s.goalHint}>
                Shows up every day so you can log it whenever you do it.
              </Text>
            </View>
          )}

          {/* Preview */}
          {name.trim() && (frequency === 'weekly' || assignedDays.length > 0) && (
            <View style={s.preview}>
              <Text style={s.previewTitle}>Preview</Text>
              <View style={s.previewCard}>
                <View style={s.previewRow}>
                  <View style={s.previewCheckbox} />
                  <View>
                    <Text style={s.previewName}>{name.trim()}</Text>
                    <Text style={s.previewDays}>{previewLabel}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Save Button */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.saveButton, !canSave && s.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.8}
          >
            <Text style={s.saveButtonText}>
              {isEditing ? 'Save Changes' : 'Add Workout'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 32 : 0,
    },
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cancelButton: {},
    cancelText: {
      fontSize: fontSize.md,
      color: colors.primary,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    headerSpacer: {
      width: 60,
    },
    form: {
      flex: 1,
    },
    formContent: {
      padding: spacing.lg,
      paddingBottom: 120,
    },
    fieldGroup: {
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSize.lg,
      color: colors.text,
    },
    freqRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    freqOption: {
      flex: 1,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
    },
    freqOptionSelected: {
      borderColor: '#F59E0B',
      backgroundColor: '#FEF3C7',
    },
    freqOptionTitle: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.text,
    },
    freqOptionTitleSelected: {
      color: '#B45309',
    },
    freqOptionSubtitle: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    goalStep: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalStepText: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primary,
      lineHeight: 24,
    },
    goalInput: {
      width: 64,
      height: 44,
      borderRadius: borderRadius.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      textAlign: 'center',
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    goalSuffix: {
      fontSize: fontSize.md,
      color: colors.textSubtle,
      marginLeft: spacing.xs,
    },
    goalHint: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: spacing.sm,
      fontStyle: 'italic',
    },
    quickSelectRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    quickButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickButtonText: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontWeight: '500',
    },
    dayRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dayChip: {
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.sm,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.card,
      minWidth: 44,
      alignItems: 'center',
    },
    dayChipSelected: {
      borderColor: '#F59E0B',
      backgroundColor: '#FEF3C7',
    },
    dayChipText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    dayChipTextSelected: {
      color: '#B45309',
    },
    preview: {
      marginTop: spacing.md,
    },
    previewTitle: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textSubtle,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    previewCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: '#F59E0B',
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    previewCheckbox: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      borderWidth: 2.5,
      borderColor: '#F59E0B',
      backgroundColor: colors.background,
    },
    previewName: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: colors.text,
    },
    previewDays: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: {
      backgroundColor: '#F59E0B',
      paddingVertical: spacing.md + 2,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    saveButtonDisabled: {
      backgroundColor: colors.checkboxEmpty,
      shadowOpacity: 0,
      elevation: 0,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
  });
}
