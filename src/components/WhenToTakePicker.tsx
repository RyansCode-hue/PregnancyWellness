import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { ThemeColors, spacing, fontSize, borderRadius } from '../theme';
import { useTheme } from '../ThemeContext';

const PRESETS = [
  'Morning',
  'Afternoon',
  'Evening',
  'Before bed',
  'With breakfast',
  'With lunch',
  'With dinner',
  'After a meal',
  'On empty stomach',
  'With water',
];

interface WhenToTakePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function WhenToTakePicker({ value, onChange }: WhenToTakePickerProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [showCustom, setShowCustom] = useState(
    value !== '' && !PRESETS.includes(value)
  );

  const handlePresetPress = (preset: string) => {
    if (value === preset) {
      onChange('');
    } else {
      onChange(preset);
      setShowCustom(false);
    }
  };

  const handleCustomToggle = () => {
    setShowCustom(true);
    if (PRESETS.includes(value)) {
      onChange('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>When to take (optional)</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        {PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset}
            style={[
              styles.chip,
              value === preset && styles.chipSelected,
            ]}
            onPress={() => handlePresetPress(preset)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                value === preset && styles.chipTextSelected,
              ]}
            >
              {preset}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.chip,
            styles.chipCustom,
            showCustom && styles.chipSelected,
          ]}
          onPress={handleCustomToggle}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.chipText,
              showCustom && styles.chipTextSelected,
            ]}
          >
            Custom...
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {showCustom && (
        <TextInput
          style={styles.customInput}
          placeholder="e.g. After morning walk"
          placeholderTextColor={colors.checkboxEmpty}
          value={PRESETS.includes(value) ? '' : value}
          onChangeText={onChange}
          autoFocus
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipCustom: {
    borderStyle: 'dashed',
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  customInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.md,
    color: colors.text,
  },
});
}
