import {
  createInMemoryAnalyticsAdapter,
  getTextLengthBucket,
  resetAnalyticsAdapter,
  sanitizeAnalyticsPayload,
  setAnalyticsAdapter,
  trackAppOpened,
  trackEvent,
} from '../..';

describe('getTextLengthBucket', () => {
  it('maps lengths to canonical buckets', () => {
    expect(getTextLengthBucket(50)).toBe('1-100');
    expect(getTextLengthBucket(250)).toBe('101-500');
    expect(getTextLengthBucket(3001)).toBe('3000+');
  });
});

describe('sanitizeAnalyticsPayload', () => {
  it('rejects forbidden sensitive keys', () => {
    expect(() => sanitizeAnalyticsPayload({confirmed_text: 'secret'})).toThrow(
      'confirmed_text',
    );
  });

  it('allows metadata-only properties', () => {
    expect(
      sanitizeAnalyticsPayload({
        status: 'success',
        sentence_count: 3,
        text_length_bucket: '101-500',
      }),
    ).toEqual({
      status: 'success',
      sentence_count: 3,
      text_length_bucket: '101-500',
    });
  });
});

describe('funnel analytics', () => {
  const adapter = createInMemoryAnalyticsAdapter();

  beforeEach(() => {
    adapter.clear();
    setAnalyticsAdapter(adapter);
  });

  afterAll(() => {
    resetAnalyticsAdapter();
  });

  it('records core funnel events without raw text (TC-023)', () => {
    trackEvent('input_method_selected', {method: 'paste_text', screen: 'Home'});
    trackEvent('text_entered', {text_length_bucket: getTextLengthBucket(42)});
    trackEvent('text_confirmed', {
      source_type: 'paste_text',
      text_length_bucket: '1-100',
      edited_after_ocr: false,
    });
    trackEvent('ai_analysis_started', {
      text_length_bucket: '1-100',
      level: 'Beginner',
      prompt_version: 'lesson-analysis-v1',
    });
    trackEvent('ai_analysis_completed', {
      status: 'success',
      duration_ms: 120,
      sentence_count: 2,
      vocabulary_count: 4,
      grammar_count: 1,
    });
    trackEvent('result_viewed', {
      source_type: 'paste_text',
      sentence_count: 2,
      vocabulary_count: 4,
      grammar_count: 1,
    });
    trackEvent('lesson_saved', {
      lesson_id: 'lesson-1',
      source_type: 'paste_text',
      time_from_result_view_ms: 500,
    });

    const events = adapter.getEvents().map(item => item.event);
    expect(events).toEqual([
      'input_method_selected',
      'text_entered',
      'text_confirmed',
      'ai_analysis_started',
      'ai_analysis_completed',
      'result_viewed',
      'lesson_saved',
    ]);

    const serialized = JSON.stringify(adapter.getEvents());
    expect(serialized).not.toContain('We are offering');
    expect(serialized).not.toContain('confirmed_text');
  });

  it('reports the build version on app_opened', () => {
    trackAppOpened();
    const opened = adapter
      .getEvents()
      .find(recorded => recorded.event === 'app_opened');
    // From IOS_/ANDROID_APP_VERSION_NAME (jest.setup.js), not package.json.
    expect(opened?.properties.app_version).toBe('1.0.1');
  });
});
