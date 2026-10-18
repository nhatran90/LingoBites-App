import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {
  KEYBOARD_EXTRAS,
  letterBank,
  nextTile,
  nextWord,
  QWERTY_ROWS,
  type TileMode,
  wordBank,
  wordSuggestions,
} from '@core/learning';

import {type AppTheme, useAppTheme} from '../theme';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';

export type {TileMode} from '@core/learning';

export type TileComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** The answer the banks and the bulb hint come from; none → keyboard only. */
  answer?: string | null;
  /** Lesson words: noise words and the suggestion strip. */
  vocabulary?: readonly string[];
  /** More text whose letters join the letters bank (e.g. the model verb). */
  extraLetters?: string;
  /** A fixed words bank (an ordering card), used as is. */
  wordTiles?: readonly string[];
  modes?: readonly TileMode[];
  mode: TileMode;
  onModeChange?: (mode: TileMode) => void;
  /** Fill-in: the words around the blank the learner writes. */
  frame?: {before: string; after: string} | null;
  editable?: boolean;
  status?: 'right' | 'wrong' | null;
  /** Called when the learner lights the next key with the bulb. */
  onHint?: () => void;
  seed?: string;
  placeholder?: string;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const LIT_MS = 3000;
const DELETE = 'delete';
const SPACE = ' ';

/** Letter rows, padded so every tile keeps the same width. */
function rowsOf(letters: readonly string[]): (string | null)[][] {
  const cols = letters.length > 18 ? 7 : 6;
  const rows: (string | null)[][] = [];
  for (let i = 0; i < letters.length; i += cols) {
    const row: (string | null)[] = letters.slice(i, i + cols);
    while (row.length < cols) row.push(null);
    rows.push(row);
  }
  return rows;
}

