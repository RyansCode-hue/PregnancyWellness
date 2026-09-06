import React, { useState, useEffect, useMemo } from 'react';
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
import WhenToTakePicker from '../components/WhenToTakePicker';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import { saveSupplement, getSupplements } from '../storage/storage';
import { RootStackParamList, Frequency, Supplement } from '../types';

// Simple unique ID generator (no external dependency needed)
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditSupplement'>;

export default function AddEditSupplementScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const existing = route.params?.supplement;
  const isEditing = !!existing;

  const [name, setName] = useState(existing?.name || '');
  const [dosesPerDay, setDosesPerDay] = useState(
    existing ? String(existing.dosesPerDay) : ''
  );
  const [whenToTake, setWhenToTake] = useState(existing?.whenToTake || '');
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency || 'daily');
  const [linkedIds, setLinkedIds] = useState<string[]>(existing?.linkedSupplementIds || []);
  const [allSupplements, setAllSupplements] = useState<Supplement[]>([]);

  useEffect(() => {
    loadSupplements();
  }, []);

  const loadSupplements = async () => {
    const sups = await getSupplements();
    // Filter out this supplement itself
    setAllSupplements(sups.filter((s) => s.id !== existing?.id));
  };

  // Links are only valid between supplements that share a frequency (a linked
  // cluster is treated as one unit with one frequency everywhere else).
  const linkableSupplements = allSupplements.filter((s) => s.frequency === frequency);

  const handleSetFrequency = (next: Frequency) => {
    setFrequency(next);
    const linkableIds = new Set(
      allSupplements.filter((s) => s.frequency === next).map((s) => s.id),
    );
    setLinkedIds((prev) => prev.filter((id) => linkableIds.has(id)));
  };

  const toggleLink = (id: string) => {
    setLinkedIds((prev) =>
      prev.includes(id) ? prev.filter((lid) => lid !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing Name', 'Please enter a supplement name.');
      return;
    }

    const doses = parseInt(dosesPerDay, 10);
    if (isNaN(doses) || doses < 1 || doses > 20) {
      Alert.alert('Invalid Doses', 'Please enter a number between 1 and 20.');
      return;
    }

    await saveSupplement({
      id: existing?.id || generateId(),
      name: trimmedName,
      dosesPerDay: doses,
      whenToTake: whenToTake.trim() || undefined,
      frequency,
      linkedSupplementIds: linkedIds.length > 0 ? linkedIds : undefined,
      createdAt: existing?.createdAt || new Date().toISOString(),
    });

    navigation.goBack();
  };

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
            {isEditing ? 'Edit Supplement' : 'New Supplement'}
          </Text>
          <View style={s.headerSpacer} />
        </View>

        <ScrollView
          style={s.form}
          contentContainerStyle={s.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Supplement Name */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>Supplement Name</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Iron, Folate, Vitamin D"
              placeholderTextColor={colors.checkboxEmpty}
              value={name}
              onChangeText={setName}
              autoFocus={!isEditing}
              returnKeyType="next"
            />
          </View>

          {/* Frequency */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>Frequency</Text>
            <View style={s.freqRow}>
              <TouchableOpacity
                style={[s.freqOption, frequency === 'daily' && s.freqSelected]}
                onPress={() => handleSetFrequency('daily')}
              >
                <Text style={[s.freqText, frequency === 'daily' && s.freqTextSelected]}>
                  Daily
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.freqOption, frequency === 'weekly' && s.freqSelected]}
                onPress={() => handleSetFrequency('weekly')}
              >
                <Text style={[s.freqText, frequency === 'weekly' && s.freqTextSelected]}>
                  Weekly
                </Text>
              </TouchableOpacity>
            </View>

            {/* Weekly info */}
            {frequency === 'weekly' && (
              <Text style={s.weeklyHint}>
                Can be taken any day during the week
              </Text>
            )}
          </View>

          {/* Doses Per Day */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>
              {frequency === 'weekly' ? 'Doses Per Week' : 'Doses Per Day'}
            </Text>
            <View style={s.doseInputRow}>
              <TouchableOpacity
                style={s.doseButton}
                onPress={() => {
                  const current = parseInt(dosesPerDay, 10) || 0;
                  if (current > 1) setDosesPerDay(String(current - 1));
                }}
              >
                <Text style={s.doseButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={s.doseInput}
                placeholder="0"
                placeholderTextColor={colors.checkboxEmpty}
                value={dosesPerDay}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '');
                  setDosesPerDay(cleaned);
                }}
                keyboardType="number-pad"
                maxLength={2}
                textAlign="center"
              />
              <TouchableOpacity
                style={s.doseButton}
                onPress={() => {
                  const current = parseInt(dosesPerDay, 10) || 0;
                  if (current < 20) setDosesPerDay(String(current + 1));
                }}
              >
                <Text style={s.doseButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* When To Take */}
          <WhenToTakePicker value={whenToTake} onChange={setWhenToTake} />

          {/* Link Supplements */}
          {linkableSupplements.length > 0 && (
            <View style={s.fieldGroup}>
              <Text style={s.label}>Link Supplements</Text>
              <Text style={s.linkHint}>
                Linked supplements share dose progress — checking one checks the others.
                Only {frequency} supplements can be linked to a {frequency} one.
              </Text>
              <View style={s.linkChipsRow}>
                {linkableSupplements.map((sup) => {
                  const isLinked = linkedIds.includes(sup.id);
                  return (
                    <TouchableOpacity
                      key={sup.id}
                      style={[s.linkChip, isLinked && s.linkChipSelected]}
                      onPress={() => toggleLink(sup.id)}
                    >
                      <Text style={[s.linkChipText, isLinked && s.linkChipTextSelected]}>
                        {sup.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Preview */}
          {name.trim() && dosesPerDay && parseInt(dosesPerDay, 10) > 0 && (
            <View style={s.preview}>
              <Text style={s.previewTitle}>Preview</Text>
              <View style={s.previewCard}>
                <Text style={s.previewName}>{name.trim()}</Text>
                <Text style={s.previewFreq}>
                  {frequency === 'daily' ? 'Every day' : 'Weekly (any day)'}
                </Text>
                {whenToTake.trim() ? (
                  <Text style={s.previewWhen}>{whenToTake.trim()}</Text>
                ) : null}
                <View style={s.previewCheckboxes}>
                  {Array.from({ length: Math.min(parseInt(dosesPerDay, 10), 20) }).map(
                    (_, i) => (
                      <View key={i} style={s.previewCheckbox} />
                    )
                  )}
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Save Button */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[
              s.saveButton,
              (!name.trim() || !dosesPerDay) && s.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!name.trim() || !dosesPerDay}
            activeOpacity={0.8}
          >
            <Text style={s.saveButtonText}>
              {isEditing ? 'Save Changes' : 'Add Supplement'}
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
    // Frequency picker
    freqRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    freqOption: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.card,
    },
    freqSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    freqText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    freqTextSelected: {
      color: colors.primary,
    },
    weeklyHint: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: spacing.sm,
      fontStyle: 'italic',
    },
    linkHint: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginBottom: spacing.sm,
    },
    linkChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    linkChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    linkChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    linkChipText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textSubtle,
    },
    linkChipTextSelected: {
      color: colors.primary,
    },
    // Doses
    doseInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    doseButton: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doseButtonText: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '700',
      marginTop: -2,
    },
    doseInput: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSize.xxl,
      fontWeight: '700',
      color: colors.text,
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
      borderLeftColor: colors.primary,
    },
    previewName: {
      fontSize: fontSize.lg,
      fontWeight: '600',
      color: colors.text,
    },
    previewFreq: {
      fontSize: fontSize.sm,
      color: colors.primary,
      fontWeight: '500',
      marginTop: 2,
    },
    previewWhen: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    previewCheckboxes: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    previewCheckbox: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.sm,
      borderWidth: 2,
      borderColor: colors.checkboxEmpty,
      backgroundColor: colors.background,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md + 2,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      shadowColor: colors.primary,
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
