import {
  momentFailureCopy,
  momentFailureKind,
  momentFailureMessage,
} from '../momentMessages';

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;

describe('momentFailureMessage', () => {
  it('names the daily limit when the server refuses for quota', () => {
    expect(momentFailureMessage('COMPOSE_LIMIT_REACHED', t, 10)).toBe(
      'moment.limit_reached:{"limit":10}',
    );
    expect(momentFailureMessage('COMPOSE_LIMIT_REACHED', t)).toBe(
      'moment.limit_reached_plain',
    );
  });

  it('explains refusals that used to read as a generic failure', () => {
    expect(momentFailureMessage('MOMENT_RUNNING', t)).toBe('moment.running');
    expect(momentFailureMessage('MOMENT_DISABLED', t)).toBe('moment.disabled');
    expect(momentFailureMessage('STORE_UNAVAILABLE', t)).toBe(
      'moment.unavailable',
    );
    expect(momentFailureMessage('HTTP_500', t)).toBe('moment.generic_failed');
  });
});

describe('momentFailureKind', () => {
  it('groups server codes by what the learner can do next', () => {
    expect(momentFailureKind('MOMENT_AUTHOR_FAILED')).toBe('system');
    expect(momentFailureKind('CREATION_ATTEMPTS_EXHAUSTED')).toBe('system');
    expect(momentFailureKind('COMPOSE_PROVIDER_FAILED')).toBe('system');
    expect(momentFailureKind(undefined)).toBe('system');
    expect(momentFailureKind('MOMENT_NOT_SUITABLE')).toBe('not_suitable');
    expect(momentFailureKind('COMPOSE_BUDGET_EXHAUSTED')).toBe('paused');
    expect(momentFailureKind('MOMENT_DISABLED')).toBe('paused');
    expect(momentFailureKind('COMPOSE_LIMIT_REACHED')).toBe('limit');
    expect(momentFailureKind('MOMENT_EXPIRED')).toBe('cancelled');
    expect(momentFailureKind('SITUATION_NOT_FOUND')).toBe('pick_other');
  });

  it('gives each group its own heading', () => {
    expect(momentFailureCopy('MOMENT_AUTHOR_FAILED', t)).toEqual({
      kind: 'system',
      title: 'moment.fail_system_title',
      message: 'moment.fail_system_body',
    });
    expect(momentFailureCopy('COMPOSE_LIMIT_REACHED', t, 3)).toEqual({
      kind: 'limit',
      title: 'moment.fail_limit_title',
      message: 'moment.limit_reached:{"limit":3}',
    });
  });
});
