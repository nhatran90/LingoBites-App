import {
  ACTIVITY_STORAGE_KEY,
  type ActivityDayReport,
  ActivityTracker,
  localDay,
} from '../activityTracker';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = {...initial};
  return {
    data,
    getItem: jest.fn(async (key: string) => data[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data[key] = value;
    }),
  };
}

function setup(
  options: {initial?: Record<string, string>; sendOk?: boolean} = {},
) {
  let clock = new Date(2026, 9, 18, 9, 0, 0).getTime();
  const storage = memoryStorage(options.initial);
  const sent: ActivityDayReport[][] = [];
  const send = jest.fn(async (days: ActivityDayReport[]) => {
    sent.push(days);
    return options.sendOk ?? true;
  });
  const tracker = new ActivityTracker({storage, send, now: () => clock});
  return {
    tracker,
    storage,
    send,
    sent,
    advance: (seconds: number) => {
      clock += seconds * 1000;
    },
    setClock: (date: Date) => {
      clock = date.getTime();
    },
  };
}

describe('ActivityTracker', () => {
  it('counts opens and foreground time per area', async () => {
    const {tracker, advance} = setup();
    await tracker.start('user-1');

    tracker.enter('home');
    advance(30);
    tracker.enter('lesson');
    advance(600);
    tracker.enter('lesson');
    advance(60);
    tracker.enter('home');

    expect(tracker.report()).toEqual([
      {
        day: '2026-10-18',
        features: [
          {feature: 'home', opens: 2, active_seconds: 30},
          {feature: 'lesson', opens: 1, active_seconds: 660},
        ],
      },
    ]);
  });

  it('stops the clock in the background and reports the totals', async () => {
    const {tracker, advance, sent} = setup();
    await tracker.start('user-1');
    tracker.enter('review');
    advance(120);
    await tracker.pause();
    advance(3600);
    tracker.resume();
    advance(30);
    await tracker.pause();

    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual([
      {
        day: '2026-10-18',
        features: [{feature: 'review', opens: 2, active_seconds: 150}],
      },
    ]);
  });

  it('drops past days only after the Server stored them', async () => {
    const {tracker, advance, setClock, sent} = setup();
    await tracker.start('user-1');
    tracker.enter('words');
    advance(90);
    setClock(new Date(2026, 9, 19, 8, 0, 0));
    tracker.enter('combo');
    advance(10);
    await tracker.flush();

    expect(sent[0]!.map(day => day.day)).toEqual(['2026-10-18', '2026-10-19']);
    expect(tracker.report().map(day => day.day)).toEqual(['2026-10-19']);
  });

  it('keeps everything when the report fails', async () => {
    const {tracker, advance} = setup({sendOk: false});
    await tracker.start('user-1');
    tracker.enter('lesson');
    advance(45);
    await tracker.pause();

    expect(tracker.report()[0]!.features).toEqual([
      {feature: 'lesson', opens: 1, active_seconds: 45},
    ]);
  });

  it('adds totals saved by an earlier launch of the same learner', async () => {
    const day = localDay(new Date(2026, 9, 18, 9, 0, 0).getTime());
    const initial = {
      [ACTIVITY_STORAGE_KEY]: JSON.stringify({
        userId: 'user-1',
        days: {[day]: {lesson: {opens: 2, ms: 100_000}}},
      }),
    };
    const {tracker, advance, storage} = setup({initial});
    await tracker.start('user-1');
    tracker.enter('lesson');
    advance(20);
    await tracker.pause();

    expect(tracker.report()[0]!.features).toEqual([
      {feature: 'lesson', opens: 3, active_seconds: 120},
    ]);
    expect(storage.setItem).toHaveBeenCalled();
  });

  it('never reports another learner’s totals', async () => {
    const initial = {
      [ACTIVITY_STORAGE_KEY]: JSON.stringify({
        userId: 'user-old',
        days: {'2026-10-18': {lesson: {opens: 9, ms: 900_000}}},
      }),
    };
    const {tracker} = setup({initial});
    await tracker.start('user-1');

    expect(tracker.report()).toEqual([]);
  });

  it('caps one uninterrupted stretch at two hours', async () => {
    const {tracker, advance} = setup();
    await tracker.start('user-1');
    tracker.enter('video');
    advance(5 * 3600);
    tracker.enter('home');

    const video = tracker
      .report()[0]!
      .features.find(entry => entry.feature === 'video');
    expect(video).toEqual({
      feature: 'video',
      opens: 1,
      active_seconds: 7200,
    });
  });

  it('ignores screens before start and after stop', async () => {
    const {tracker, advance, send} = setup();
    tracker.enter('home');
    await tracker.start('user-1');
    tracker.enter('home');
    advance(5);
    await tracker.stop();
    tracker.enter('lesson');
    await tracker.flush();

    expect(tracker.report()).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });
});
