import {useCallback, useMemo, useRef, useState} from 'react';

import {recordPracticeSessionActivity} from '@features/engagement';
import {
  type EntryReport,
  hasLessonPracticeRun,
  isSpeakingActivity,
  markPracticeSegment,
  nextPracticeSegment,
  noSpeakingActive,
  type PracticeSegmentView,
  practiceSegmentViews,
} from '@features/lesson/flow';
import {
  getLessonDownload,
  suggestComposePick,
  useLessonCompletion,
} from '@features/lesson/player';
import {requestSync} from '@features/sync';

import {createRequestId} from '@core/api/requestId';
import {
  buildLessonPracticePlan,
  buildPracticeSource,
  type LessonPracticeSection,
  type LessonPracticeSectionKind,
  practiceSeed,
  type WordLearningItem,
} from '@core/learning';
import {recordActivityAttempt} from '@core/sync/activityAttempts';

import {saveMissedWord} from './saveMissedWord';
import {nextPracticeAttemptNo} from './usePracticeSession';

export type LessonPracticeSectionResult = {
  kind: LessonPracticeSectionKind;
  total: number;
  /** Entries right on the first try, without hints. */
  correct: number;
  /** The learner skipped this speaking section. */
  skipped: boolean;
};

export type LessonPracticeRunSummary = {
  sections: LessonPracticeSectionResult[];
  /** Over the sections that were done (skipped ones left out). */
  total: number;
  correct: number;
  /** Whole percent, 0 when nothing was answered. */
  accuracy: number;
  /** Words not right on the first try, ready to save as flashcards. */
  missed: WordLearningItem[];
};

export type LessonPracticeRunState =
  | {status: 'unavailable'}
  | {
      status: 'running';
      sectionIndex: number;
      sectionCount: number;
      section: LessonPracticeSection;
      /** Changes on every restart so the activity starts fresh. */
      runKey: number;
    }
  | {status: 'finished'; summary: LessonPracticeRunSummary};

export type UseLessonPracticeRunResult = {
  state: LessonPracticeRunState;
  youtubeVideoId: string | null;
  /** Plan C: sentences to start "Học theo 6 bước" with; empty for none. */
  composeSuggestion: readonly string[];
  completeSection: (reports: EntryReport[]) => void;
  /** D2: a speaking section can be left out; it never blocks the lesson. */
  skipSection: () => void;
  restart: () => void;
  /** Every segment of the lesson (one for a short lesson). */
  segments: readonly PracticeSegmentView[];
  /** The segment this run studies. */
  segmentIndex: number | null;
  /** Segments finished at least once. */
  practicedCount: number;
  /** After a run: the segment to offer next; null for a one-segment lesson. */
  nextSegment: number | null;
  /** Starts a fresh run of another segment. */
  startSegment: (index: number) => void;
  /** The lesson could not be marked complete when the run finished. */
  completionFailed: boolean;
  savedItemKeys: ReadonlySet<string>;
  saveMissed: (itemKey: string) => void;
  saveAllMissed: () => void;
};

type SectionOutcome = {reports: EntryReport[]} | {skipped: true};

/** Entry ids in the order the activity reports them. */
function entryIds(section: LessonPracticeSection): string[] {
  switch (section.kind) {
    case 'listen_and_repeat':
      return section.content.prompts.map(prompt => prompt.id);
    case 'translation':
      return section.content.sentences.map(sentence => sentence.id);
    default:
      return section.content.questions.map(question => question.id);
  }
}

/**
 * Drives the on-device practice of a learner lesson that is not a six-step
 * lesson (plan B): the sections of `buildLessonPracticePlan` one after
 * another, one `activity_attempts` row per entry, and the lesson marked
 * complete once the last section is done (D1). While "no speaking" is on, the
 * speaking section is left out (D2). Runs offline on the downloaded lesson.
 */
