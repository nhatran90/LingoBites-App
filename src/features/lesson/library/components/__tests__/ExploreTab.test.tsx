import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {ExploreTab, packAction, shelfPacks} from '../tabs/ExploreTab';

const mockReload = jest.fn();
const mockRefresh = jest.fn();
let mockPacks: {rows: unknown[] | null; offline: boolean} = {
  rows: null,
  offline: false,
};
let mockCatalog: Record<string, unknown> = {status: 'idle'};

/** Blur cleanups of the mounted focus effects, to leave the tab. */
const mockBlurs = new Set<() => void>();

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      ReactModule.useEffect(() => {
        const cleanup = callback();
        if (!cleanup) return undefined;
        mockBlurs.add(cleanup);
        return () => {
          mockBlurs.delete(cleanup);
          cleanup();
        };
      }, [callback]),
  };
});

jest.mock('@features/wordPath', () => ({
  useWordPathRows: () => ({...mockPacks, reload: mockReload}),
  packTitle: (_t: unknown, row: {topic: string | null; position: number}) =>
    row.topic ?? `Gói ${row.position}`,
  kindSummary: (_t: unknown, counts: {word: number}) => `${counts.word} từ`,
}));

jest.mock('@features/lesson/player', () => ({
  useCanonicalCatalog: () => ({
    state: mockCatalog,
    refresh: mockRefresh,
    loadMore: jest.fn(),
  }),
}));

const pack = (packId: string, status: string, downloaded = true) => ({
  packId,
  titleVi: packId,
  level: 'A1',
  position: 1,
  topic: `Topic ${packId}`,
  topicCode: 'topic:food',
  coverUrl: packId === 'going' ? 'https://cdn.example/going.png' : null,
  total: 10,
  learned: status === 'learning' ? 4 : 0,
  downloaded,
  kind: 'word',
  kindCounts: {word: 10, phrase: 0, pattern: 0, grammar: 0},
  preview: [],
  status,
});

