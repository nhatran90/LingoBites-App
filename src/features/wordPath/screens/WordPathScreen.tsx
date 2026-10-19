import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppProgressBar} from '@ui/components/AppProgressBar';
import {AppScreen} from '@ui/components/AppScreen';
import {AppTabs} from '@ui/components/AppTabs';
import {AppText} from '@ui/components/AppText';
import {topicGlyph} from '@ui/components/LibraryCover';
import {PackStatusCard} from '@ui/components/PackStatusCard';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import type {CardAction} from '@ui/components/ToneCard';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {levelTone} from '@ui/theme/levelColors';

import {useAppNavigation} from '@core/navigation';

import {
  continuePackOf,
  matchesQuery,
  type PackKind,
  type PackRow,
  type PackStatus,
} from '../logic/packRows';
import {useWordPathRows} from '../logic/useWordPathRows';
import {saveWordPack} from '../logic/wordPackRepository';
import {fetchWordPack} from '../logic/wordPathClient';
import {kindSummary, packTitle} from './packText';

type Props = {navigation?: {goBack?: () => void}};

type Translate = ReturnType<typeof useTranslation>['t'];

function actionLabel(t: Translate, status: PackStatus): string {
  switch (status) {
    case 'not_downloaded':
      return t('wordPath.download');
    case 'ready':
      return t('wordPath.action_start');
    case 'learning':
      return t('wordPath.action_continue');
    case 'done':
      return t('wordPath.action_review');
  }
}

const ACTION_GLYPH: Record<PackStatus, CardAction['glyph']> = {
  not_downloaded: 'download',
  ready: 'play',
  learning: 'play',
  done: 'check',
};

/** The list's sections, in the order the learner meets them. */
const SECTION_ORDER: readonly PackStatus[] = [
  'learning',
  'ready',
  'not_downloaded',
  'done',
];

/** "4 xong · 1 đang học · 2 đã tải · 9 chưa tải" under a level. */
const BREAKDOWN_ORDER: readonly PackStatus[] = [
  'done',
  'learning',
  'ready',
  'not_downloaded',
];

type PackCardProps = {
  row: PackRow;
  busy: boolean;
  disabled: boolean;
  onPress: (row: PackRow) => void;
};

/** A pack drawn like the Library's stack cards, coloured by its status. */
function PackCard({row, busy, disabled, onPress}: PackCardProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  return (
    <PackStatusCard
      accessibilityHint={
        row.downloaded ? t('wordPath.open_hint') : t('wordPath.download_hint')
      }
      action={{
        label: busy ? t('wordPath.downloading') : actionLabel(t, row.status),
        glyph: ACTION_GLYPH[row.status],
        solid: row.downloaded,
      }}
      cover={{imageUrl: row.coverUrl, glyph: topicGlyph(row.topicCode)}}
      description={kindSummary(t, row.kindCounts)}
      disabled={disabled}
      eyebrow={
        row.topic ? t('wordPath.pack_title', {position: row.position}) : null
      }
      gutter={theme.spacing.md}
      learned={row.learned}
      learnedLabel={t('wordPath.learned_label')}
      level={row.level}
      onPress={() => onPress(row)}
      remoteNote={t('wordPath.remote_note')}
      status={row.status}
      statusLabel={t(`wordPath.status_${row.status}`)}
      testID={`word-path-pack-${row.packId}`}
      title={packTitle(t, row)}
      total={row.total}
    />
  );
}

type LevelPickerProps = {
  levels: readonly string[];
  rows: readonly PackRow[];
  value: string;
  onChange: (level: string) => void;
};

