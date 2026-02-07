import { Temporal } from 'temporal-polyfill';

import { AppError } from './error.ts';
import { castTo } from './types.ts';

const TIME_UNIT_TO_DURATION_UNIT = {
  y: 'years', year: 'years', years: 'years',
  M: 'months', month: 'months', months: 'months',
  w: 'weeks', week: 'weeks', weeks: 'weeks',
  d: 'days', day: 'days', days: 'days',
  h: 'hours', hour: 'hours', hours: 'hours',
  m: 'minutes', minute: 'minutes', minutes: 'minutes',
  s: 'seconds', second: 'seconds', seconds: 'seconds',
  ms: 'milliseconds', millisecond: 'milliseconds', milliseconds: 'milliseconds'
} as const;

export type TimeSpan = `${number}${keyof typeof TIME_UNIT_TO_DURATION_UNIT}`;
export type TimeUnit = keyof typeof TIME_UNIT_TO_DURATION_UNIT;

const TIME_PATTERN = /^(?<amount>-?[0-9]+)(?<unit>(?:(?:year|month|week|day|hour|minute|second|millisecond)s?)|(?:y|M|w|d|h|m|s|ms))$/;

export type TimeSpanInput = Temporal.Duration | TimeSpan | number | string;

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
  static duration(input: TimeSpanInput, outputUnit: TimeUnit): number;
  static duration(input: TimeSpanInput, outputUnit: undefined): Temporal.Duration;
  static duration(input: TimeSpanInput): Temporal.Duration;
  static duration(input: TimeSpanInput, outputUnit?: TimeUnit): Temporal.Duration | number {
    let value: number;
    let unit: TimeUnit = 'ms';
    if (typeof input === 'string' && TIME_PATTERN.test(input)) {
      const groups = input.match(TIME_PATTERN)?.groups ?? {};
      value = parseInt(groups.amount ?? `${input}`, 10);
      unit = castTo<TimeUnit>(groups.unit || 'ms');
    } else if (input instanceof Temporal.Duration) {
      value = Math.trunc(input.total('milliseconds'));
    } else if (typeof input === 'number') {
      value = input;
    } else {
      value = parseInt(input, 10);
    }
    if (Number.isNaN(value)) {
      throw new AppError(`Unable to parse time value: ${input}`, { category: 'data' });
    }

    const duration = Temporal.Duration.from({ [TIME_UNIT_TO_DURATION_UNIT[unit]]: value });
    if (outputUnit) {
      return Math.trunc(duration.total(TIME_UNIT_TO_DURATION_UNIT[outputUnit]));
    } else {
      return duration;
    }
  }

  /**
   * Returns a new date with `amount` units into the future
   */
  static fromNow(input: TimeSpanInput): Date {
    let delta = this.duration(input);
    if (delta.days || delta.weeks || delta.months || delta.years) {
      delta = Temporal.Duration.from({
        minutes: delta.minutes,
        seconds: delta.seconds,
        milliseconds: delta.milliseconds,
        hours: delta.days * 24 +
          delta.weeks * 7 * 24 +
          delta.months * 30 * 24 +
          delta.years * 365 * 24,
      });
    }
    return new Date(Temporal.Now.instant().add(delta).epochMilliseconds);
  }

  /**
   * Returns a pretty timestamp
   */
  static asClock(input: TimeSpanInput): string {
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