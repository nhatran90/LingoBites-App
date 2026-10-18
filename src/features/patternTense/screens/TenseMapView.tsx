import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {useAppNavigation} from '@core/navigation';

import {levelChip} from '../components/memoryColors';
import {TenseThumb} from '../components/TenseThumb';
import {
  type LibraryTense,
  type MemoryLevel,
  memoryLevel,
  TENSE_TIMES,
  tenseGrid,
} from '../logic/libraryModel';
import {memoryOf} from '../logic/libraryRepository';
import {useTenseLibrary} from '../logic/useLibrary';

/** The legend's order: what is remembered first. */
const LEVELS: readonly MemoryLevel[] = [
  'stable',
  'recalling',
  'started',
  'new',
];

type Group = (typeof TENSE_TIMES)[number] | 'other';

/** Each group's badge: its icon on a soft face. */
function groupBadge(theme: AppTheme, group: Group) {
  const {colors} = theme;
  const badges: Record<
    Group,
    {icon: HandoffIconName; face: string; ink: string}
  > = {
    past: {
      icon: 'replay',
      face: solidOver(colors.tertiarySoft, colors.background),
      ink: colors.onTertiaryContainer,
    },
    present: {icon: 'schedule', face: colors.accentSoft, ink: colors.primary},
    future: {
      icon: 'flag',
      face: solidOver(colors.secondarySoft, colors.background),
      ink: colors.onSecondaryContainer,
    },
    other: {icon: 'style', face: colors.accentSoft, ink: colors.primary},
  };
  return badges[group];
}

function GroupHead({
  group,
  title,
  count,
}: {
  group: Group;
  title: string;
  count?: string;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const badge = groupBadge(theme, group);
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.medal, {backgroundColor: badge.face}]}>
        <MaterialIcon color={badge.ink} name={badge.icon} size={18} />
      </View>
      <AppText style={styles.sectionTitle}>{title}</AppText>
      {count ? <AppText style={styles.sectionCount}>{count}</AppText> : null}
    </View>
  );
}

type TileProps = {
  tense: LibraryTense;
  level: MemoryLevel;
  onPress: () => void;
};

