import {useCallback, useEffect, useRef, useState} from 'react';
import {InteractionManager} from 'react-native';

import {
  getLessonDownload,
  getLessonDownloadsSignature,
  type LessonDownloadCard,
  listLessonDownloadCards,
} from '@features/lesson/player';

import type {LessonCardProgress} from '@ui/components/LessonCard';

import i18n from '@core/i18n';
import {buildPracticeSource, getPracticeEligibility} from '@core/learning';

import type {LibraryLessonCardView} from './lesson';
import {
  lessonContextLabel,
  type LessonDownloadInfo,
  readLessonProgress,
} from './lessonCardData';
import {getLibrarySection, lessonBelongsToSection} from './librarySections';

/** The sections whose lessons the learner made themselves. */
const CREATED_SECTIONS = [
  getLibrarySection('mine'),
  getLibrarySection('video'),
];

/** Practice readiness is committed to the list every this many lessons. */
const PRACTICE_BATCH = 5;

export interface CreatedLessonsState {
  status: 'loading' | 'ready';
  lessons: LibraryLessonCardView[];
  /** Source type, sentence count and YouTube video, for the card cover. */
  downloads: ReadonlyMap<string, LessonDownloadInfo>;
  progress: ReadonlyMap<string, LessonCardProgress>;
}

const LOADING: CreatedLessonsState = {
  status: 'loading',
  lessons: [],
  downloads: new Map(),
  progress: new Map(),
};

/**
 * Eligibility needs the parsed snapshot, so it is worked out per lesson and
 * kept while the download is unchanged (same lesson, same download time).
 */
const practiceReadyByDownload = new Map<string, boolean>();

const practiceKey = (card: LessonDownloadCard) =>
  `${card.lessonId}|${card.downloadedAt}`;

function readPracticeReady(card: LessonDownloadCard): boolean {
  const key = practiceKey(card);
  let ready = practiceReadyByDownload.get(key);
  if (ready === undefined) {
    const record = getLessonDownload(card.lessonId);
    ready = record
      ? getPracticeEligibility(buildPracticeSource(record.snapshot)).eligible
      : false;
    practiceReadyByDownload.set(key, ready);
  }
  return ready;
}

function toCardView(card: LessonDownloadCard): LibraryLessonCardView {
  return {
    id: card.lessonId,
    title: card.title,
    blurb: card.description,
    dateLabel: card.downloadedAt.slice(0, 10),
    vocabularyCount: card.sentenceCount,
    durationMin: Math.max(1, Math.ceil(card.sentenceCount * 0.5)),
    sourceType: card.sourceType,
    origin: card.origin,
    practiceReady: practiceReadyByDownload.get(practiceKey(card)),
    // S4.3: a learner's lesson composed from picked sentences.
    contextLabel: card.generated
      ? i18n.t('compose.library_chip')
      : lessonContextLabel(card.unit),
    activityCount: card.activityCount,
    youtubeDurationMs: card.youtubeDurationMs,
  };
}

/**
 * The lessons of "Bài tôi tạo". Nothing is read while rendering: the cards
 * are read inside SQLite after the tab has been drawn (no snapshot is parsed
 * for them), then which lessons can be practised is worked out one lesson
 * per task, so the screen keeps answering touches the whole time.
 */
export function useCreatedLessons({
  practiceEnabled,
}: {
  practiceEnabled: boolean;
}): CreatedLessonsState & {refresh: () => void} {
  const [state, setState] = useState<CreatedLessonsState>(LOADING);
  const [version, setVersion] = useState(0);
  const signatureRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkPractice = (cards: LessonDownloadCard[]) => {
      const pending = cards.filter(
        card => !practiceReadyByDownload.has(practiceKey(card)),
      );
      let done = 0;
      const step = () => {
        if (cancelled) return;
        const card = pending.shift();
        if (card) {
          try {
            readPracticeReady(card);
          } catch {
            practiceReadyByDownload.set(practiceKey(card), false);
          }
          done += 1;
        }
        if (!card || pending.length === 0 || done % PRACTICE_BATCH === 0) {
          setState(current => ({
            ...current,
            lessons: cards.map(toCardView),
          }));
        }
        if (pending.length > 0) timer = setTimeout(step, 0);
      };
      if (pending.length > 0) timer = setTimeout(step, 0);
    };

    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      let cards: LessonDownloadCard[] = [];
      try {
        signatureRef.current = getLessonDownloadsSignature();
        cards = listLessonDownloadCards().filter(card =>
          CREATED_SECTIONS.some(section =>
            lessonBelongsToSection(section, card),
          ),
        );
      } catch {
        // A database not open yet shows the empty list.
      }
      setState({
        status: 'ready',
        lessons: cards.map(toCardView),
        downloads: new Map(
          cards.map(card => [
            card.lessonId,
            {
              sourceType: card.sourceType,
              sentenceCount: card.sentenceCount,
              youtubeVideoId: card.youtubeVideoId,
            },
          ]),
        ),
        progress: cards.length > 0 ? readLessonProgress() : new Map(),
      });
      if (practiceEnabled) checkPractice(cards);
    });

    return () => {
      cancelled = true;
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [practiceEnabled, version]);

  // Reload only when a lesson was downloaded, updated or removed.
  const refresh = useCallback(() => {
    if (signatureRef.current === null) return;
    try {
      if (getLessonDownloadsSignature() === signatureRef.current) return;
    } catch {
      return;
    }
    setVersion(v => v + 1);
  }, []);

  return {...state, refresh};
}