function wordsOf(text: string): string[] {
  return text.split(' ').filter(Boolean);
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Stage text shrinks as the answer grows, so it stays inside the stage. */
function stageFontSize(length: number): number {
  if (length > 34) return 22;
  if (length > 24) return 26;
  if (length > 14) return 30;
  return 34;
}

/**
 * Tile writing (bàn phím ô chữ): the answer shows large in the stage while
 * the learner taps word or letter tiles below, without the phone keyboard.
 * Controlled like a TextInput (`value` / `onChangeText`).
 */
export function TileComposer({
  value,
  onChangeText,
  answer = null,
  vocabulary = [],
  extraLetters = '',
  wordTiles,
  modes: modesProp,
  mode: modeProp,
  onModeChange,
  frame = null,
  editable = true,
  status = null,
  onHint,
  seed = '',
  placeholder,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: TileComposerProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [lit, setLit] = useState<string | null>(null);

  const modes: readonly TileMode[] =
    modesProp ??
    (wordTiles
      ? ['words']
      : answer
        ? ['words', 'letters', 'keyboard']
        : ['keyboard']);
  const mode = modes.includes(modeProp) ? modeProp : modes[0]!;

  const words = useMemo(
    () =>
      wordTiles
        ? [...wordTiles]
        : answer
          ? wordBank(answer, vocabulary, seed)
          : [],
    [answer, vocabulary, wordTiles, seed],
  );
  const letters = useMemo(
    () =>
      answer
        ? letterBank(`${answer} ${extraLetters}`, seed)
        : {letters: [], extras: []},
    [answer, extraLetters, seed],
  );

  useEffect(() => {
    if (lit === null) return undefined;
    const timer = setTimeout(() => setLit(null), LIT_MS);
    return () => clearTimeout(timer);
  }, [lit]);

  const typed = wordsOf(value);
  // A words tile is used once per matching word already in the answer.
  const used = new Set<number>();
  if (mode === 'words') {
    for (const word of typed) {
      const index = words.findIndex(
        (tile, position) => tile === word.toLowerCase() && !used.has(position),
      );
      if (index >= 0) used.add(index);
    }
  }

  const change = (next: string) => {
    if (!editable) return;
    setLit(null);
    onChangeText(next);
  };
  const type = (key: string) => {
    if (key === SPACE && (value === '' || value.endsWith(SPACE))) return;
    const startsSentence = value.trim() === '' || /[.?!]\s*$/.test(value);
    const char =
      !frame && mode === 'keyboard' && startsSentence ? key.toUpperCase() : key;
    change(value + char);
  };
  const pickWord = (word: string) =>
    change(value.trim() === '' ? word : `${value.trimEnd()} ${word}`);
  const deleteOne = () =>
    change(
      mode === 'words' ? typed.slice(0, -1).join(' ') : value.slice(0, -1),
    );
  const deleteWord = () => change(value.replace(/\S+\s*$/, ''));
  const removeWordAt = (index: number) => {
    const rest = typed.filter((_, position) => position !== index);
    const trailing = mode !== 'words' && value.endsWith(SPACE) && rest.length;
    change(rest.join(' ') + (trailing ? SPACE : ''));
  };
  const lightNext = () => {
    if (!answer || !editable) return;
    onHint?.();
    if (mode === 'words') {
      const word = nextWord(answer, value);
      if (word === null) {
        setLit(typed.length > 0 ? DELETE : null);
        return;
      }
      const index = words.findIndex(
        (tile, position) => tile === word && !used.has(position),
      );
      setLit(index >= 0 ? `word:${index}` : null);
      return;
    }
    setLit(nextTile(answer, value));
  };

  const suggestions =
    mode === 'words' || !editable ? [] : wordSuggestions(value, vocabulary);
  const stageStyle = [
    styles.stage,
    value !== '' && styles.stageFilled,
    status === 'right' && styles.stageRight,
    status === 'wrong' && styles.stageWrong,
  ];
  const fontSize = stageFontSize(value.length + (frame ? 12 : 0));
  const textStyle = [styles.stageText, {fontSize, lineHeight: fontSize * 1.3}];

  const tile = (
    key: string,
    label: string,
    onPress: (() => void) | undefined,
    extra?: {
      testID?: string;
      wide?: boolean;
      muted?: boolean;
      hint?: string;
      onLongPress?: () => void;
      icon?: 'lightbulb';
    },
  ) => {
    const isLit = lit === key;
    return (
      <Pressable
        accessibilityHint={extra?.hint ?? t('tileComposer.tile_hint')}
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{disabled: !onPress || !editable}}
        disabled={!onPress || !editable}
        key={key}
        onLongPress={extra?.onLongPress}
        onPress={onPress}
        style={({pressed}) => [
          styles.tile,
          extra?.wide && styles.tileWide,
          extra?.muted && styles.tileMuted,
          isLit && styles.tileLit,
          pressed && styles.tilePressed,
        ]}
        testID={extra?.testID}
      >
        {extra?.icon ? (
          <MaterialIcon
            color={theme.colors.onTertiaryContainer}
            name={extra.icon}
            size={22}
          />
        ) : (
          <Text
            maxFontSizeMultiplier={1.3}
            style={[styles.tileText, extra?.wide && styles.tileTextSmall]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    );
  };

  const letterKey = (letter: string) =>
    tile(letter, letter, () => type(letter), {
      testID: testID ? `${testID}-key-${letter}` : undefined,
    });

  const renderStage = () => {
    if (frame) {
      return (
        <Text style={textStyle}>
          {frame.before ? `${frame.before} ` : ''}
          <Text style={styles.blank}>{value === '' ? '＿＿＿' : value}</Text>
          {frame.after ? ` ${frame.after}` : ''}
        </Text>
      );
    }
    if (value === '') {
      return (
        <AppText color="muted" style={styles.placeholder}>
          {placeholder ??
            t(
              mode === 'words'
                ? 'tileComposer.placeholder_words'
                : 'tileComposer.placeholder_letters',
            )}
        </AppText>
      );
    }
    return (
      <View style={styles.stageWords}>
        {typed.map((word, index) => (
          <Pressable
            accessibilityHint={t('tileComposer.remove_word_hint')}
            accessibilityLabel={word}
            accessibilityRole="button"
            disabled={!editable}
            key={`${word}-${index}`}
            onPress={() => removeWordAt(index)}
            style={mode === 'words' ? styles.stageChip : undefined}
            testID={testID ? `${testID}-picked-${index}` : undefined}
          >
            <Text style={[textStyle, mode === 'words' && styles.stageChipText]}>
              {index === 0 ? capitalised(word) : word}
            </Text>
          </Pressable>
        ))}
        {editable && mode !== 'words' ? <View style={styles.caret} /> : null}
      </View>
    );
  };

  // QWERTY rows step in by half a key and a key and a half.
  const indent = (row: number) =>
    row === 1 ? styles.indentHalf : styles.indentWide;
  const keyboardRows =
    mode === 'keyboard'
      ? QWERTY_ROWS.map((row, index) => (
          <View key={row} style={styles.row}>
            {index > 0 ? <View style={indent(index)} /> : null}
            {row.split('').map(letterKey)}
            {index > 0 ? <View style={indent(index)} /> : null}
          </View>
        ))
      : rowsOf(letters.letters).map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {row.map((letter, index) =>
              letter === null ? (
                <View key={`pad-${index}`} style={styles.pad} />
              ) : (
                letterKey(letter)
              ),
            )}
          </View>
        ));

  const extras = mode === 'keyboard' ? KEYBOARD_EXTRAS : letters.extras;

  return (
    <View
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      style={styles.container}
      testID={testID}
    >
      <View
        accessibilityLiveRegion="polite"
        style={stageStyle}
        testID={testID ? `${testID}-stage` : undefined}
      >
        {renderStage()}
        {editable && !frame && value !== '' ? (
          <AppText color="muted" style={styles.stageHint} variant="caption">
            {t('tileComposer.remove_word_tip')}
          </AppText>
        ) : null}
      </View>

      {editable ? (
        <>
          {suggestions.length > 0 ? (
            <ScrollView
              contentContainerStyle={styles.suggestions}
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
              {suggestions.map(word => (
                <Pressable
                  accessibilityHint={t('tileComposer.suggestion_hint')}
                  accessibilityRole="button"
                  key={word}
                  onPress={() => change(`${value.replace(/\S*$/, '')}${word} `)}
                  style={styles.suggestion}
                  testID={testID ? `${testID}-suggest-${word}` : undefined}
                >
                  <Text style={styles.suggestionText}>{word}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {modes.length > 1 ? (
            <View accessibilityRole="tablist" style={styles.modes}>
              {modes.map(option => (
                <Pressable
                  accessibilityHint={t('tileComposer.mode_hint')}
                  accessibilityRole="tab"
                  accessibilityState={{selected: option === mode}}
                  key={option}
                  onPress={() => onModeChange?.(option)}
                  style={[
                    styles.modeButton,
                    option === mode && styles.modeButtonOn,
                  ]}
                  testID={testID ? `${testID}-mode-${option}` : undefined}
                >
                  <Text
                    style={[
                      styles.modeText,
                      option === mode && styles.modeTextOn,
                    ]}
                  >
                    {t(`tileComposer.mode_${option}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {mode === 'words' ? (
            <View style={styles.wordBank}>
              {words.map((word, index) =>
                used.has(index) ? (
                  <View
                    key={`${word}-${index}`}
                    style={[styles.tile, styles.wordTile, styles.tileUsed]}
                  >
                    <Text style={[styles.tileText, styles.usedText]}>
                      {word}
                    </Text>
                  </View>
                ) : (
                  <WordTile
                    key={`${word}-${index}`}
                    label={word}
                    lit={lit === `word:${index}`}
                    onPress={() => pickWord(word)}
                    styles={styles}
                    testID={testID ? `${testID}-word-${index}` : undefined}
                    tileHint={t('tileComposer.tile_hint')}
                  />
                ),
              )}
            </View>
          ) : (
            <View style={styles.bank}>{keyboardRows}</View>
          )}

          <View style={styles.row}>
            {answer && onHint
              ? tile('bulb', t('tileComposer.bulb'), lightNext, {
                  hint: t('tileComposer.bulb_hint'),
                  icon: 'lightbulb',
                  muted: true,
                  testID: testID ? `${testID}-bulb` : undefined,
                })
              : null}
            {mode === 'words'
              ? null
              : tile(SPACE, t('tileComposer.space'), () => type(SPACE), {
                  hint: t('tileComposer.space_hint'),
                  testID: testID ? `${testID}-space` : undefined,
                  wide: true,
                })}
            {mode === 'words' ? null : extras.map(letterKey)}
            {tile(DELETE, '⌫', value === '' ? undefined : deleteOne, {
              hint: t('tileComposer.delete_hint'),
              muted: true,
              onLongPress: deleteWord,
              testID: testID ? `${testID}-delete` : undefined,
              wide: mode === 'words',
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** A words-bank tile; `label` and `onPress` stay on it for screen readers. */
function WordTile({
  label,
  lit,
  onPress,
  styles,
  testID,
  tileHint,
}: {
  label: string;
  lit: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  testID?: string;
  tileHint: string;
}) {
  return (
    <Pressable
      accessibilityHint={tileHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.tile,
        styles.wordTile,
        lit && styles.tileLit,
        pressed && styles.tilePressed,
      ]}
      testID={testID}
    >
      <Text maxFontSizeMultiplier={1.3} style={styles.tileText}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors, spacing, radius} = theme;
  return StyleSheet.create({
    bank: {gap: spacing.sm - 1},
    blank: {
      backgroundColor: colors.accentSoft,
      color: colors.primary,
    },
    caret: {
      alignSelf: 'center',
      backgroundColor: colors.primary,
      borderRadius: 2,
      height: 32,
      width: 3,
    },
    container: {gap: spacing.sm},
    indentHalf: {flex: 0.5},
    indentWide: {flex: 1.5},
    modeButton: {
      alignItems: 'center',
      borderRadius: radius.md,
      flex: 1,
      paddingVertical: spacing.sm - 1,
    },
    modeButtonOn: {backgroundColor: colors.surface},
    modeText: {
      color: colors.text.muted,
      fontSize: 13,
      fontWeight: '700',
    },
    modeTextOn: {color: colors.primary},
    modes: {
      backgroundColor: colors.surfaceHigh,
      borderRadius: radius.lg,
      flexDirection: 'row',
      padding: spacing.xs,
    },
    pad: {flex: 1},
    placeholder: {maxWidth: 260, textAlign: 'center'},
    row: {flexDirection: 'row', gap: 6},
    stage: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.outlineVariant,
      borderRadius: radius.xl + 4,
      borderStyle: 'dashed',
      borderWidth: 2,
      justifyContent: 'center',
      minHeight: 150,
      paddingBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    stageChip: {
      backgroundColor: colors.accentSoft,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
    },
    stageChipText: {color: colors.primary},
    stageFilled: {borderColor: colors.accentSoft, borderStyle: 'solid'},
    stageHint: {bottom: spacing.sm, position: 'absolute'},
    stageRight: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.primary,
      borderStyle: 'solid',
    },
    stageText: {
      color: colors.text.primary,
      fontWeight: '800',
      textAlign: 'center',
    },
    stageWords: {
      alignItems: 'center',
      columnGap: spacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      rowGap: spacing.xs,
    },
    stageWrong: {borderColor: colors.danger, borderStyle: 'solid'},
    suggestion: {
      backgroundColor: colors.surface,
      borderColor: colors.outlineVariant,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md + 2,
      paddingVertical: spacing.xs + 2,
    },
    suggestionText: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    suggestions: {gap: spacing.sm},
    tile: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomWidth: 3,
      borderColor: colors.outlineVariant,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      height: 48,
      justifyContent: 'center',
    },
    tileLit: {
      backgroundColor: colors.tertiaryFixed,
      borderColor: colors.tertiaryBorder,
    },
    tileMuted: {backgroundColor: colors.surfaceHigh},
    tilePressed: {borderBottomWidth: 1, transform: [{translateY: 2}]},
    tileText: {
      color: colors.text.primary,
      fontSize: 20,
      fontWeight: '800',
    },
    tileTextSmall: {color: colors.text.muted, fontSize: 14},
    tileUsed: {
      backgroundColor: colors.surfaceLow,
      borderBottomWidth: 1,
      borderColor: colors.surfaceHigh,
      borderStyle: 'dashed',
    },
    tileWide: {flex: 3},
    usedText: {opacity: 0},
    wordBank: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      justifyContent: 'center',
    },
    wordTile: {flex: 0, paddingHorizontal: spacing.lg},
  });
}