export function useLessonPracticeRun(
  lessonId: string,
): UseLessonPracticeRunResult {
  const download = useMemo(() => getLessonDownload(lessonId), [lessonId]);
  const snapshot = download?.snapshot ?? null;
  const available = useMemo(
    () => (snapshot ? hasLessonPracticeRun(snapshot) : false),
    [snapshot],
  );
  const source = useMemo(
    () => (snapshot ? buildPracticeSource(snapshot) : null),
    [snapshot],
  );
  const completion = useLessonCompletion(lessonId);
  const [segments, setSegments] = useState<PracticeSegmentView[]>(() =>
    snapshot && available ? practiceSegmentViews(snapshot) : [],
  );
  const [segmentIndex, setSegmentIndex] = useState<number | null>(() =>
    nextPracticeSegment(segments),
  );
  const segmentIds = useMemo(
    () => segments.find(segment => segment.index === segmentIndex)?.sentenceIds,
    [segments, segmentIndex],
  );
  const composeSuggestion = useMemo(
    () =>
      snapshot && available ? suggestComposePick(snapshot, segmentIds) : [],
    [snapshot, available, segmentIds],
  );

  const [attemptNo, setAttemptNo] = useState(() =>
    nextPracticeAttemptNo(lessonId),
  );
  const [speakingOff, setSpeakingOff] = useState(() => noSpeakingActive());
  const sections = useMemo(() => {
    if (!snapshot || !available || !segmentIds) {
      return [];
    }
    const plan = buildLessonPracticePlan(
      snapshot,
      practiceSeed(snapshot.id, snapshot.content_revision, attemptNo),
      snapshot.analyses,
      segmentIds,
    );
    return (plan?.sections ?? []).filter(
      section => !(speakingOff && isSpeakingActivity(section.kind)),
    );
  }, [snapshot, available, segmentIds, attemptNo, speakingOff]);

  const sessionId = useRef(createRequestId());
  const startedAt = useRef(Date.now());
  const [sectionIndex, setSectionIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<SectionOutcome[]>([]);
  const [runKey, setRunKey] = useState(0);
  const [savedItemKeys, setSavedItemKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const finished = sections.length > 0 && outcomes.length >= sections.length;
  const completeLesson = completion.complete;

  const advance = useCallback(
    (outcome: SectionOutcome) => {
      const next = [...outcomes, outcome];
      setOutcomes(next);
      startedAt.current = Date.now();
      if (next.length < sections.length) {
        setSectionIndex(next.length);
        return;
      }
      recordPracticeSessionActivity(lessonId);
      completeLesson();
      requestSync();
      if (snapshot && segmentIndex !== null) {
        try {
          markPracticeSegment(
            lessonId,
            snapshot.content_revision,
            segmentIndex,
          );
        } catch {
          // Only steers the next segment; the run itself is recorded.
        }
        setSegments(practiceSegmentViews(snapshot));
      }
    },
    [
      outcomes,
      sections.length,
      lessonId,
      completeLesson,
      snapshot,
      segmentIndex,
    ],
  );

  const completeSection = useCallback(
    (reports: EntryReport[]) => {
      const section = sections[sectionIndex];
      if (!section || finished) {
        return;
      }
      const ids = entryIds(section);
      const durationMs =
        Math.max(0, Date.now() - startedAt.current) / Math.max(1, ids.length);
      ids.forEach((entryId, index) => {
        const report = reports[index];
        recordActivityAttempt({
          kind: 'practice',
          activity: section.kind,
          lessonId,
          itemKey: section.refs[entryId]?.itemKey ?? null,
          sessionId: sessionId.current,
          result:
            report === undefined
              ? 'skipped'
              : report.result === 'first_try' && report.support === 'none'
                ? 'correct'
                : 'incorrect',
          durationMs,
        });
      });
      advance({reports});
    },
    [sections, sectionIndex, finished, lessonId, advance],
  );

  const skipSection = useCallback(() => {
    const section = sections[sectionIndex];
    if (!section || finished || !isSpeakingActivity(section.kind)) {
      return;
    }
    for (const entryId of entryIds(section)) {
      recordActivityAttempt({
        kind: 'practice',
        activity: section.kind,
        lessonId,
        itemKey: section.refs[entryId]?.itemKey ?? null,
        sessionId: sessionId.current,
        result: 'skipped',
        durationMs: 0,
      });
    }
    advance({skipped: true});
  }, [sections, sectionIndex, finished, lessonId, advance]);

  const restart = useCallback(() => {
    sessionId.current = createRequestId();
    startedAt.current = Date.now();
    setOutcomes([]);
    setSectionIndex(0);
    setSavedItemKeys(new Set());
    setSpeakingOff(noSpeakingActive());
    setAttemptNo(previous => previous + 1);
    setRunKey(previous => previous + 1);
  }, []);

  const startSegment = useCallback(
    (index: number) => {
      if (
        !segments.some(segment => segment.index === index && segment.available)
      ) {
        return;
      }
      setSegmentIndex(index);
      restart();
    },
    [segments, restart],
  );

  const practicedCount = segments.filter(
    segment => segment.practicedAt !== null,
  ).length;
  const followingSegment = nextPracticeSegment(segments);
  const nextSegment =
    segments.length > 1 && followingSegment !== segmentIndex
      ? followingSegment
      : null;

  const summary = useMemo((): LessonPracticeRunSummary | null => {
    if (!finished) {
      return null;
    }
    const missedKeys: string[] = [];
    const results = sections.map((section, index) => {
      const outcome = outcomes[index]!;
      const ids = entryIds(section);
      if ('skipped' in outcome) {
        return {
          kind: section.kind,
          total: ids.length,
          correct: 0,
          skipped: true,
        };
      }
      let correct = 0;
      ids.forEach((entryId, entryIndex) => {
        const report = outcome.reports[entryIndex];
        if (report?.result === 'first_try' && report.support === 'none') {
          correct += 1;
          return;
        }
        const itemKey = section.refs[entryId]?.itemKey;
        if (itemKey && !missedKeys.includes(itemKey)) {
          missedKeys.push(itemKey);
        }
      });
      return {kind: section.kind, total: ids.length, correct, skipped: false};
    });
    const done = results.filter(result => !result.skipped);
    const total = done.reduce((sum, result) => sum + result.total, 0);
    const correct = done.reduce((sum, result) => sum + result.correct, 0);
    return {
      sections: results,
      total,
      correct,
      accuracy: total === 0 ? 0 : Math.round((correct / total) * 100),
      missed: missedKeys
        .map(key => source?.words.find(word => word.itemKey === key))
        .filter((word): word is WordLearningItem => word !== undefined),
    };
  }, [finished, sections, outcomes, source]);

  const saveMissed = useCallback(
    (itemKey: string) => {
      const word = source?.words.find(item => item.itemKey === itemKey);
      if (!word || !source) {
        return;
      }
      if (saveMissedWord(lessonId, word, source.sentences)) {
        setSavedItemKeys(previous => new Set(previous).add(itemKey));
      }
    },
    [source, lessonId],
  );

  const saveAllMissed = useCallback(() => {
    summary?.missed.forEach(word => {
      if (!savedItemKeys.has(word.itemKey)) {
        saveMissed(word.itemKey);
      }
    });
  }, [summary, savedItemKeys, saveMissed]);

  let state: LessonPracticeRunState;
  if (!available || sections.length === 0) {
    state = {status: 'unavailable'};
  } else if (summary) {
    state = {status: 'finished', summary};
  } else {
    state = {
      status: 'running',
      sectionIndex,
      sectionCount: sections.length,
      section: sections[sectionIndex]!,
      runKey,
    };
  }

  return {
    state,
    youtubeVideoId: snapshot?.youtube?.video_id ?? null,
    composeSuggestion,
    completeSection,
    skipSection,
    restart,
    segments,
    segmentIndex,
    practicedCount,
    nextSegment,
    startSegment,
    completionFailed: completion.state === 'error',
    savedItemKeys,
    saveMissed,
    saveAllMissed,
  };
}
