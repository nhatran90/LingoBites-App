import {StyleSheet} from 'react-native';
import {act} from 'react-test-renderer';

import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {mockAppNavigation} from '@test/support/appNavigationMock';
import {catalogItem} from '@test/support/catalogItemFixture';
import {has, press, renderWithTheme, textOf} from '@test/support/lessonFlow';

import {addToReview} from '../../logic/addToReview';
import {memoryOf} from '../../logic/libraryRepository';
import {usePatternLibrary, useTenseLibrary} from '../../logic/useLibrary';
import {PatternDetailScreen} from '../PatternDetailScreen';
import {PatternLibraryList} from '../PatternLibraryList';
import {TenseDetailScreen} from '../TenseDetailScreen';
import {TenseMapView} from '../TenseMapView';

/** Vocab path P6: the pattern library, the tense map and their detail screens. */

jest.mock('../../logic/useLibrary', () => ({
  usePatternLibrary: jest.fn(),
  useTenseLibrary: jest.fn(),
}));
jest.mock('../../logic/libraryRepository', () => ({
  memoryOf: jest.fn(),
  readTenseImageUrl: jest.fn(() => null),
}));
jest.mock('../../logic/addToReview', () => ({
  addToReview: jest.fn(),
}));

const mockPatterns = usePatternLibrary as jest.MockedFunction<
  typeof usePatternLibrary
>;
const mockTenses = useTenseLibrary as jest.MockedFunction<
  typeof useTenseLibrary
>;
const mockMemory = memoryOf as jest.MockedFunction<typeof memoryOf>;
const mockAdd = addToReview as jest.MockedFunction<typeof addToReview>;

const worth = catalogItem(
  'pattern:worth',
  'pattern',
  'It is worth noting that {clause}',
  {
    meaning_vi: 'Đáng chú ý là',
    payload: {slots: {clause: {label_vi: 'mệnh đề', values: ['prices rise']}}},
    examples: [
      {
        text_en: 'It is worth noting that prices rose.',
        text_vi: 'Đáng chú ý là giá đã tăng.',
        audience: 'all',
        audio: null,
      },
    ],
  },
);
const because = catalogItem(
  'pattern:because',
  'pattern',
  'This is because {reason}',
);
const pastSimple = catalogItem(
  'grammar:past-simple',
  'grammar',
  'Past simple',
  {
    payload: {
      family: 'tense',
      forms: {
        affirmative: 'S + V2',
        negative: "S didn't V",
        question: 'Did S V?',
      },
      signals: ['yesterday', 'ago'],
      time: 'past',
      aspect: 'simple',
      uses_vi: ['Việc đã xong trong quá khứ'],
      contrast_with: ['grammar:present-perfect'],
    },
  },
);
const presentPerfect = catalogItem(
  'grammar:present-perfect',
  'grammar',
  'Present perfect',
);

const reload = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockMemory.mockReturnValue(null);
  mockPatterns.mockReturnValue({
    data: {
      patterns: [
        {item: worth, cefrLevel: 'B2', tags: ['function:emphasis']},
        {item: because, cefrLevel: 'B1', tags: ['function:cause']},
      ],
      functions: [
        {code: 'function:cause', labelVi: 'Nguyên nhân'},
        {code: 'function:emphasis', labelVi: 'Nhấn mạnh'},
      ],
      exams: [],
    },
    loading: false,
    offline: false,
    reload,
  });
  mockTenses.mockReturnValue({
    data: [
      {
        item: pastSimple,
        time: 'past',
        aspect: 'simple',
        imageUrl: 'https://media.example.test/past.png',
      },
      {item: presentPerfect, time: 'present', aspect: 'perfect'},
      {
        item: catalogItem('grammar:be-going-to', 'grammar', 'Be going to'),
        time: 'future',
        aspect: null,
      },
    ],
    loading: false,
    offline: true,
    reload,
  });
});

test('the pattern library filters by function and opens a pattern', () => {
  const tree = renderWithTheme(<PatternLibraryList query="" />);
  expect(has(tree, 'pattern-row-pattern:worth')).toBe(true);
  expect(has(tree, 'pattern-row-pattern:because')).toBe(true);
  expect(has(tree, 'pattern-filter-exam-all')).toBe(false);
  press(tree, 'pattern-filter-function-function:cause');
  expect(has(tree, 'pattern-row-pattern:worth')).toBe(false);
  press(tree, 'pattern-row-pattern:because');
  expect(mockAppNavigation.openPatternDetail).toHaveBeenCalledWith(
    'pattern:because',
  );
});

test('the level tabs count and filter the patterns; scheduled ones say so', () => {
  mockMemory.mockImplementation(code =>
    code === 'pattern:worth' ? {stage: 1, stableAt: null} : null,
  );
  const tree = renderWithTheme(<PatternLibraryList query="" />);
  expect(has(tree, 'pattern-row-pattern:worth-in-review')).toBe(true);
  expect(has(tree, 'pattern-row-pattern:because-in-review')).toBe(false);
  press(tree, 'pattern-filter-level-B1');
  expect(has(tree, 'pattern-row-pattern:worth')).toBe(false);
  expect(has(tree, 'pattern-row-pattern:because')).toBe(true);
  press(tree, 'pattern-filter-level-all');
  expect(has(tree, 'pattern-row-pattern:worth')).toBe(true);
});

test('the search box matches the meaning without accents', () => {
  const tree = renderWithTheme(<PatternLibraryList query="dang chu y" />);
  expect(has(tree, 'pattern-row-pattern:worth')).toBe(true);
  expect(has(tree, 'pattern-row-pattern:because')).toBe(false);
});

