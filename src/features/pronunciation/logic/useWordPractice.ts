import {useMemo, useState} from 'react';

import {canWriteWord} from '@ui/components/WriteWordButton';

import {useAppNavigation} from '@core/navigation';

import {cardReadingTarget, type ReadingTarget} from './readingTarget';
import {useSpeakWordAccess} from './useSpeakWordAccess';

/** Which face a word card shows: the card itself, or one practice. */
export type WordPracticeMode = 'card' | 'write' | 'speak';

/** The card being practised, as each card screen knows it. */
export type WordPracticeCard = {
  /** Changes with the card; a new key closes any open practice. */
  key: string;
  text: string;
  meaningVi: string | null;
  ipa: string | null;
  /** Catalog item kind (`word`, `phrase`, `pattern`…), if any. */
  kind: string | null;
  /** Catalog item id, if any: the reading is scored against that item. */
  itemId: string | null;
};

export type WordPractice = {
  card: WordPracticeCard | null;
  mode: WordPracticeMode;
  /** "Viết từ" or "Đọc từ" is open: the screen hides its own controls. */
  practising: boolean;
  canWrite: boolean;
  /** "Đọc từ" is offered (maybe locked until scoring is turned on). */
  canSpeak: boolean;
  speakLocked: boolean;
  speakTarget: ReadingTarget | null;
  openWrite: () => void;
  /** Opens "Đọc từ", or Settings while scoring is off. */
  openSpeak: () => void;
  /** Back to the card. */
  close: () => void;
};

/**
 * "Viết từ" / "Đọc từ" on any word card (daily review, item review, word
 * pack, a lesson's "Từ & cụm" and "Nghe hiểu"): which practices the card
 * offers and which one is open. Practice only: nothing here is scheduled
 * or counted as an answer. Moving to another card closes the practice.
 */
export function useWordPractice(
  card: WordPracticeCard | null,
  place: 'pack' | 'review' | 'lesson',
): WordPractice {
  const access = useSpeakWordAccess();
  const appNavigation = useAppNavigation();
  const [open, setOpen] = useState<{key: string; mode: WordPracticeMode}>({
    key: '',
    mode: 'card',
  });
  const mode = card && open.key === card.key ? open.mode : 'card';
  const text = card?.text ?? null;
  const kind = card?.kind ?? null;
  const itemId = card?.itemId ?? null;
  const speakTarget = useMemo(
    () =>
      text === null ? null : cardReadingTarget({place, text, itemId, kind}),
    [place, text, itemId, kind],
  );
  // The meaning is the prompt to write from.
  const canWrite =
    text !== null &&
    !!card?.meaningVi &&
    kind !== 'pattern' &&
    canWriteWord(text);
  const canSpeak = speakTarget !== null && access !== 'hidden';

  return {
    card,
    mode,
    practising: mode !== 'card',
    canWrite,
    canSpeak,
    speakLocked: access === 'locked',
    speakTarget,
    openWrite: () => {
      if (card && canWrite) setOpen({key: card.key, mode: 'write'});
    },
    openSpeak: () => {
      if (!card || !canSpeak) return;
      if (access === 'locked') {
        appNavigation.openPronunciationSettings();
        return;
      }
      setOpen({key: card.key, mode: 'speak'});
    },
    close: () => setOpen({key: '', mode: 'card'}),
  };
}
