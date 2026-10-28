import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {HeroFill} from '@ui/components/HeroFill';
import {LockedFeature} from '@ui/components/LockedFeature';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {useIsOffline} from '@core/api/connectivity';
import {useAppNavigation} from '@core/navigation';
import {useFeatureFlags} from '@core/release';

import {useYouTubeLessonCreation} from '../logic/useYouTubeLessonCreation';
import type {CreateFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CreateFlowParamList, 'CreateHub'>;

export type CreateScreenProps = Props;

type Tile = {
  icon:
    | 'add_photo_alternate'
    | 'play_circle'
    | 'content_paste'
    | 'record_voice_over';
  labelKey: string;
  descKey: string;
  a11yKey: string;
  onPress: () => void;
  testID: string;
};

/**
 * Lesson-creation hub (SETE-247), pushed from Home and the Library: the four input sources moved intact from
 * Home. All tiles share one visual style so equal-weight actions read as
 * equal — the only solid block on this screen is the camera hero.
 */
export function CreateScreen(_props: Props) {
  const appNavigation = useAppNavigation();
  const {theme} = useAppTheme();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();
  const {config} = useFeatureFlags();
  const imageInputEnabled =
    config.features.imageInput &&
    config.features.ocrScanner &&
    config.features.ocrReviewEdit;
  // SETE-290 (DEV-1): the creation tile needs the server capability too —
  // without it the tile is hidden so no transcript request can start here.
  // The history link stays flag-gated: saved lessons are local data.
  const youtubeCreation = useYouTubeLessonCreation();
  const youtubeEnabled = youtubeCreation.status === 'available';
  const pasteEnabled = config.features.pasteTextInput;
  const situationEnabled = config.features.situationLearning;

  const openCamera = useCallback(
    () => appNavigation.startCreate({kind: 'camera'}),
    [appNavigation],
  );
  const openGallery = useCallback(
    () => appNavigation.startCreate({kind: 'gallery'}),
    [appNavigation],
  );

  const tiles: Tile[] = [];
  if (imageInputEnabled) {
    tiles.push({
      icon: 'add_photo_alternate',
      labelKey: 'home.upload_image',
      descKey: 'create.source_gallery_desc',
      a11yKey: 'home.upload_image_a11y',
      onPress: openGallery,
      testID: 'create-tile-gallery',
    });
  }
  if (youtubeEnabled) {
    tiles.push({
      icon: 'play_circle',
      labelKey: 'home.youtube',
      descKey: 'create.source_youtube_desc',
      a11yKey: 'home.youtube_a11y',
      onPress: youtubeCreation.start,
      testID: 'create-tile-youtube',
    });
  }
  if (situationEnabled) {
    tiles.push({
      icon: 'record_voice_over',
      labelKey: 'moment.tile_title',
      descKey: 'moment.tile_desc',
      a11yKey: 'moment.tile_title',
      onPress: () => appNavigation.startCreate({kind: 'situation'}),
      testID: 'create-tile-situation',
    });
  }
  if (pasteEnabled) {
    tiles.push({
      icon: 'content_paste',
      labelKey: 'home.paste_text',
      descKey: 'create.source_paste_desc',
      a11yKey: 'home.paste_text_a11y',
      onPress: () => appNavigation.startCreate({kind: 'paste'}),
      testID: 'create-tile-paste',
    });
  }
  // Offline mode (#20–22): every source needs the Server (OCR, AI, YouTube
  // transcript). The tiles stay visible but locked, with the reason above.
  const offline = useIsOffline();

  return (
    <AppScreen>
      <ScreenHeader title={t('create.title')} onBack={appNavigation.goBack} />
      <View style={styles.header}>
        <AppText color="secondary">{t('create.subtitle')}</AppText>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scrollContent]}
        showsVerticalScrollIndicator={false}
      >
        {
          <>
            {offline ? (
              <LockedFeature
                message={t('offline.locked_create')}
                testID="create-offline-locked"
              />
            ) : null}
            {imageInputEnabled ? (
              <Pressable
                accessibilityLabel={t('home.capture_photo_a11y')}
                accessibilityRole="button"
                accessibilityState={{disabled: offline}}
                disabled={offline}
                onPress={openCamera}
                testID="create-hero-camera"
              >
                {({pressed}) => (
                  <ShelfSurface
                    borderRadius={26}
                    faceStyle={[styles.heroCamera, offline && styles.locked]}
                    isPressed={pressed && !offline}
                    shelfColor={HERO_PALETTE.shelf}
                    shelfHeight={6}
                  >
                    <HeroFill id="createHeroCameraFace" />
                    <View style={styles.heroCameraIcon}>
                      <MaterialIcon
                        color={HERO_PALETTE.teal}
                        name="photo_camera"
                        size={28}
                      />
                    </View>
                    <AppText
                      variant="h2"
                      style={styles.heroCameraTitle}
                      numberOfLines={2}
                    >
                      {t('home.capture_photo')}
                    </AppText>
                    <AppText style={styles.heroCameraHint} numberOfLines={2}>
                      {t('home.capture_photo_hint')}
                    </AppText>
                  </ShelfSurface>
                )}
              </Pressable>
            ) : null}
            {tiles.length > 0 ? (
              <View style={styles.sourceList}>
                <AppText style={styles.sectionTitle}>
                  {t('create.more_ways')}
                </AppText>
                {tiles.map(tile => (
                  <Pressable
                    accessibilityLabel={t(tile.a11yKey)}
                    accessibilityRole="button"
                    accessibilityState={{disabled: offline}}
                    disabled={offline}
                    key={tile.testID}
                    onPress={tile.onPress}
                    style={({pressed}) => [
                      styles.sourceRow,
                      pressed && styles.pressed,
                      offline && styles.locked,
                    ]}
                    testID={tile.testID}
                  >
                    <View style={styles.sourceIcon}>
                      <MaterialIcon
                        color={theme.colors.primary}
                        name={tile.icon}
                        size={24}
                      />
                    </View>
                    <View style={styles.sourceCopy}>
                      <AppText variant="label" numberOfLines={1}>
                        {t(tile.labelKey)}
                      </AppText>
                      <AppText
                        variant="caption"
                        color="secondary"
                        numberOfLines={2}
                      >
                        {t(tile.descKey)}
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
            {youtubeEnabled ? (
              <Pressable
                accessibilityLabel={t('home.youtube_history_a11y')}
                accessibilityRole="button"
                onPress={() => appNavigation.openLibrarySection('video')}
                style={({pressed}) => [
                  styles.historyLink,
                  pressed && styles.linkPressed,
                ]}
                testID="create-history-link"
              >
                <MaterialIcon
                  color={theme.colors.primary}
                  name="history_edu"
                  size={20}
                />
                <AppText
                  variant="label"
                  style={styles.historyLabel}
                  numberOfLines={1}
                >
                  {t('home.youtube_history')}
                </AppText>
              </Pressable>
            ) : null}
            {imageInputEnabled ? (
              <View style={styles.tipCard} testID="create-tip-card">
                <MaterialIcon
                  color={theme.colors.onTertiaryContainer}
                  name="tips_and_updates"
                  size={22}
                />
                <AppText variant="label" style={styles.tipText}>
                  {t('home.tip')}
                </AppText>
              </View>
            ) : null}
          </>
        }
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      gap: theme.spacing.xs,
      paddingHorizontal: theme.gutter,
    },
    scrollContent: {
      gap: theme.spacing.md,
      paddingBottom: 28,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.md,
    },
    // Home's "Hôm nay" face with its shelf, not a black shadow.
    heroCamera: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.faceFrom,
      gap: theme.spacing.sm,
      justifyContent: 'center',
      minHeight: 190,
      overflow: 'hidden',
      padding: theme.spacing.lg,
    },
    heroCameraIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    heroCameraTitle: {
      color: HERO_PALETTE.tealInk,
      textAlign: 'center',
    },
    heroCameraHint: {
      color: HERO_PALETTE.tealInk,
      textAlign: 'center',
    },
    sourceList: {gap: theme.spacing.sm},
    sectionTitle: {
      color: theme.colors.text.primary,
      fontSize: 18,
      fontWeight: '700',
    },
    sourceRow: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 72,
      padding: theme.spacing.md,
      // A light shelf in the card's own tone, as under the flash cards.
      borderBottomColor: theme.shelf?.surface.color ?? theme.colors.border,
      borderBottomWidth: 4,
    },
    sourceIcon: {
      alignItems: 'center',
      backgroundColor: solidOver(theme.colors.accentSoft, theme.colors.surface),
      borderRadius: 14,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    sourceCopy: {flex: 1, gap: 2, minWidth: 0},
    historyLink: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 44,
      paddingHorizontal: theme.spacing.sm,
    },
    historyLabel: {
      color: theme.colors.primary,
      flex: 1,
    },
    tipCard: {
      alignItems: 'center',
      backgroundColor: solidOver(
        theme.colors.tertiarySoft,
        theme.colors.surface,
      ),
      borderRadius: 20,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    tipText: {
      color: theme.colors.onTertiaryContainer,
      flex: 1,
    },
    emptyWrap: {
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xxl,
    },
    emptyMedallion: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      height: 64,
      justifyContent: 'center',
      width: 64,
    },
    centerText: {textAlign: 'center'},
    linkPressed: {opacity: theme.states.pressedOpacity},
    pressed: {
      opacity: theme.states.pressedOpacity,
      transform: [{translateY: 2}],
    },
    locked: {
      opacity: 0.5,
    },
  });
}