test('without a kept list and without a network, the library offers a retry', () => {
  mockPatterns.mockReturnValue({
    data: null,
    loading: false,
    offline: true,
    reload,
  });
  const tree = renderWithTheme(<PatternLibraryList query="" />);
  expect(has(tree, 'pattern-library-offline')).toBe(true);
});

test('the tense map places tenses, colours them by memory and opens one', () => {
  mockMemory.mockImplementation(code =>
    code === 'grammar:past-simple' ? {stage: 4, stableAt: null} : null,
  );
  const tree = renderWithTheme(<TenseMapView />);
  expect(has(tree, 'tense-map-stale')).toBe(true);
  const cell = tree.root.findAll(
    node => node.props.testID === 'tense-cell-grammar:past-simple',
  )[0]!;
  expect(cell.props.accessibilityLabel).toBe('Past simple, Đã nhớ');
  // The picture is the tile's face; a tense without one gets the default face.
  expect(has(tree, 'tense-cell-grammar:past-simple-thumb-image')).toBe(true);
  expect(has(tree, 'tense-cell-grammar:present-perfect-thumb-default')).toBe(
    true,
  );
  // A remembered tense carries its level chip; one not yet learned has none.
  expect(has(tree, 'tense-cell-grammar:past-simple-level')).toBe(true);
  expect(has(tree, 'tense-cell-grammar:present-perfect-level')).toBe(false);
  expect(has(tree, 'tense-time-past')).toBe(true);
  // Tiles are framed in their time's colour: past in sun, present in mint.
  const frameOf = (code: string) =>
    StyleSheet.flatten(
      tree.root.findAll(
        node =>
          node.props.testID === `tense-cell-${code}-face` &&
          node.props.style !== undefined,
      )[0]!.props.style,
    ).borderColor;
  expect(frameOf('grammar:past-simple')).toBe(HERO_PALETTE.sun);
  expect(frameOf('grammar:present-perfect')).toBe(HERO_PALETTE.faceFrom);
  expect(has(tree, 'tense-map-legend')).toBe(true);
  expect(has(tree, 'tense-cell-grammar:be-going-to')).toBe(true);
  press(tree, 'tense-cell-grammar:present-perfect');
  expect(mockAppNavigation.openTenseDetail).toHaveBeenCalledWith(
    'grammar:present-perfect',
  );
});

test('a pattern shows its slots and examples, opens a combo set and adds itself to review', async () => {
  mockAdd.mockResolvedValue({ok: true, alreadyScheduled: false});
  const tree = renderWithTheme(
    <PatternDetailScreen item={worth} labels={['B2', 'Nhấn mạnh']} />,
  );
  expect(has(tree, 'pattern-detail')).toBe(true);
  press(tree, 'pattern-practise');
  expect(mockAppNavigation.openComboSetup).toHaveBeenCalledWith(
    'pattern:worth',
  );
  await act(async () => {
    tree.root
      .findAll(node => node.props.testID === 'add-to-review')
      .find(node => typeof node.props.onPress === 'function')!
      .props.onPress();
  });
  expect(mockAdd).toHaveBeenCalledWith('pattern:worth');
  expect(textOf(tree, 'add-to-review-done')).toBe('Đang ôn');
});

test('picking a value for a slot rebuilds the sentence', () => {
  const free = catalogItem(
    'pattern:free',
    'pattern',
    'Are you free on {day}?',
    {
      meaning_vi: 'Bạn có rảnh vào [thứ] không?',
      payload: {slots: {day: {label_vi: 'thứ', values: ['Monday', 'Friday']}}},
    },
  );
  const tree = renderWithTheme(
    <PatternDetailScreen item={free} labels={['A2']} />,
  );
  expect(textOf(tree, 'pattern-sentence')).toBe('Are you free on Monday?');
  press(tree, 'pattern-choice-day-1');
  expect(textOf(tree, 'pattern-sentence')).toBe('Are you free on Friday?');
});

test('adding to review offline says a connection is needed', async () => {
  mockAdd.mockResolvedValue({ok: false, offline: true});
  const tree = renderWithTheme(
    <PatternDetailScreen item={worth} labels={[]} />,
  );
  await act(async () => {
    tree.root
      .findAll(node => node.props.testID === 'add-to-review')
      .find(node => typeof node.props.onPress === 'function')!
      .props.onPress();
  });
  expect(textOf(tree, 'add-to-review-error')).toBe('Cần mạng để tải lần đầu');
});

test('a scheduled tense shows it is in review; its confusions open', () => {
  mockMemory.mockReturnValue({stage: 1, stableAt: null});
  const tree = renderWithTheme(
    <TenseDetailScreen item={pastSimple} related={[presentPerfect]} />,
  );
  expect(has(tree, 'tense-detail')).toBe(true);
  expect(has(tree, 'tense-forms')).toBe(true);
  expect(has(tree, 'tense-timeline')).toBe(true);
  expect(has(tree, 'tense-hero-thumb-default')).toBe(true);
  expect(has(tree, 'add-to-review-done')).toBe(true);
  press(tree, 'tense-related-grammar:present-perfect');
  expect(mockAppNavigation.openTenseDetail).toHaveBeenCalledWith(
    'grammar:present-perfect',
  );
});

test('a tense shows its picture as the hero', () => {
  const tree = renderWithTheme(
    <TenseDetailScreen
      imageUrl="https://media.example.test/past.png"
      item={pastSimple}
      related={[]}
    />,
  );
  expect(has(tree, 'tense-hero-thumb-image')).toBe(true);
  expect(has(tree, 'tense-related-grammar:present-perfect')).toBe(false);
});

test('a detail opened before the library is kept says so', () => {
  const tree = renderWithTheme(<TenseDetailScreen item={null} />);
  expect(has(tree, 'tense-detail')).toBe(false);
});
