import { RuntimeError } from './error.ts';
import { castTo } from './types.ts';

const TIME_UNIT_TO_TEMPORAL_UNIT = {
  y: 'years', year: 'years', years: 'years',
  M: 'months', month: 'months', months: 'months',
  w: 'weeks', week: 'weeks', weeks: 'weeks',
  d: 'days', day: 'days', days: 'days',
  h: 'hours', hour: 'hours', hours: 'hours',
  m: 'minutes', minute: 'minutes', minutes: 'minutes',
  s: 'seconds', second: 'seconds', seconds: 'seconds',
  ms: 'milliseconds', millisecond: 'milliseconds', milliseconds: 'milliseconds'
} as const;
type TemporalUnit = typeof TIME_UNIT_TO_TEMPORAL_UNIT[keyof typeof TIME_UNIT_TO_TEMPORAL_UNIT];

export type TimeSpan = `${number}${keyof typeof TIME_UNIT_TO_TEMPORAL_UNIT}`;
export type TimeUnit = keyof typeof TIME_UNIT_TO_TEMPORAL_UNIT;

const TIME_PATTERN = /^(?<amount>-?[0-9]+)(?<unit>(?:(?:year|month|week|day|hour|minute|second|millisecond)s?)|(?:y|M|w|d|h|m|s|ms))$/;

export class TimeUtil {

  /**
   * Test to see if a string is valid for relative time
   */
  static isTimeSpan(value: string): value is TimeSpan {
    return TIME_PATTERN.test(value);
  }

  /**
   * Exposes the ability to create a duration succinctly
   */
  static duration(input: TimeSpan | number | string, outputUnit: TimeUnit): number;
  static duration(input: TimeSpan | number | string, outputUnit: undefined): Temporal.Duration;
  static duration(input: TimeSpan | number | string): Temporal.Duration;
  static duration(input: TimeSpan | number | string, outputUnit?: TimeUnit): Temporal.Duration | number {
    let value: number;
    let unit: TemporalUnit = 'milliseconds';
    if (typeof input === 'string' && TIME_PATTERN.test(input)) {
      const groups = input.match(TIME_PATTERN)?.groups ?? {};
      value = parseInt(groups.amount ?? `${input}`, 10);
      unit = TIME_UNIT_TO_TEMPORAL_UNIT[castTo<TimeUnit>(groups.unit || 'ms')];
    } else if (typeof input === 'number') {
      value = input;
    } else {
      value = parseInt(input, 10);
    }
    if (Number.isNaN(value)) {
      throw new RuntimeError(`Unable to parse time value: ${input}`, { category: 'data' });
    }

    switch (unit) {
      case 'years': { unit = 'hours'; value = value * 365 * 24; break; }
      case 'months': { value = value * 30 * 24; unit = 'hours'; break; }
      case 'weeks': { value = value * 7 * 24; unit = 'hours'; break; }
      case 'days': { value = value * 24; unit = 'hours'; break; }
    }

    const duration = Temporal.Duration.from({ [unit]: value });
    if (outputUnit) {
      const resolved = TIME_UNIT_TO_TEMPORAL_UNIT[outputUnit];
      switch (resolved) {
        case 'years': return Math.trunc(duration.total('hours') / (365 * 24));
        case 'months': return Math.trunc(duration.total('hours') / (30 * 24));
        case 'weeks': return Math.trunc(duration.total('hours') / (7 * 24));
        default: return Math.trunc(duration.total(resolved));
      }
    } else {
      return duration;
    }
  }

  /**
   * Returns a new date with `amount` units into the future
   */
  static fromNow(input: TimeSpan | number | string): Date {
    return new Date(Temporal.Now.instant().add(this.duration(input)).epochMilliseconds);
  }

  /**
   * Returns a pretty timestamp
   */
  static asClock(input: TimeSpan | number | string): string {
    const seconds = this.duration(input, 's') % 60;
    const minutes = this.duration(input, 'm') % 60;
    const hours = this.duration(input, 'h');
    const toFixed = (value: number): string => value.toString().padStart(2, '0');

    if (hours) {
      return `${toFixed(hours)}h ${toFixed(minutes)}m`;
    } else if (minutes) {
      return `${toFixed(minutes)}m ${toFixed(seconds)}s`;
    } else {
      return `${toFixed(seconds)}s`;
    }
  }
}