/**
 * Per-day usage of each app area (time in the foreground and times opened),
 * reported to the Server so the admin can see which features a learner uses.
 *
 * Totals are kept per local day and persisted, and the whole running total
 * of each day is sent: the Server keeps the larger value, so a resend or a
 * failed request never double-counts or loses time. Counts only — no screen
 * content leaves the device.
 */

/** Must match the Server's `ACTIVITY_FEATURES`. */
export const ACTIVITY_FEATURES = [
  'home',
  'courses',
  'lesson',
  'create',
  'library',
  'video',
  'review',
  'words',
  'combo',
  'grammar',
  'practice',
  'speaking',
  'shadowing',
  'profile',
  'other',
] as const;
export type ActivityFeature = (typeof ACTIVITY_FEATURES)[number];

export type ActivityDayReport = {
  day: string;
  features: Array<{
    feature: ActivityFeature;
    opens: number;
    active_seconds: number;
  }>;
};

type FeatureTotals = {opens: number; ms: number};
type DayTotals = Partial<Record<ActivityFeature, FeatureTotals>>;
type Stored = {userId: string; days: Record<string, DayTotals>};

export type ActivityStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type ActivityTrackerDeps = {
  storage: ActivityStorage;
  /** Resolves true once the Server stored the report. */
  send: (days: ActivityDayReport[]) => Promise<boolean>;
  now?: () => number;
};

export const ACTIVITY_STORAGE_KEY = 'lingobites.activity.v1';
/** A single uninterrupted stretch counts for at most this long. */
const MAX_SEGMENT_MS = 2 * 60 * 60 * 1000;
/** The Server accepts at most this many days per report. */
const MAX_REPORT_DAYS = 14;
const MAX_DAY_SECONDS = 86_400;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local calendar day, `YYYY-MM-DD`. */
export function localDay(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function isStored(value: unknown): value is Stored {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Stored).userId === 'string' &&
    typeof (value as Stored).days === 'object' &&
    (value as Stored).days !== null
  );
}

export class ActivityTracker {
  private readonly now: () => number;
  private state: Stored | null = null;
  private ready: Promise<void> = Promise.resolve();
  private feature: ActivityFeature | null = null;
  private segmentStart: number | null = null;
  private foreground = true;
  private flushing: Promise<void> | null = null;

  constructor(private readonly deps: ActivityTrackerDeps) {
    this.now = deps.now ?? Date.now;
  }

  /** Begin counting for a signed-in learner; earlier unsent totals of the same learner are kept. */
  start(userId: string): Promise<void> {
    if (this.state?.userId === userId) {
      return this.ready;
    }
    this.state = {userId, days: {}};
    this.feature = null;
    this.segmentStart = null;
    this.ready = this.load(userId);
    return this.ready;
  }

  /** Stop counting (sign-out or account switch) and keep what was counted. */
  async stop(): Promise<void> {
    this.closeSegment();
    this.feature = null;
    await this.persist();
    this.state = null;
  }

  /** The focused screen moved to `feature`. */
  enter(feature: ActivityFeature): void {
    if (!this.state || feature === this.feature) {
      return;
    }
    this.closeSegment();
    this.feature = feature;
    if (this.foreground) {
      this.countOpen(feature);
      this.segmentStart = this.now();
    }
    this.persist().catch(() => {});
  }

  /** The app came back to the foreground. */
  resume(): void {
    if (this.foreground) {
      return;
    }
    this.foreground = true;
    if (this.state && this.feature) {
      this.countOpen(this.feature);
      this.segmentStart = this.now();
    }
  }

  /** The app went to the background: bank the time and report it. */
  async pause(): Promise<void> {
    if (!this.foreground) {
      return;
    }
    this.foreground = false;
    this.closeSegment();
    await this.persist();
    await this.flush();
  }

  /** Send every unsent day; days before today are dropped once stored. */
  flush(): Promise<void> {
    if (!this.flushing) {
      this.flushing = this.doFlush().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  /** What would be sent now (also the test seam). */
  report(): ActivityDayReport[] {
    if (!this.state) {
      return [];
    }
    return Object.keys(this.state.days)
      .sort()
      .slice(-MAX_REPORT_DAYS)
      .map(day => ({
        day,
        features: ACTIVITY_FEATURES.flatMap(feature => {
          const totals = this.state?.days[day]?.[feature];
          if (!totals || (totals.opens === 0 && totals.ms < 1000)) {
            return [];
          }
          return [
            {
              feature,
              opens: totals.opens,
              active_seconds: Math.min(
                MAX_DAY_SECONDS,
                Math.floor(totals.ms / 1000),
              ),
            },
          ];
        }),
      }))
      .filter(entry => entry.features.length > 0);
  }

  private async doFlush(): Promise<void> {
    await this.ready;
    const state = this.state;
    const days = this.report();
    if (!state || days.length === 0) {
      return;
    }
    let sent = false;
    try {
      sent = await this.deps.send(days);
    } catch {
      sent = false;
    }
    if (!sent || this.state !== state) {
      return;
    }
    const today = localDay(this.now());
    for (const day of Object.keys(state.days)) {
      if (day < today) {
        delete state.days[day];
      }
    }
    await this.persist();
  }

  private async load(userId: string): Promise<void> {
    let saved: unknown = null;
    try {
      const raw = await this.deps.storage.getItem(ACTIVITY_STORAGE_KEY);
      saved = raw ? JSON.parse(raw) : null;
    } catch {
      saved = null;
    }
    const state = this.state;
    if (!state || state.userId !== userId) {
      return;
    }
    if (!isStored(saved) || saved.userId !== userId) {
      return;
    }
    // Merge what was counted before this launch with what was counted
    // while the saved totals were loading.
    for (const [day, features] of Object.entries(saved.days)) {
      for (const feature of ACTIVITY_FEATURES) {
        const before = features?.[feature];
        if (!before) {
          continue;
        }
        const totals = this.totalsFor(day, feature);
        totals.opens += Number(before.opens) || 0;
        totals.ms += Number(before.ms) || 0;
      }
    }
  }

  private async persist(): Promise<void> {
    await this.ready;
    if (!this.state) {
      return;
    }
    try {
      await this.deps.storage.setItem(
        ACTIVITY_STORAGE_KEY,
        JSON.stringify(this.state),
      );
    } catch {
      // Best effort: an unsaved total is only lost if the app is killed.
    }
  }

  private countOpen(feature: ActivityFeature): void {
    this.totalsFor(localDay(this.now()), feature).opens += 1;
  }

  private closeSegment(): void {
    if (this.segmentStart === null || !this.feature || !this.state) {
      this.segmentStart = null;
      return;
    }
    const elapsed = Math.min(
      Math.max(0, this.now() - this.segmentStart),
      MAX_SEGMENT_MS,
    );
    this.totalsFor(localDay(this.segmentStart), this.feature).ms += elapsed;
    this.segmentStart = null;
  }

  private totalsFor(day: string, feature: ActivityFeature): FeatureTotals {
    const days = this.state!.days;
    const dayTotals = (days[day] ??= {});
    return (dayTotals[feature] ??= {opens: 0, ms: 0});
  }
}