const lesson = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Lesson ${id}`,
  description: '',
  origin: 'admin',
  source_type: 'admin_text',
  content_revision: 1,
  sentence_count: 8,
  youtube_video_id: null,
  unit: null,
  updated_at: '2026-10-06T00:00:00.000Z',
  ...overrides,
});

function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <ExploreTab />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const press = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  act(() => {
    tree.root.findByProps({testID: id}).props.onPress();
  });

describe('ExploreTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPacks = {
      rows: [pack('new', 'not_downloaded', false), pack('going', 'learning')],
      offline: false,
    };
    mockCatalog = {
      status: 'ready',
      lessons: [lesson('one'), lesson('two')],
      nextCursor: null,
      loadingMore: false,
    };
  });

  it('puts packs being learned first', () => {
    expect(shelfPacks(mockPacks.rows as never).map(row => row.packId)).toEqual([
      'going',
      'new',
    ]);
  });

  it('shows the packs and video shelves, not the course lessons', () => {
    const tree = render();
    expect(
      tree.root.findAllByProps({testID: 'library-pack-going'}),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'library-shelf-videos-one'}),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'library-shelf-lessons'}),
    ).toHaveLength(0);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('opens a downloaded pack, and the pack list for one to download', () => {
    const tree = render();
    press(tree, 'library-pack-going');
    expect(mockAppNavigation.openWordPack).toHaveBeenCalledWith('going');
    press(tree, 'library-pack-new');
    expect(mockAppNavigation.openLibrarySection).toHaveBeenCalledWith(
      'wordPath',
    );
  });

  it('opens a public video and the full list', () => {
    const tree = render();
    press(tree, 'library-shelf-videos-one');
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('one');
    press(tree, 'library-shelf-videos-all');
    expect(mockAppNavigation.openLibrarySection).toHaveBeenCalledWith(
      'publicVideo',
    );
  });

  it('asks for a connection when the catalog cannot load', () => {
    mockCatalog = {status: 'error', error: {kind: 'network-error'}};
    const tree = render();
    expect(
      tree.root.findByProps({testID: 'library-shelf-videos-message'}).props
        .children,
    ).toBe('Cần mạng để xem');
    press(tree, 'library-shelf-videos-retry');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('says it is offline and keeps the packs on the phone', () => {
    mockPacks = {rows: [pack('going', 'learning')], offline: true};
    const tree = render();
    expect(
      tree.root.findAllByProps({testID: 'library-explore-offline'}),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'library-pack-going'}),
    ).not.toHaveLength(0);
  });

  it('shows a spinner while the packs load', () => {
    mockPacks = {rows: null, offline: false};
    const tree = render();
    expect(
      tree.root.findAllByProps({testID: 'library-shelf-packs-loading'}),
    ).not.toHaveLength(0);
  });

  it('draws pack cards: the pack picture, else the default cover', () => {
    const tree = render();
    const image = tree.root.findByProps({
      testID: 'library-pack-going-cover-image',
    });
    expect(image.props.source).toEqual({uri: 'https://cdn.example/going.png'});
    expect(
      tree.root.findAllByProps({testID: 'library-pack-new-cover-default'}),
    ).not.toHaveLength(0);
    const card = tree.root
      .findAllByProps({testID: 'library-pack-new'})
      .find(node => node.props.accessibilityLabel);
    expect(card?.props.accessibilityLabel).toBe(
      'A1. Gói 1. Topic new. Chưa tải. 10 từ. Tải về',
    );
  });

  it('starts the pack stack over after leaving the tab', () => {
    mockPacks = {
      rows: [
        pack('one', 'learning'),
        pack('two', 'ready'),
        pack('three', 'ready'),
      ],
      offline: false,
    };
    const tree = render();
    const top = () =>
      tree.root.findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('library-pack-stack-card-') &&
          node.props.pointerEvents === 'auto',
      )[0]?.props.testID;
    const next = () =>
      act(() => {
        tree.root
          .findAll(
            node =>
              node.props.testID === 'library-pack-one' &&
              typeof node.props.onAccessibilityAction === 'function',
          )[0]
          .props.onAccessibilityAction({nativeEvent: {actionName: 'next'}});
      });
    next();
    expect(top()).toBe('library-pack-stack-card-1');
    act(() => {
      [...mockBlurs].forEach(blur => blur());
    });
    expect(top()).toBe('library-pack-stack-card-0');
  });

  it('labels each pack pill by its state', () => {
    const row = pack('p', 'ready') as never as Parameters<typeof packAction>[0];
    expect(packAction({...row, downloaded: false}).label).toBe('Tải về');
    expect(packAction({...row, learned: 0}).label).toBe('Vào học');
    expect(packAction({...row, learned: 4, status: 'learning'}).label).toBe(
      'Học tiếp',
    );
    expect(packAction({...row, learned: 10, status: 'done'}).label).toBe(
      'Ôn lại',
    );
  });

  it('shows the YouTube thumbnail of a video without a cover', () => {
    mockCatalog = {
      status: 'ready',
      lessons: [
        lesson('vid', {youtube_video_id: 'abc123', cefr_level: 'A2'}),
        lesson('own', {
          youtube_video_id: 'abc123',
          cover_url: 'https://cdn.example/own.png',
        }),
      ],
      nextCursor: null,
      loadingMore: false,
    };
    const tree = render();
    const thumb = tree.root.findByProps({
      testID: 'library-shelf-videos-vid-cover-image',
    });
    expect(thumb.props.source).toEqual({
      uri: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    });
    const own = tree.root.findByProps({
      testID: 'library-shelf-videos-own-cover-image',
    });
    expect(own.props.source).toEqual({uri: 'https://cdn.example/own.png'});
    // The level moves from a chip on the picture to the card's line.
    expect(
      tree.root.findByProps({testID: 'library-shelf-videos-vid-description'})
        .props.children,
    ).toContain('A2');
  });

  it('counts each folder, with a plus when the server has more', () => {
    mockCatalog = {
      status: 'ready',
      lessons: [lesson('one'), lesson('two')],
      nextCursor: 'next',
      loadingMore: false,
    };
    const tree = render();
    expect(
      tree.root.findByProps({testID: 'library-shelf-packs-count'}).props
        .children,
    ).toBe('2');
    expect(
      tree.root.findByProps({testID: 'library-shelf-videos-count'}).props
        .children,
    ).toBe('2+');
  });
});
