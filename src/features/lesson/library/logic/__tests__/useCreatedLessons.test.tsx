import React from 'react';
import {InteractionManager} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {
  getLessonDownload,
  getLessonDownloadsSignature,
  listLessonDownloadCards,
} from '@features/lesson/player';

import {getPracticeEligibility} from '@core/learning';

import {useCreatedLessons} from '../useCreatedLessons';

jest.mock('@features/lesson/player', () => ({
  listLessonDownloadCards: jest.fn(),
  getLessonDownload: jest.fn((lessonId: string) => ({
    snapshot: {id: lessonId},
  })),
  getLessonDownloadsSignature: jest.fn(() => 'downloads-v1'),
}));

jest.mock('@core/learning', () => ({
  buildPracticeSource: jest.fn((snapshot: {id: string}) => snapshot),
  getPracticeEligibility: jest.fn((source: {id: string}) => ({
    eligible: source.id !== 'video',
  })),
}));

jest.mock('@core/i18n', () => ({t: (key: string) => key}));

jest.mock('../lessonCardData', () => ({
  lessonContextLabel: () => null,
  readLessonProgress: () => new Map([['text', {state: 'completed'}]]),
}));

const mockedCards = listLessonDownloadCards as jest.Mock;
const mockedSignature = getLessonDownloadsSignature as jest.Mock;
const mockedDownload = getLessonDownload as jest.Mock;
const mockedEligibility = getPracticeEligibility as jest.Mock;

function card(lessonId: string, origin: string, sourceType: string) {
  return {
    lessonId,
    downloadedAt: '2026-10-01T00:00:00.000Z',
    title: `Lesson ${lessonId}`,
    description: '',
    origin,
    sourceType,
    generated: false,
    unit: null,
    sentenceCount: 8,
    activityCount: 0,
    youtubeVideoId: sourceType === 'youtube' ? 'abc123' : null,
    youtubeDurationMs: null,
  };
}

let latest: ReturnType<typeof useCreatedLessons>;
let runInteractions: (() => void) | undefined;

function Probe({practiceEnabled = true}: {practiceEnabled?: boolean}) {
  latest = useCreatedLessons({practiceEnabled});
  return null;
}

function renderProbe(practiceEnabled = true) {
  act(() => {
    ReactTestRenderer.create(<Probe practiceEnabled={practiceEnabled} />);
  });
}

/** Runs the task waiting for the tab to be drawn, once. */
function drawn() {
  const task = runInteractions;
  runInteractions = undefined;
  act(() => task?.());
}

describe('useCreatedLessons', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    runInteractions = undefined;
    jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((task?: any) => {
        runInteractions = task;
        return {cancel: jest.fn()} as any;
      });
    mockedCards.mockReturnValue([
      card('text', 'learner', 'learner_text'),
      card('photo', 'learner', 'learner_ocr'),
      card('video', 'learner', 'youtube'),
      card('public', 'admin', 'admin_text'),
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads nothing while rendering, only after the tab is drawn', () => {
    renderProbe();
    expect(latest.status).toBe('loading');
    expect(mockedCards).not.toHaveBeenCalled();

    drawn();
    expect(latest.status).toBe('ready');
    expect(latest.lessons.map(lesson => lesson.id)).toEqual([
      'text',
      'photo',
      'video',
    ]);
    expect(latest.downloads.get('video')?.youtubeVideoId).toBe('abc123');
    expect(latest.progress.get('text')).toEqual({state: 'completed'});
  });

  it('works out practice one lesson per task, not while listing', () => {
    renderProbe();
    drawn();
    expect(mockedDownload).not.toHaveBeenCalled();
    expect(latest.lessons[0]?.practiceReady).toBeUndefined();

    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(mockedDownload).toHaveBeenCalledTimes(1);

    act(() => {
      jest.runAllTimers();
    });
    expect(
      Object.fromEntries(
        latest.lessons.map(lesson => [lesson.id, lesson.practiceReady]),
      ),
    ).toEqual({text: true, photo: true, video: false});

    // Kept for the same download: a second visit parses nothing.
    mockedEligibility.mockClear();
    renderProbe();
    drawn();
    act(() => {
      jest.runAllTimers();
    });
    expect(mockedEligibility).not.toHaveBeenCalled();
    expect(latest.lessons[0]?.practiceReady).toBe(true);
  });

  it('leaves practice alone when it is switched off', () => {
    mockedCards.mockReturnValue([card('other', 'learner', 'learner_text')]);
    renderProbe(false);
    drawn();
    act(() => {
      jest.runAllTimers();
    });
    expect(mockedDownload).not.toHaveBeenCalled();
  });

  it('reloads on refresh only when the downloads changed', () => {
    renderProbe();
    drawn();
    expect(mockedCards).toHaveBeenCalledTimes(1);

    act(() => latest.refresh());
    drawn();
    expect(mockedCards).toHaveBeenCalledTimes(1);

    mockedSignature.mockReturnValue('downloads-v2');
    act(() => latest.refresh());
    drawn();
    expect(mockedCards).toHaveBeenCalledTimes(2);
  });
});
