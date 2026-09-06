import React, { useState, useMemo } from 'react';
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
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import { saveLaborItem } from '../storage/storage';
import { LaborCategory, LaborStage, RootStackParamList } from '../types';

const STAGE_ORDER: LaborStage[] = ['early', 'active', 'transition', 'pushing'];
const STAGE_LABELS: Record<LaborStage, string> = {
  early: 'Early',
  active: 'Active',
  transition: 'Transition',
  pushing: 'Pushing',
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditLabor'>;

export default function AddEditLaborScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const existing = route.params?.item;
  const isEditing = !!existing;

  const [category, setCategory] = useState<LaborCategory>(existing?.category ?? 'position');
  const [name, setName] = useState(existing?.name ?? '');
  const [caption, setCaption] = useState(existing?.caption ?? '');
  const [imageUri, setImageUri] = useState<string | undefined>(existing?.imageUri);
  const [videoUrl, setVideoUrl] = useState(existing?.videoUrl ?? '');
  const [externalUrl, setExternalUrl] = useState(existing?.externalUrl ?? '');
  const [stages, setStages] = useState<LaborStage[]>(existing?.stages ?? []);

  const toggleStage = (stage: LaborStage) => {
    setStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage],
    );
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'We need access to your photos to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 10],
    });
    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing name', 'Please enter a name for this entry.');
      return;
    }
    await saveLaborItem({
      id: existing?.id ?? generateId(),
      category,
      name: trimmedName,
      caption: caption.trim(),
      imageUri,
      videoUrl: videoUrl.trim() || undefined,
      externalUrl: externalUrl.trim() || undefined,
      stages: stages.length > 0 ? stages : undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="default" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.flex}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{isEditing ? 'Edit Entry' : 'New Entry'}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={s.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Category */}
          <Text style={s.label}>Category</Text>
          <View style={s.segmentRow}>
            <TouchableOpacity
              style={[s.segment, category === 'position' && s.segmentActive]}
              onPress={() => setCategory('position')}
              activeOpacity={0.8}
            >
              <Text style={[s.segmentText, category === 'position' && s.segmentTextActive]}>
                Position
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.segment, category === 'comfort' && s.segmentActive]}
              onPress={() => setCategory('comfort')}
              activeOpacity={0.8}
            >
              <Text style={[s.segmentText, category === 'comfort' && s.segmentTextActive]}>
                Comfort Measure
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stages */}
          <Text style={s.label}>What part(s) of labor?</Text>
          <View style={s.stagesRow}>
            {STAGE_ORDER.map((stage) => {
              const selected = stages.includes(stage);
              return (
                <TouchableOpacity
                  key={stage}
                  style={[s.stageChip, selected && s.stageChipActive]}
                  onPress={() => toggleStage(stage)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.stageChipText, selected && s.stageChipTextActive]}>
                    {STAGE_LABELS[stage]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.hint}>Leave empty to show in every stage.</Text>

          {/* Name */}
          <Text style={s.label}>Name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Hands and knees"
            placeholderTextColor={colors.checkboxEmpty}
          />

          {/* Caption */}
          <Text style={s.label}>Caption</Text>
          <TextInput
            style={[s.input, s.multilineInput]}
            value={caption}
            onChangeText={setCaption}
            placeholder="Short description or how-to..."
            placeholderTextColor={colors.checkboxEmpty}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Image */}
          <Text style={s.label}>Image</Text>
          {imageUri ? (
            <View style={s.imagePreviewWrap}>
              <Image source={{ uri: imageUri }} style={s.imagePreview} resizeMode="cover" />
              <View style={s.imageButtonRow}>
                <TouchableOpacity style={s.imageButton} onPress={pickImage} activeOpacity={0.8}>
                  <Text style={s.imageButtonText}>Replace</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.imageButton, s.imageButtonDanger]}
                  onPress={() => setImageUri(undefined)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.imageButtonText, s.imageButtonTextDanger]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.pickImageButton} onPress={pickImage} activeOpacity={0.85}>
              <Text style={s.pickImageText}>Choose image</Text>
            </TouchableOpacity>
          )}

          {/* Video URL */}
          <Text style={s.label}>Video URL (optional)</Text>
          <TextInput
            style={s.input}
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder="https://youtube.com/watch?v=..."
            placeholderTextColor={colors.checkboxEmpty}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={s.hint}>YouTube link plays in-app. Leave blank to hide the video button.</Text>

          {/* External URL */}
          <Text style={s.label}>External link (optional)</Text>
          <TextInput
            style={s.input}
            value={externalUrl}
            onChangeText={setExternalUrl}
            placeholder="https://..."
            placeholderTextColor={colors.checkboxEmpty}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md + 10,
      paddingBottom: spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    cancelText: {
      fontSize: fontSize.md,
      color: colors.textSubtle,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    saveText: {
      fontSize: fontSize.md,
      color: colors.primary,
      fontWeight: '700',
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xl * 2,
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: colors.textSubtle,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: 4,
      gap: 4,
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: borderRadius.sm,
    },
    segmentActive: {
      backgroundColor: colors.primaryLight,
    },
    segmentText: {
      fontSize: fontSize.md,
      color: colors.textSubtle,
      fontWeight: '600',
    },
    segmentTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: fontSize.md,
      color: colors.text,
    },
    multilineInput: {
      minHeight: 96,
      paddingTop: spacing.sm + 2,
    },
    pickImageButton: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: 'dashed',
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    pickImageText: {
      fontSize: fontSize.md,
      color: colors.primary,
      fontWeight: '600',
    },
    imagePreviewWrap: {
      gap: spacing.sm,
    },
    imagePreview: {
      width: '100%',
      height: 180,
      borderRadius: borderRadius.md,
      backgroundColor: colors.border,
    },
    imageButtonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    imageButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
    },
    imageButtonDanger: {
      borderColor: colors.danger,
    },
    imageButtonText: {
      fontSize: fontSize.md,
      color: colors.text,
      fontWeight: '600',
    },
    imageButtonTextDanger: {
      color: colors.danger,
    },
    hint: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: spacing.xs,
      fontStyle: 'italic',
    },
    stagesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    stageChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    stageChipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    stageChipText: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontWeight: '600',
    },
    stageChipTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
  });
}
