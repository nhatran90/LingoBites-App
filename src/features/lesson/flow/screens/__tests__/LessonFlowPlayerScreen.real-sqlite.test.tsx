import React from 'react';
import {act} from 'react-test-renderer';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {LessonActivityAttemptPayloadSchema} from '@core/schemas/sync';

import {mockAppNavigation} from '@test/support';
import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {
  byTestId,
  has,
  press,
  renderWithTheme,
  seedSnapshot,
  textOf,
} from '@test/support/lessonFlow';

import {LessonFlowPlayerScreen} from '../LessonFlowPlayerScreen';

jest.mock('@features/audio', () =>
  require('@test/support/audioModuleMock').audioModuleMock(
    jest.fn(() => Promise.resolve({ok: true})),
  ),
);

const mockRequestSync = jest.fn();
jest.mock('@features/sync', () => ({requestSync: () => mockRequestSync()}));

jest.mock('@features/speaking', () => ({
  loadLessonRecorder: () => null,
  loadReadingRecorder: () => null,
  isPronunciationConsentOn: () => false,
  subscribePronunciationConsent: () => () => {},
}));

const snapshot = seedSnapshot();
let mockState: {status: string; [key: string]: unknown};

jest.mock('../../../player/logic/useCanonicalLesson', () => ({
  useCanonicalLesson: () => ({
    state: mockState,
    open: jest.fn(),
    checkForUpdate: jest.fn(),
    requestAnalysis: jest.fn(),
  }),
}));

function renderScreen(params: {showMap?: boolean} = {}) {
  const navigation = {goBack: jest.fn(), canGoBack: () => true};
  const tree = renderWithTheme(
    <LessonFlowPlayerScreen
      navigation={navigation as never}
      route={{params: {lessonId: snapshot.id, ...params}} as never}
    />,
  );
  return {tree, navigation};
}

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  mockState = {status: 'ready', snapshot, offline: false, hasUpdate: false};
});

afterEach(() => {
  resetDatabaseForTests(null);
});