/** One tense: its picture as the face, the names in white over the scrim. */
function TenseTile({tense, level, onPress}: TileProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const chip = levelChip(theme, level);
  const code = tense.item.code;
  return (
    <Pressable
      accessibilityHint={t('patternTense.open_tense_hint')}
      accessibilityLabel={`${tense.item.text}, ${t(`patternTense.level_${level}`)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.tile,
        getStickerEdge(pressed ? 1 : 4, chip.edge),
        pressed ? styles.pressed : null,
      ]}
      testID={`tense-cell-${code}`}
    >
      {/* The face clips the picture; the tile itself keeps its edge (an iOS shadow is clipped too). */}
      <View style={styles.tileFace}>
        <TenseThumb
          iconSize={40}
          id={`tense-tile-${code}`}
          imageUrl={tense.imageUrl}
          testID={`tense-cell-${code}-thumb`}
          time={tense.time}
        />
        {chip.icon ? (
          <View
            style={[styles.chip, {backgroundColor: chip.face}]}
            testID={`tense-cell-${code}-level`}
          >
            <MaterialIcon color={chip.ink} name={chip.icon} size={14} />
            <AppText style={[styles.chipText, {color: chip.ink}]}>
              {t(`patternTense.level_${level}`)}
            </AppText>
          </View>
        ) : null}
        <AppText style={styles.tileTitle}>{tense.item.text}</AppText>
        <AppText style={styles.tileMeaning}>{tense.item.meaning_vi}</AppText>
      </View>
    </Pressable>
  );
}

/** Two tiles a row; an odd one out keeps its half width. */
function TileGrid({
  tenses,
  levelOf,
  onOpen,
}: {
  tenses: Array<LibraryTense | null>;
  levelOf: (tense: LibraryTense) => MemoryLevel;
  onOpen: (tense: LibraryTense) => void;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const rows: Array<Array<LibraryTense | null>> = [];
  for (let index = 0; index < tenses.length; index += 2) {
    rows.push([tenses[index] ?? null, tenses[index + 1] ?? null]);
  }
  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          {row.map((tense, column) =>
            tense ? (
              <TenseTile
                key={tense.item.code}
                level={levelOf(tense)}
                onPress={() => onOpen(tense)}
                tense={tense}
              />
            ) : (
              <View key={`empty-${column}`} style={styles.flex} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * Vocab path P6 (F3): the tense map, a Library section. A progress card
 * (how many tenses are remembered, by level), then one group per time, each
 * a 2 × 2 grid in aspect order (simple, continuous, perfect, perfect
 * continuous) of picture tiles marked by how well the learner remembers that
 * tense (`item_memory`). Tenses outside the grid (be going to) follow below.
 */
export function TenseMapView() {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const appNavigation = useAppNavigation();
  const {data, loading, offline, reload} = useTenseLibrary();

  if (!data) {
    return loading ? (
      <ActivityIndicator style={styles.loading} />
    ) : (
      <View style={styles.message} testID="tense-map-offline">
        <AppText color="secondary">{t('patternTense.needs_network')}</AppText>
        <AppButton
          onPress={reload}
          title={t('patternTense.retry')}
          variant="outline"
        />
      </View>
    );
  }
  if (data.length === 0) {
    return (
      <AppText color="secondary" style={styles.empty}>
        {t('patternTense.no_tenses')}
      </AppText>
    );
  }

  const grid = tenseGrid(data);
  const levels = new Map(
    data.map(tense => [
      tense.item.code,
      memoryLevel(memoryOf(tense.item.code)),
    ]),
  );
  const levelOf = (tense: LibraryTense) => levels.get(tense.item.code) ?? 'new';
  const open = (tense: LibraryTense) =>
    appNavigation.openTenseDetail(tense.item.code);
  const count = (level: MemoryLevel) =>
    data.filter(tense => levelOf(tense) === level).length;
  const legendColor = (level: MemoryLevel) =>
    level === 'new' ? theme.colors.surfaceHigh : levelChip(theme, level).edge;

  return (
    <ScrollView contentContainerStyle={styles.content} testID="tense-map">
      {offline ? (
        <AppText color="secondary" testID="tense-map-stale">
          {t('patternTense.offline_kept')}
        </AppText>
      ) : null}

      <View style={styles.card} testID="tense-map-progress">
        <AppText style={styles.kicker}>
          {t('patternTense.progress_kicker')}
        </AppText>
        <AppText style={styles.progressCount}>
          {t('patternTense.progress_count', {
            count: count('stable'),
            total: data.length,
          })}
        </AppText>
        <View style={styles.stack}>
          {LEVELS.filter(level => level !== 'new' && count(level) > 0).map(
            level => (
              <View
                key={level}
                style={{
                  backgroundColor: legendColor(level),
                  flex: count(level),
                }}
              />
            ),
          )}
          {count('new') > 0 ? <View style={{flex: count('new')}} /> : null}
        </View>
        <View style={styles.legend} testID="tense-map-legend">
          {LEVELS.map(level => (
            <View key={level} style={styles.legendItem}>
              <View
                style={[styles.swatch, {backgroundColor: legendColor(level)}]}
              />
              <AppText color="secondary" style={styles.flex}>
                {t(`patternTense.level_${level}`)}
              </AppText>
              <AppText style={styles.legendCount}>{count(level)}</AppText>
            </View>
          ))}
        </View>
      </View>

      {TENSE_TIMES.map((time, row) => {
        const cells = grid.cells[row]!;
        if (cells.every(cell => cell === null)) return null;
        const remembered = cells.filter(
          cell => cell && levelOf(cell) === 'stable',
        ).length;
        const total = cells.filter(Boolean).length;
        return (
          <View key={time} style={styles.section} testID={`tense-time-${time}`}>
            <GroupHead
              count={t('patternTense.time_remembered', {
                count: remembered,
                total,
              })}
              group={time}
              title={t(`patternTense.time_${time}`)}
            />
            <TileGrid levelOf={levelOf} onOpen={open} tenses={cells} />
          </View>
        );
      })}

      {grid.others.length > 0 ? (
        <View style={styles.section}>
          <GroupHead group="other" title={t('patternTense.other_tenses')} />
          <TileGrid levelOf={levelOf} onOpen={open} tenses={grid.others} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 26,
      gap: 10,
      padding: theme.spacing.lg,
      ...getStickerEdge(4, colors.surfaceHigh),
    },
    chip: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 3,
      left: 8,
      paddingLeft: 6,
      paddingRight: 9,
      paddingVertical: 3,
      position: 'absolute',
      top: 8,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    content: {
      gap: 18,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xs,
    },
    empty: {
      marginTop: theme.spacing.lg,
      textAlign: 'center',
    },
    flex: {
      flex: 1,
    },
    grid: {
      gap: 10,
    },
    gridRow: {
      flexDirection: 'row',
      gap: 10,
    },
    kicker: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 6,
      columnGap: 16,
    },
    legendCount: {
      color: colors.text.primary,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
    },
    legendItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 7,
      width: '46%',
    },
    loading: {
      marginTop: 32,
    },
    medal: {
      alignItems: 'center',
      borderRadius: 10,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    message: {
      alignItems: 'center',
      gap: theme.spacing.md,
      marginTop: 32,
      paddingHorizontal: theme.spacing.md,
    },
    pressed: {
      transform: [{translateY: 2}],
    },
    progressCount: {
      color: colors.text.primary,
      fontSize: 20,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
    },
    section: {
      gap: 10,
    },
    sectionCount: {
      color: colors.text.muted,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
    },
    sectionHead: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    sectionTitle: {
      color: colors.text.primary,
      flex: 1,
      fontSize: 17,
      fontWeight: '800',
    },
    stack: {
      backgroundColor: colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 2,
      height: 12,
      overflow: 'hidden',
    },
    swatch: {
      borderRadius: 4,
      height: 12,
      width: 12,
    },
    tile: {
      backgroundColor: HERO_PALETTE.ink,
      borderRadius: 20,
      flex: 1,
    },
    tileFace: {
      borderRadius: 20,
      flex: 1,
      gap: 2,
      justifyContent: 'flex-end',
      minHeight: 132,
      overflow: 'hidden',
      paddingBottom: 11,
      paddingHorizontal: 11,
      paddingTop: 36,
    },
    tileMeaning: {
      color: HERO_PALETTE.chip,
      fontSize: 12.5,
      lineHeight: 16,
    },
    tileTitle: {
      color: HERO_PALETTE.white,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 19,
    },
  });
}
