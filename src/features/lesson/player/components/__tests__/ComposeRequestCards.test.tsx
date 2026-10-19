import React from 'react';
import {act} from 'react-test-renderer';

import {type AppNavigation, AppNavigationProvider} from '@core/navigation';

import {has, press, renderWithTheme, textOf} from '@test/support/lessonFlow';

import {
  resetComposeTrackerForTests,
  trackCompose,
  useComposeTracker,
} from '../../logic/composeTracker';
import {ComposeRequestCards} from '../ComposeRequestCards';
import {ComposeTrackerHost} from '../ComposeTrackerHost';

jest.mock('../../logic/composeClient', () => ({
  ...jest.requireActual('../../logic/composeClient'),
  fetchActiveComposes: jest.fn(() => Promise.resolve({ok: true, value: []})),
}));
jest.mock('../../logic/canonicalLessonClient', () => ({
  ...jest.requireActual('../../logic/canonicalLessonClient'),
  fetchLessonCreationStatus: jest.fn(() => new Promise(() => {})),
}));
jest.mock('../../logic/canonicalDownloadRepository', () => ({
  getLessonDownload: jest.fn(() => null),
  saveLessonSnapshotBody: jest.fn(),
}));

const SOURCE = '11111111-1111-4111-8111-111111111111';
const REQUEST = '33333333-3333-4333-8333-333333333301';
const LESSON = '55555555-5555-4555-8555-555555555501';

function navigation(): AppNavigation {
  return {openLesson: jest.fn()} as unknown as AppNavigation;
}

function patch(values: Record<string, unknown>) {
  act(() => {
    useComposeTracker.setState(state => ({
      entries: state.entries.map(entry => ({...entry, ...values})),
    }));
  });
}

beforeEach(() => {
  resetComposeTrackerForTests();
  trackCompose({
    requestId: REQUEST,
    sourceLessonId: SOURCE,
    sourceTitle: 'Ở quán cà phê',
    sentenceIds: ['s1', 's2', 's3'],
  });
});

describe('compose request cards and banner (wait design §3.2)', () => {
  it('shows a running request and reopens its sheet on the source lesson', () => {
    const nav = navigation();
    const tree = renderWithTheme(
      <AppNavigationProvider value={nav}>
        <ComposeRequestCards />
      </AppNavigationProvider>,
    );
    expect(textOf(tree, `compose-card-${REQUEST}`)).toContain(
      'Ở quán cà phê · 3 câu · Đang xếp hàng',
    );
    patch({waitingNetwork: true});
    expect(textOf(tree, `compose-card-${REQUEST}`)).toContain('Đang chờ mạng…');
    press(tree, `compose-card-${REQUEST}`);
    expect(nav.openLesson).toHaveBeenCalledWith(SOURCE);
    expect(useComposeTracker.getState().sheetLessonId).toBe(SOURCE);

    // A failure stays until dismissed.
    patch({
      status: 'failed',
      error: {code: 'COMPOSE_TIMEOUT', retryable: true},
    });
    press(tree, `compose-card-dismiss-${REQUEST}`);
    expect(has(tree, `compose-card-${REQUEST}`)).toBe(false);
  });

  it('announces a lesson that finished out of sight', () => {
    const nav = navigation();
    const tree = renderWithTheme(
      <AppNavigationProvider value={nav}>
        <ComposeTrackerHost />
      </AppNavigationProvider>,
    );
    expect(has(tree, 'compose-banner')).toBe(false);
    patch({status: 'succeeded', lessonId: LESSON});
    expect(has(tree, 'compose-banner')).toBe(true);
    press(tree, 'compose-banner-open');
    expect(nav.openLesson).toHaveBeenCalledWith(LESSON);
    expect(has(tree, 'compose-banner')).toBe(false);
  });

  it('keeps quiet about the request an open sheet already shows', () => {
    const tree = renderWithTheme(
      <AppNavigationProvider value={navigation()}>
        <ComposeTrackerHost />
      </AppNavigationProvider>,
    );
    act(() => {
      useComposeTracker.setState({focusedRequestId: REQUEST});
    });
    patch({status: 'succeeded', lessonId: LESSON});
    expect(has(tree, 'compose-banner')).toBe(false);
  });

  it('names a failed situation lesson and opens its screen to see why', () => {
    const nav = {
      openLesson: jest.fn(),
      startCreate: jest.fn(),
    } as unknown as AppNavigation;
    const tree = renderWithTheme(
      <AppNavigationProvider value={nav}>
        <ComposeTrackerHost />
      </AppNavigationProvider>,
    );
    patch({
      kind: 'moment',
      sourceTitle: 'Đi khám răng',
      status: 'failed',
      error: {code: 'MOMENT_AUTHOR_FAILED', retryable: true},
    });
    expect(textOf(tree, 'compose-banner')).toContain(
      'Chưa tạo được bài từ tình huống',
    );
    expect(textOf(tree, 'compose-banner')).not.toContain('lộ trình');
    press(tree, 'compose-banner-view');
    expect(nav.startCreate).toHaveBeenCalledWith({
      kind: 'situation',
      requestId: REQUEST,
    });
  });
});