/** One button per CEFR level, in its colour, with how many packs are done. */
function LevelPicker({levels, rows, value, onChange}: LevelPickerProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ScrollView
      contentContainerStyle={styles.levelPicker}
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="word-path-levels"
    >
      {levels.map(level => {
        const tone = levelTone(theme, level);
        const inLevel = rows.filter(row => row.level === level);
        const done = inLevel.filter(row => row.status === 'done').length;
        const selected = level === value;
        return (
          <Pressable
            accessibilityHint={t('wordPath.level_pick_hint')}
            accessibilityLabel={`${level} ${t(`wordPath.level_${level}`, {
              defaultValue: '',
            })}. ${t('wordPath.level_done', {done, total: inLevel.length})}`}
            accessibilityRole="button"
            accessibilityState={{selected}}
            key={level}
            onPress={() => onChange(level)}
            style={[
              themedStyles.levelButton,
              selected
                ? [
                    styles.levelButtonOn,
                    getStickerEdge(3, tone.strong),
                    {borderColor: tone.strong},
                  ]
                : null,
            ]}
            testID={`word-path-level-tab-${level}`}
          >
            <View style={[styles.levelChip, {backgroundColor: tone.strong}]}>
              <AppText style={[styles.levelChipText, {color: tone.on}]}>
                {level}
              </AppText>
            </View>
            <AppText color="secondary" style={styles.levelCount}>
              {`${done}/${inLevel.length}`}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A level's name, what its packs are at, and the app's progress bar. */
function LevelSummary({level, rows}: {level: string; rows: PackRow[]}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const tone = levelTone(theme, level);
  const countOf = (status: PackStatus) =>
    rows.filter(row => row.status === status).length;
  const done = countOf('done');
  const learning = countOf('learning');
  const breakdown = BREAKDOWN_ORDER.filter(status => countOf(status) > 0)
    .map(status => t(`wordPath.count_${status}`, {count: countOf(status)}))
    .join(' · ');
  return (
    <View style={themedStyles.levelSummary}>
      <View style={styles.levelSummaryHead}>
        <View style={[styles.levelBadge, {backgroundColor: tone.strong}]}>
          <AppText style={[styles.levelBadgeText, {color: tone.on}]}>
            {level}
          </AppText>
        </View>
        <View style={styles.levelSummaryText}>
          <AppText variant="h3">
            {t(`wordPath.level_${level}`, {defaultValue: level})}
          </AppText>
          <AppText color="secondary" variant="caption">
            {breakdown}
          </AppText>
        </View>
      </View>
      <AppProgressBar
        accessibilityValue={{
          text: t('wordPath.level_done', {done, total: rows.length}),
        }}
        count={`${done}/${rows.length}`}
        current={learning > 0 ? done : undefined}
        done={done}
        surface="card"
        testID={`word-path-level-progress-${level}`}
        total={rows.length}
      />
    </View>
  );
}

type KindTabsProps = {
  kind: PackKind;
  counts: Record<PackKind, number>;
  onChange: (kind: PackKind) => void;
};

function KindTabs({kind, counts, onChange}: KindTabsProps) {
  const {t} = useTranslation();
  return (
    <AppTabs
      accessibilityHint={t('wordPath.tab_hint')}
      onChange={onChange}
      tabs={[
        {id: 'word', label: t('wordPath.tab_words'), count: counts.word},
        {
          id: 'sentence',
          label: t('wordPath.tab_sentences'),
          count: counts.sentence,
        },
      ]}
      testID="word-path-tab"
      value={kind}
    />
  );
}

/**
 * Vocab path P5: the packs to download and learn, as a list split into word
 * packs and sentence packs. The Library shows it inside its own screen;
 * `query` filters the packs by title, topic and first items.
 */
export function WordPathList({query = ''}: {query?: string}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {rows, offline, reload: load} = useWordPathRows();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<PackKind>('word');
  const [level, setLevel] = useState<string | null>(null);

  /** Opens a pack on the device; downloads it first when it is not. */
  const openPack = async (row: PackRow) => {
    if (row.downloaded) {
      appNavigation.openWordPack(row.packId);
      return;
    }
    setBusy(row.packId);
    setFailed(false);
    const result = await fetchWordPack(row.packId);
    if (result.ok) {
      saveWordPack(result.value, new Date());
      await load();
      appNavigation.openWordPack(row.packId);
    } else {
      setFailed(true);
    }
    setBusy(null);
  };

  if (rows === null) return null;

  const needle = query.trim().toLowerCase();
  const counts: Record<PackKind, number> = {
    word: rows.filter(row => row.kind === 'word').length,
    sentence: rows.filter(row => row.kind === 'sentence').length,
  };
  const ofKind = rows.filter(row => row.kind === kind);
  const shown = ofKind.filter(row => matchesQuery(row, needle));
  const allLevels = [...new Set(ofKind.map(row => row.level))];
  const pickedLevel =
    level !== null && allLevels.includes(level)
      ? level
      : (continuePackOf(ofKind)?.level ?? allLevels[0] ?? null);
  // A search looks through every level; otherwise only the picked one shows.
  const levels = needle
    ? [...new Set(shown.map(row => row.level))]
    : pickedLevel !== null
      ? [pickedLevel]
      : [];

  return (
    <ScrollView contentContainerStyle={themedStyles.container}>
      {offline ? (
        <AppText color="secondary" testID="word-path-offline">
          {t('wordPath.offline')}
        </AppText>
      ) : null}
      {rows.length === 0 ? (
        <AppCard testID="word-path-empty">
          <AppText color="secondary">{t('wordPath.empty')}</AppText>
        </AppCard>
      ) : (
        <>
          <KindTabs counts={counts} kind={kind} onChange={setKind} />
          {!needle && allLevels.length > 1 && pickedLevel !== null ? (
            <LevelPicker
              levels={allLevels}
              onChange={setLevel}
              rows={ofKind}
              value={pickedLevel}
            />
          ) : null}
          {ofKind.length === 0 ? (
            <AppCard testID={`word-path-empty-${kind}`}>
              <AppText color="secondary">
                {kind === 'word'
                  ? t('wordPath.empty_words')
                  : t('wordPath.empty_sentences')}
              </AppText>
            </AppCard>
          ) : null}
          {ofKind.length > 0 && shown.length === 0 ? (
            <AppText color="secondary" testID="word-path-no-match">
              {t('wordPath.no_match')}
            </AppText>
          ) : null}
          {levels.map(shownLevel => {
            const inLevel = shown.filter(row => row.level === shownLevel);
            return (
              <View
                key={shownLevel}
                style={styles.levelGroup}
                testID={`word-path-level-${shownLevel}`}
              >
                <LevelSummary level={shownLevel} rows={inLevel} />
                {SECTION_ORDER.map(status => {
                  const inSection = inLevel
                    .filter(row => row.status === status)
                    .sort((a, b) => a.position - b.position);
                  if (inSection.length === 0) return null;
                  const hint =
                    status === 'ready' || status === 'not_downloaded'
                      ? t(`wordPath.section_${status}_hint`)
                      : null;
                  return (
                    <View
                      key={status}
                      style={styles.section}
                      testID={`word-path-section-${shownLevel}-${status}`}
                    >
                      <View style={styles.sectionHeader}>
                        <AppText variant="h3">
                          {t(`wordPath.section_${status}`)}
                        </AppText>
                        {hint ? (
                          <AppText color="secondary" variant="caption">
                            {hint}
                          </AppText>
                        ) : null}
                      </View>
                      {inSection.map(row => (
                        <PackCard
                          busy={busy === row.packId}
                          disabled={busy !== null}
                          key={row.packId}
                          onPress={openPack}
                          row={row}
                        />
                      ))}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </>
      )}
      <AppButton
        onPress={() => appNavigation.openComboHistory()}
        testID="word-path-combo-history"
        title={t('wordPath.combo_history')}
        variant="outline"
      />
      {failed ? (
        <AppText color="danger">{t('wordPath.download_failed')}</AppText>
      ) : null}
    </ScrollView>
  );
}

/**
 * Vocab path P5: the word path as its own screen (its list is also shown in the
 * Library).
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function WordPathScreen({navigation}: Props) {
  const {t} = useTranslation();
  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('wordPath.title')}
      />
      <WordPathList />
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
    levelButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 6,
      minHeight: 48,
      paddingHorizontal: 12,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    levelSummary: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
  });
}

const styles = StyleSheet.create({
  levelButtonOn: {
    borderWidth: 2,
  },
  levelGroup: {
    gap: 18,
  },
  levelPicker: {
    gap: 8,
    paddingBottom: 4,
  },
  levelChip: {
    alignItems: 'center',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  levelChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  levelCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  levelSummaryHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  levelBadge: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  levelBadgeText: {
    fontSize: 16,
    fontWeight: '800',
  },
  levelSummaryText: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