describe('LessonFlowPlayerScreen (shell)', () => {
  it('opens straight on the step to do, past an empty step 1', () => {
    const {tree} = renderScreen();
    expect(has(tree, 'lesson-flow-map')).toBe(false);
    expect(textOf(tree, 'lesson-flow-step-title')).toBe('Nghe hiểu');
  });

  it('opens on the map from "Xem chi tiết" and goes back to the lesson', () => {
    const {tree, navigation} = renderScreen({showMap: true});
    expect(has(tree, 'lesson-flow-map')).toBe(true);
    expect(has(tree, 'lesson-flow-close')).toBe(false);
    press(tree, 'screen-header-back');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('opens on the map, past an empty step 1, and walks the steps', () => {
    const {tree} = renderScreen({showMap: true});
    expect(has(tree, 'lesson-flow-map')).toBe(true);
    expect(has(tree, 'lesson-flow-step-title')).toBe(false);

    press(tree, 'lesson-flow-map-start');
    expect(has(tree, 'lesson-flow-map')).toBe(false);
    expect(textOf(tree, 'lesson-flow-step-title')).toBe('Nghe hiểu');

    // Step 2: the bottom button walks the card deck, then opens step 3.
    expect(has(tree, 'lesson-flow-next')).toBe(false);
    while (has(tree, 'lesson-flow-card-next')) {
      press(tree, 'lesson-flow-card-next');
    }
    press(tree, 'lesson-flow-card-done');
    expect(textOf(tree, 'lesson-flow-step-title')).toBe('Luyện có hướng dẫn');

    press(tree, 'lesson-flow-step-4');
    press(tree, 'lesson-flow-step-3');
    expect(textOf(tree, 'lesson-flow-step-title')).toBe('Luyện có hướng dẫn');
    const activity = snapshot.blocks.find(
      block => block.type === 'activity' && block.step === 3,
    )!;
    expect(has(tree, `lesson-flow-activity-${activity.id}`)).toBe(true);

    press(tree, 'lesson-flow-step-6');
    expect(textOf(tree, 'lesson-flow-practice-status')).toBe(
      'Còn 2 hoạt động luyện',
    );
    expect(textOf(tree, 'lesson-flow-result-title')).toBe(
      'Cố lên, sắp xong rồi!',
    );
    expect(has(tree, 'lesson-flow-next')).toBe(false);
  });

  it('opens a step straight from a stop on the map', () => {
    const {tree} = renderScreen({showMap: true});
    press(tree, 'lesson-flow-step-4');
    expect(has(tree, 'lesson-flow-map')).toBe(false);
    expect(textOf(tree, 'lesson-flow-step-title')).toBe('Luyện biến đổi');
  });

  it('closes from the result step', () => {
    const {tree, navigation} = renderScreen();
    press(tree, 'lesson-flow-step-6');
    press(tree, 'lesson-flow-back-to-lesson');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('closes the whole lesson from the header in one tap', () => {
    const {tree, navigation} = renderScreen();
    press(tree, 'lesson-flow-close');
    expect(mockAppNavigation.closeLesson).toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('offers the next lesson and the unit after a unit lesson', () => {
    const {tree} = renderScreen();
    press(tree, 'lesson-flow-step-6');
    const target = {
      unitId: snapshot.unit!.unit_id,
      title: snapshot.unit!.unit_title,
      lessonId: snapshot.id,
    };
    press(tree, 'lesson-flow-next-lesson');
    expect(mockAppNavigation.openNextUnitLesson).toHaveBeenCalledWith(target);
    press(tree, 'lesson-flow-back-to-unit');
    expect(mockAppNavigation.closeLessonToUnit).toHaveBeenCalledWith(target);
  });

  it('shows no unit buttons for a lesson outside any unit', () => {
    mockState = {
      status: 'ready',
      snapshot: {...snapshot, unit: null},
      offline: false,
      hasUpdate: false,
    };
    const {tree} = renderScreen();
    press(tree, 'lesson-flow-step-6');
    expect(has(tree, 'lesson-flow-next-lesson')).toBe(false);
    expect(has(tree, 'lesson-flow-back-to-unit')).toBe(false);
    expect(has(tree, 'lesson-flow-back-to-lesson')).toBe(true);
  });

  it('skips step 1 when there is nothing to review', () => {
    const {tree} = renderScreen();
    expect(has(tree, 'lesson-flow-review-empty')).toBe(false);
    expect(has(tree, 'lesson-flow-step-empty')).toBe(false);
    // The empty step is left off the map, not shown as skipped.
    expect(has(tree, 'lesson-flow-step-1')).toBe(false);
    expect(has(tree, 'lesson-flow-step-2')).toBe(true);
  });

  it('says when the lesson has no steps', () => {
    mockState = {
      status: 'ready',
      // A plain learner lesson: no spec (S4.3 runs learner lessons that have one).
      snapshot: {...snapshot, origin: 'learner', spec: null},
      offline: false,
      hasUpdate: false,
    };
    const {tree} = renderScreen();
    expect(has(tree, 'lesson-flow-not-curriculum')).toBe(true);
  });

  it('records one attempt per finished activity and resumes after them', () => {
    const {tree} = renderScreen();
    press(tree, 'lesson-flow-step-3');
    expect(has(tree, 'lesson-flow-coach')).toBe(true);
    press(tree, 'lesson-flow-self-pass');
    // The result and "Tiếp" take over the pinned bottom bar.
    expect(textOf(tree, 'lesson-flow-entry-feedback')).toContain('Tốt lắm!');
    expect(has(tree, 'lesson-flow-next')).toBe(false);
    press(tree, 'lesson-flow-entry-next');
    for (let i = 0; i < 2; i += 1) {
      press(tree, 'lesson-flow-self-pass');
      press(tree, 'lesson-flow-entry-next');
    }
    expect(textOf(tree, 'lesson-flow-activity-outcome')).toBe(
      'Đạt, tự làm được',
    );
    press(tree, 'lesson-flow-next');
    press(tree, 'lesson-flow-self-fail');
    press(tree, 'lesson-flow-entry-next');
    for (let i = 0; i < 3; i += 1) {
      press(tree, 'lesson-flow-self-pass');
      press(tree, 'lesson-flow-entry-next');
    }
    press(tree, 'lesson-flow-step-6');
    expect(textOf(tree, 'lesson-flow-practice-status')).toBe(
      'Đã hoàn thành phần luyện',
    );
    expect(mockRequestSync).toHaveBeenCalledTimes(2);
    // PR 16: practice done, step 5 not yet passed.
    expect(textOf(tree, 'lesson-flow-lesson-outcome')).toBe(
      'Chưa đạt bài: làm đạt phần Vận dụng để đạt bài',
    );
    expect(has(tree, 'lesson-flow-redo-independent')).toBe(true);

    const rows = getDatabase().execute(
      `SELECT payload_json FROM sync_outbox
        WHERE event_type = 'activity_attempts' ORDER BY created_at;`,
    ).rows!;
    const payloads = [0, 1].map(i =>
      LessonActivityAttemptPayloadSchema.parse(
        JSON.parse(
          String((rows.item(i) as {payload_json: string}).payload_json),
        ),
      ),
    );
    expect(
      payloads.map(p => [p.activity, p.step, p.outcome, p.assessed_by]),
    ).toEqual([
      ['listen_and_repeat', 3, 'pass_independent', 'self'],
      ['speaking_drill', 4, 'fail', 'self'],
    ]);
    expect(payloads[1]!.item_keys).toContain('pattern:can-i-have');
    expect(payloads[0]!.session_id).toBe(payloads[1]!.session_id);

    // G6/G7: the lesson completes once and each activity marks a streak day.
    expect(
      getDatabase()
        .execute('SELECT status FROM lesson_progress WHERE lesson_id = ?;', [
          snapshot.id,
        ])
        .rows?.item(0),
    ).toEqual({status: 'completed'});
    const events = getDatabase().execute(
      `SELECT event_type, COUNT(*) AS n FROM gamification_events
        GROUP BY event_type ORDER BY event_type;`,
    ).rows?._array;
    expect(events).toEqual([
      {event_type: 'lesson_activity_completed', n: 2},
      {event_type: 'lesson_completed', n: 1},
    ]);

    act(() => {
      tree.unmount();
    });
    const again = renderScreen();
    expect(textOf(again.tree, 'lesson-flow-step-title')).toBe('Vận dụng');

    // Step 5: independent use, judged against the task's criteria (PR 11).
    expect(has(again.tree, 'lesson-flow-situation')).toBe(true);
    press(again.tree, 'lesson-flow-independent-done');
    for (const criterion of ['purpose', 'content', 'clarity', 'independence']) {
      press(again.tree, `lesson-flow-criterion-${criterion}`);
    }
    press(again.tree, 'lesson-flow-criteria-save');
    const last = getDatabase().execute(
      `SELECT payload_json FROM sync_outbox
        WHERE event_type = 'activity_attempts'
        ORDER BY created_at DESC LIMIT 1;`,
    ).rows!;
    expect(
      LessonActivityAttemptPayloadSchema.parse(
        JSON.parse(
          String((last.item(0) as {payload_json: string}).payload_json),
        ),
      ),
    ).toMatchObject({
      activity: 'role_play',
      step: 5,
      support_level: 'none',
      outcome: 'pass_independent',
      assessed_by: 'self',
    });

    // Step 6 keeps practice and independent use apart (G7).
    press(again.tree, 'lesson-flow-step-6');
    expect(has(again.tree, 'lesson-flow-result-practice')).toBe(true);
    const stepFive = snapshot.blocks.find(
      block => block.type === 'activity' && block.step === 5,
    )!;
    expect(textOf(again.tree, 'lesson-flow-result-independent')).toContain(
      'Vận dụng',
    );
    expect(textOf(again.tree, `lesson-flow-result-${stepFive.id}`)).toContain(
      'Đạt, tự làm được',
    );
    // PR 16: passed on the device, confirmed by the next sync.
    expect(textOf(again.tree, 'lesson-flow-lesson-outcome')).toBe('Đạt bài');
    expect(textOf(again.tree, 'lesson-flow-result-title')).toBe(
      'Bạn đã hoàn thành bài!',
    );
    // Step 4 was judged "Chưa đạt": 2 of 3 passed, one to review.
    // The tiles take their text as props, so read the rendered text.
    const stats = byTestId(again.tree, 'lesson-flow-result-stats')[0]!
      .findAll(node => typeof node.type === 'string')
      .flatMap(node => node.children.filter(c => typeof c === 'string'))
      .join(' ');
    expect(stats).toContain('2/3');
    expect(stats).toContain('Hoạt động đạt');
    expect(stats).toContain('Cần ôn lại');
    expect(has(again.tree, 'lesson-flow-lesson-outcome-unconfirmed')).toBe(
      true,
    );
    expect(has(again.tree, 'lesson-flow-redo-independent')).toBe(false);
  });
});
