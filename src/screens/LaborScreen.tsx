import React, { useCallback, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import VideoModal from '../components/VideoModal';
import { HeartIcon, PlayIcon, ExternalLinkIcon, PlusIcon, ChevronUpIcon } from '../components/Icons';
import { useTheme } from '../ThemeContext';
import { spacing, fontSize, borderRadius, ThemeColors } from '../theme';
import { getLaborItems, deleteLaborItem } from '../storage/storage';
import { LaborItem, LaborStage, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Labor'>;

const STAGE_ORDER: LaborStage[] = ['early', 'active', 'transition', 'pushing'];
const STAGE_TITLES: Record<LaborStage, string> = {
  early: 'Early Labor',
  active: 'Active Labor',
  transition: 'Transition',
  pushing: 'Pushing',
};

// Section keys: the four labor stages, plus two "Other" buckets for items
// the user hasn't tagged yet (one per category).
type SectionKey = LaborStage | 'other-positions' | 'other-comforts';

function itemMatchesStage(item: LaborItem, stage: LaborStage): boolean {
  if (!item.stages || item.stages.length === 0) return false;
  return item.stages.includes(stage);
}

function isUntaggedPosition(item: LaborItem): boolean {
  return (
    item.category === 'position' && (!item.stages || item.stages.length === 0)
  );
}

function isUntaggedComfort(item: LaborItem): boolean {
  return (
    item.category === 'comfort' && (!item.stages || item.stages.length === 0)
  );
}

export default function LaborScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [items, setItems] = useState<LaborItem[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  // Default: only "Early Labor" expanded so the screen isn't a wall of text.
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    () => new Set<SectionKey>(['early']),
  );

  useFocusEffect(
    useCallback(() => {
      getLaborItems().then(setItems);
    }, []),
  );

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDelete = (item: LaborItem) => {
    Alert.alert(
      'Delete entry',
      `Remove "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteLaborItem(item.id);
            setItems(await getLaborItems());
          },
        },
      ],
    );
  };

  const handleEdit = (item: LaborItem) => {
    navigation.navigate('AddEditLabor', { item });
  };

  return (
    <View style={s.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.subHeader}>
          <Text style={s.headerTitle}>Labor</Text>
          <TouchableOpacity
            style={s.addButton}
            onPress={() => navigation.navigate('AddEditLabor')}
            activeOpacity={0.85}
          >
            <PlusIcon size={18} color="#FFFFFF" strokeWidth={3} />
            <Text style={s.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View style={s.emptyState}>
            <HeartIcon size={48} color={colors.checkboxEmpty} strokeWidth={1.5} />
            <Text style={s.emptyTitle}>No items yet</Text>
            <Text style={s.emptySubtitle}>
              Tap Add to save a labor position or comfort measure.
            </Text>
          </View>
        ) : (
          <>
            {STAGE_ORDER.map((stage) => {
              const stageItems = items.filter((i) => itemMatchesStage(i, stage));
              const positions = stageItems.filter((i) => i.category === 'position');
              const comforts = stageItems.filter((i) => i.category === 'comfort');
              const isExpanded = expandedSections.has(stage);

              return (
                <CollapsibleSection
                  key={stage}
                  title={STAGE_TITLES[stage]}
                  count={stageItems.length}
                  expanded={isExpanded}
                  onToggle={() => toggleSection(stage)}
                  colors={colors}
                  emptyMessage="No items tagged for this stage yet."
                >
                  {positions.length > 0 && (
                    <CategoryBlock
                      title="Positions"
                      color={colors.primary}
                      items={positions}
                      colors={colors}
                      onPlayVideo={setActiveVideo}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  )}
                  {comforts.length > 0 && (
                    <CategoryBlock
                      title="Comfort Methods"
                      color="#B45309"
                      items={comforts}
                      colors={colors}
                      onPlayVideo={setActiveVideo}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  )}
                </CollapsibleSection>
              );
            })}

            {/* Untagged buckets — only render when they have items. */}
            {(() => {
              const otherPositions = items.filter(isUntaggedPosition);
              if (otherPositions.length === 0) return null;
              const isExpanded = expandedSections.has('other-positions');
              return (
                <CollapsibleSection
                  title="Other Labor Positions"
                  count={otherPositions.length}
                  expanded={isExpanded}
                  onToggle={() => toggleSection('other-positions')}
                  colors={colors}
                >
                  <CategoryBlock
                    title="Positions"
                    color={colors.primary}
                    items={otherPositions}
                    colors={colors}
                    onPlayVideo={setActiveVideo}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </CollapsibleSection>
              );
            })()}

            {(() => {
              const otherComforts = items.filter(isUntaggedComfort);
              if (otherComforts.length === 0) return null;
              const isExpanded = expandedSections.has('other-comforts');
              return (
                <CollapsibleSection
                  title="Other Comfort Methods"
                  count={otherComforts.length}
                  expanded={isExpanded}
                  onToggle={() => toggleSection('other-comforts')}
                  colors={colors}
                >
                  <CategoryBlock
                    title="Comfort Methods"
                    color="#B45309"
                    items={otherComforts}
                    colors={colors}
                    onPlayVideo={setActiveVideo}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </CollapsibleSection>
              );
            })()}
          </>
        )}
      </ScrollView>

      <VideoModal
        visible={!!activeVideo}
        videoUrl={activeVideo ?? ''}
        onClose={() => setActiveVideo(null)}
      />
    </View>
  );
}

function CollapsibleSection({
  title,
  count,
  expanded,
  onToggle,
  colors,
  emptyMessage,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  colors: ThemeColors;
  emptyMessage?: string;
  children?: React.ReactNode;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.stageWrap}>
      <TouchableOpacity
        style={s.stageHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={s.stageHeaderLeft}>
          <Text style={s.stageTitle}>{title}</Text>
          <Text style={s.stageCount}>
            {count} {count === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <View style={[s.chevronWrap, !expanded && s.chevronCollapsed]}>
          <ChevronUpIcon size={18} color={colors.textSubtle} strokeWidth={2} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={s.stageBody}>
          {count === 0 && emptyMessage ? (
            <Text style={s.emptyStageText}>{emptyMessage}</Text>
          ) : (
            children
          )}
        </View>
      )}
    </View>
  );
}

function CategoryBlock({
  title,
  color,
  items,
  colors,
  onPlayVideo,
  onEdit,
  onDelete,
}: {
  title: string;
  color: string;
  items: LaborItem[];
  colors: ThemeColors;
  onPlayVideo: (url: string) => void;
  onEdit: (item: LaborItem) => void;
  onDelete: (item: LaborItem) => void;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.categoryBlock}>
      <View style={[s.categoryHeader, { borderLeftColor: color }]}>
        <Text style={[s.categoryTitle, { color }]}>{title}</Text>
      </View>
      {items.map((item) => (
        <LaborCard
          key={item.id}
          item={item}
          colors={colors}
          onPlayVideo={onPlayVideo}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </View>
  );
}

function LaborCard({
  item,
  colors,
  onPlayVideo,
  onEdit,
  onDelete,
}: {
  item: LaborItem;
  colors: ThemeColors;
  onPlayVideo: (url: string) => void;
  onEdit: (item: LaborItem) => void;
  onDelete: (item: LaborItem) => void;
}) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  const swipeableRef = useRef<Swipeable>(null);
  const close = () => swipeableRef.current?.close();

  const renderRightActions = () => (
    <View style={s.swipeActions}>
      <RectButton
        style={[s.swipeAction, s.swipeEdit]}
        onPress={() => {
          close();
          onEdit(item);
        }}
      >
        <Text style={s.swipeActionText}>Edit</Text>
      </RectButton>
      <RectButton
        style={[s.swipeAction, s.swipeDelete]}
        onPress={() => {
          close();
          onDelete(item);
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
      <View style={s.card}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={s.cardImage} resizeMode="cover" />
        ) : null}
        <View style={s.cardBody}>
          <Text style={s.cardName}>{item.name}</Text>
          {item.caption ? <Text style={s.cardCaption}>{item.caption}</Text> : null}
          <View style={s.cardActions}>
            {item.videoUrl ? (
              <TouchableOpacity
                style={s.actionButton}
                onPress={() => onPlayVideo(item.videoUrl!)}
                activeOpacity={0.75}
              >
                <PlayIcon size={14} color={colors.primary} />
                <Text style={s.actionText}>Watch video</Text>
              </TouchableOpacity>
            ) : null}
            {item.externalUrl ? (
              <TouchableOpacity
                style={s.actionButton}
                onPress={() =>
                  Linking.openURL(item.externalUrl!).catch((err) => {
                    console.error('Failed to open external link', item.externalUrl, err);
                    Alert.alert('Could not open link', 'No app on this device can open that link.');
                  })
                }
                activeOpacity={0.75}
              >
                <ExternalLinkIcon size={14} color={colors.primary} strokeWidth={2} />
                <Text style={s.actionText}>Learn more</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
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
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primaryDark,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
    },
    addButtonText: {
      color: '#FFFFFF',
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.text,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    emptySubtitle: {
      fontSize: fontSize.md,
      color: colors.textSubtle,
      textAlign: 'center',
    },
    stageWrap: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    stageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    stageHeaderLeft: {
      flex: 1,
    },
    stageTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    stageCount: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      marginTop: 2,
    },
    chevronWrap: {
      transform: [{ rotate: '0deg' }],
    },
    chevronCollapsed: {
      transform: [{ rotate: '180deg' }],
    },
    stageBody: {
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.sm,
    },
    emptyStageText: {
      fontSize: fontSize.sm,
      color: colors.textSubtle,
      fontStyle: 'italic',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
    },
    categoryBlock: {
      marginTop: spacing.sm,
    },
    categoryHeader: {
      paddingLeft: spacing.sm,
      borderLeftWidth: 3,
      marginBottom: spacing.xs,
      marginLeft: 4,
    },
    categoryTitle: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cardImage: {
      width: '100%',
      height: 160,
      backgroundColor: colors.border,
    },
    cardBody: {
      padding: spacing.md,
    },
    cardName: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    cardCaption: {
      fontSize: fontSize.md,
      color: colors.textSubtle,
      marginTop: spacing.xs,
      lineHeight: 20,
    },
    cardActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs + 2,
      backgroundColor: colors.primaryLight,
      borderRadius: borderRadius.full,
    },
    actionText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.primary,
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
  });
}
