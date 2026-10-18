import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {SpeechNotice, useSpeak} from '@features/audio';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {StickerFooter} from '@ui/components/StickerFooter';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {readCatalogItems} from '@core/db/catalogItems';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {AddToReviewButton} from '../components/AddToReviewButton';
import {levelChip} from '../components/memoryColors';
import {TenseThumb} from '../components/TenseThumb';
import {TenseTimeline} from '../components/TenseTimeline';
import {type MemoryLevel, memoryLevel, tenseInfo} from '../logic/libraryModel';
import {memoryOf, readTenseImageUrl} from '../logic/libraryRepository';
import type {TenseDetailRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: TenseDetailRouteParams};
  /** Tests pass the tense and the tenses it is confused with; read from the device otherwise. */
  item?: CatalogItem | null;
  related?: CatalogItem[];
  /** Tests pass the picture; read from the kept tense map otherwise. */
  imageUrl?: string | null;
};

function readItems(codes: string[]): Map<string, CatalogItem> {
  try {
    return readCatalogItems(codes);
  } catch {
    return new Map();
  }
}

function readImageUrl(code: string): string | null {
  try {
    return readTenseImageUrl(code);
  } catch {
    return null;
  }
}

function payloadText(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

type Tone = 'mint' | 'sun' | 'coral';

/** A card's head: a soft badge with its icon, then the title. */
function CardHead({
  icon,
  tone,
  title,
  trailing,
}: {
  icon: HandoffIconName;
  tone: Tone;
  title: string;
  trailing?: React.ReactNode;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const badge = toneColors(theme)[tone];
  return (
    <View style={styles.cardHead}>
      <View style={[styles.medal, {backgroundColor: badge.face}]}>
        <MaterialIcon color={badge.ink} name={icon} size={17} />
      </View>
      <AppText style={styles.cardTitle}>{title}</AppText>
      {trailing}
    </View>
  );
}

function toneColors(theme: AppTheme) {
  const {colors} = theme;
  return {
    mint: {face: colors.accentSoft, ink: colors.primary},
    sun: {
      face: solidOver(colors.tertiarySoft, colors.surface),
      ink: colors.onTertiaryContainer,
    },
    coral: {
      face: solidOver(colors.secondarySoft, colors.surface),
      ink: colors.onSecondaryContainer,
    },
  };
}

/**
 * Vocab path P6 (F3): one tense of the map. A hero with the tense's picture,
 * its names and how well it is remembered, a small line of time from its
 * time and aspect; then its forms (+, −, ?), signal words, uses, the tenses
 * it is confused with and the examples, each with a speak button. "Thêm vào
 * ôn" stays pinned at the bottom. Read from the device, so it opens offline.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function TenseDetailScreen({
  navigation,
  route,
  item,
  related,
  imageUrl,
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const appNavigation = useAppNavigation();
  const {speak, notice} = useSpeak();
  const [examplesOpen, setExamplesOpen] = useState(true);
  const code = route?.params.itemCode ?? '';
  const tense =
    item === undefined ? (readItems([code]).get(code) ?? null) : item;
  const info = tense ? tenseInfo(tense.payload) : null;
  const confused =
    related ??
    (info ? [...readItems(info.contrastWith).values()] : ([] as CatalogItem[]));
  const picture =
    imageUrl === undefined
      ? tense
        ? readImageUrl(tense.code)
        : null
      : imageUrl;

  if (!tense || !info) {
    return (
      <AppScreen>
        <ScreenHeader
          onBack={() => navigation?.goBack?.()}
          title={t('patternTense.tense_title')}
        />
        <AppText color="secondary" style={styles.missing}>
          {t('patternTense.not_on_device')}
        </AppText>
      </AppScreen>
    );
  }

  const time = payloadText(tense.payload, 'time');
  const aspect = payloadText(tense.payload, 'aspect');
  const level: MemoryLevel = memoryLevel(memoryOf(tense.code));
  const chip = levelChip(theme, level);
  const levelOf = (other: CatalogItem) =>
    levelChip(theme, memoryLevel(memoryOf(other.code)));
  const forms = info.forms
    ? ([
        ['+', 'affirmative', info.forms.affirmative, 'mint'],
        ['−', 'negative', info.forms.negative, 'coral'],
        ['?', 'question', info.forms.question, 'sun'],
      ] as const)
    : [];
  const tones = toneColors(theme);

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('patternTense.tense_title')}
      />
      <ScrollView contentContainerStyle={styles.content} testID="tense-detail">
        <View style={styles.card}>
          <View style={styles.hero} testID="tense-hero">
            <TenseThumb
              iconSize={64}
              id={`tense-hero-${tense.code}`}
              imageUrl={picture}
              testID="tense-hero-thumb"
              time={time}
            />
            <View style={styles.heroTop}>
              <AppText style={styles.heroKicker}>
                {time
                  ? t('patternTense.tense_kicker', {
                      time: t(`patternTense.time_${time}`),
                    })
                  : t('patternTense.tense_title')}
              </AppText>
              <View
                style={[styles.chip, {backgroundColor: chip.face}]}
                testID="tense-level"
              >
                {chip.icon ? (
                  <MaterialIcon color={chip.ink} name={chip.icon} size={14} />
                ) : null}
                <AppText style={[styles.chipText, {color: chip.ink}]}>
                  {t(`patternTense.level_${level}`)}
                </AppText>
              </View>
            </View>
            <View>
              <AppText style={styles.heroTitle}>{tense.text}</AppText>
              <AppText style={styles.heroMeaning}>{tense.meaning_vi}</AppText>
            </View>
          </View>
          {time ? <TenseTimeline aspect={aspect} time={time} /> : null}
        </View>

        {forms.length > 0 ? (
          <View style={styles.card} testID="tense-forms">
            <CardHead
              icon="function"
              title={t('patternTense.forms')}
              tone="mint"
            />
            {forms.map(([sign, key, formula, tone]) => (
              <View key={key} style={styles.form}>
                <View
                  style={[styles.sign, {backgroundColor: tones[tone].face}]}
                >
                  <AppText style={[styles.signText, {color: tones[tone].ink}]}>
                    {sign}
                  </AppText>
                </View>
                <View style={styles.flex}>
                  <AppText style={styles.formLabel}>
                    {t(`patternTense.form_${key}`)}
                  </AppText>
                  <AppText style={styles.formula}>{formula}</AppText>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {info.signals.length > 0 ? (
          <View style={styles.card}>
            <CardHead
              icon="schedule"
              title={t('patternTense.signals')}
              tone="sun"
            />
            <View style={styles.pills}>
              {info.signals.map(signal => (
                <View key={signal} style={styles.pill}>
                  <AppText style={styles.pillText}>{signal}</AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {info.usesVi.length > 0 ? (
          <View style={styles.card}>
            <CardHead
              icon="lightbulb"
              title={t('patternTense.uses')}
              tone="sun"
            />
            {info.usesVi.map((use, index) => (
              <View key={index} style={styles.use}>
                <MaterialIcon
                  color={theme.colors.primary}
                  name="check"
                  size={18}
                />
                <AppText style={styles.flex}>{use}</AppText>
              </View>
            ))}
          </View>
        ) : null}

        {confused.length > 0 ? (
          <View style={styles.card}>
            <CardHead
              icon="compare"
              title={t('patternTense.confused_with')}
              tone="coral"
            />
            {confused.map(other => (
              <Pressable
                accessibilityHint={t('patternTense.open_tense_hint')}
                accessibilityRole="button"
                key={other.code}
                onPress={() => appNavigation.openTenseDetail(other.code)}
                style={({pressed}) => [
                  styles.related,
                  pressed ? styles.relatedPressed : null,
                ]}
                testID={`tense-related-${other.code}`}
              >
                <View
                  style={[
                    styles.relatedDot,
                    {
                      backgroundColor:
                        levelOf(other).icon === null
                          ? theme.colors.outlineVariant
                          : levelOf(other).edge,
                    },
                  ]}
                />
                <View style={styles.flex}>
                  <AppText style={styles.relatedTitle}>{other.text}</AppText>
                  <AppText color="secondary" variant="caption">
                    {other.meaning_vi}
                  </AppText>
                </View>
                <MaterialIcon
                  color={theme.colors.text.muted}
                  name="chevron_right"
                  size={22}
                />
              </Pressable>
            ))}
          </View>
        ) : null}

        <SpeechNotice notice={notice} />

        {tense.examples.length > 0 ? (
          <View style={styles.fold} testID="tense-examples">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{expanded: examplesOpen}}
              onPress={() => setExamplesOpen(value => !value)}
              style={styles.foldHead}
              testID="tense-examples-toggle"
            >
              <CardHead
                icon="menu_book"
                title={t('patternTense.examples')}
                tone="sun"
                trailing={
                  <>
                    <View style={styles.count}>
                      <AppText style={styles.countText}>
                        {tense.examples.length}
                      </AppText>
                    </View>
                    <MaterialIcon
                      color={theme.colors.text.muted}
                      name={examplesOpen ? 'chevron_left' : 'chevron_right'}
                      size={18}
                    />
                  </>
                }
              />
            </Pressable>
            {examplesOpen ? (
              <View style={styles.foldBody}>
                {tense.examples.map((example, index) => (
                  <View key={index} style={styles.example}>
                    <View style={[styles.flex, styles.exampleText]}>
                      <AppText variant="bodyLg">{example.text_en}</AppText>
                      <AppText color="secondary">{example.text_vi}</AppText>
                    </View>
                    <ActionIconButton
                      accessibilityHint={t('patternTense.speak_hint')}
                      accessibilityLabel={t('patternTense.speak', {
                        text: example.text_en,
                      })}
                      icon="volume_up"
                      onPress={() => speak(example.text_en)}
                      testID={`tense-example-speak-${index}`}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <StickerFooter>
        <AddToReviewButton itemCode={tense.code} look="sticker" />
      </StickerFooter>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 26,
      gap: 12,
      padding: 14,
      ...getStickerEdge(4, colors.surfaceHigh),
    },
    cardHead: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    cardTitle: {
      color: colors.text.primary,
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
    },
    chip: {
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 3,
      paddingLeft: 7,
      paddingRight: 9,
      paddingVertical: 3,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    content: {
      gap: 14,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xs,
    },
    count: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      justifyContent: 'center',
      minWidth: 24,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    countText: {
      color: colors.text.secondary,
      fontSize: 12,
      fontWeight: '700',
    },
    example: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
    },
    exampleText: {
      borderLeftColor: HERO_PALETTE.sun,
      borderLeftWidth: 3,
      gap: 2,
      paddingLeft: 10,
    },
    flex: {
      flex: 1,
    },
    fold: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      ...getStickerEdge(4, colors.surfaceHigh),
    },
    foldBody: {
      gap: 12,
      paddingBottom: 14,
      paddingHorizontal: 14,
    },
    foldHead: {
      justifyContent: 'center',
      minHeight: 56,
      paddingHorizontal: 14,
    },
    form: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    formLabel: {
      color: colors.text.muted,
      fontSize: 11.5,
      fontWeight: '700',
    },
    formula: {
      color: colors.text.primary,
      fontSize: 15.5,
      fontWeight: '700',
    },
    hero: {
      backgroundColor: HERO_PALETTE.ink,
      borderRadius: 20,
      justifyContent: 'space-between',
      marginHorizontal: -6,
      marginTop: -6,
      minHeight: 190,
      overflow: 'hidden',
      paddingBottom: 14,
      paddingHorizontal: 14,
      paddingTop: 12,
    },
    heroKicker: {
      color: HERO_PALETTE.white,
      flex: 1,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    heroMeaning: {
      color: HERO_PALETTE.chip,
      fontSize: 16,
    },
    heroTitle: {
      color: HERO_PALETTE.white,
      fontSize: 26,
      fontWeight: '800',
      lineHeight: 31,
    },
    heroTop: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    medal: {
      alignItems: 'center',
      borderRadius: 10,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    missing: {
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      textAlign: 'center',
    },
    pill: {
      backgroundColor: solidOver(colors.tertiarySoft, colors.surface),
      borderColor: HERO_PALETTE.sun,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      paddingHorizontal: 11,
      paddingVertical: 4,
    },
    pillText: {
      color: colors.onTertiaryContainer,
      fontSize: 14,
      fontWeight: '700',
    },
    pills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    related: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 10,
      paddingLeft: 12,
      paddingRight: 8,
      paddingVertical: 9,
    },
    relatedDot: {
      borderRadius: 3,
      height: 10,
      width: 10,
    },
    relatedPressed: {
      backgroundColor: colors.surfaceHigh,
    },
    relatedTitle: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    sign: {
      alignItems: 'center',
      borderRadius: 8,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    signText: {
      fontSize: 16,
      fontWeight: '800',
    },
    use: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 8,
    },
  });
}
