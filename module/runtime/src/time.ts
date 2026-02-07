import { Temporal } from 'temporal-polyfill';

import { AppError } from './error.ts';
import { castTo } from './types.ts';

const TIME_UNIT_TO_DURATION_UNIT = {
  y: 'years',
  year: 'years',
  years: 'years',
  M: 'months',
  month: 'months',
  months: 'months',
  w: 'weeks',
  week: 'weeks',
  weeks: 'weeks',
  d: 'days',
  day: 'days',
  days: 'days',
  h: 'hours',
  hour: 'hours',
  hours: 'hours',
  m: 'minutes',
  minute: 'minutes',
  minutes: 'minutes',
  s: 'seconds',
  second: 'seconds',
  seconds: 'seconds',
  ms: 'milliseconds',
  millisecond: 'milliseconds',
  milliseconds: 'milliseconds'
} as const;

export type TimeSpan = `${number}${keyof typeof TIME_UNIT_TO_DURATION_UNIT}`;
export type TimeUnit = keyof typeof TIME_UNIT_TO_DURATION_UNIT;

const TIME_PATTERN = /^(?<amount>-?[0-9]+)(?<unit>(?:(?:year|month|week|day|hour|minute|second|millisecond)s?)|(?:y|M|w|d|h|m|s|ms))$/;

export type TimeSpanInput = Temporal.Duration | TimeSpan | number | string;

export class TimeUtil {

  /**
   * Test to see if a string is valid for relative time
   * @param val
   */
  static isTimeSpan(value: string): value is TimeSpan {
    return TIME_PATTERN.test(value);
  }

  /**
   * Exposes the ability to create a duration succinctly
   */
  static duration(input: TimeSpanInput): Temporal.Duration {
    let value: number;
    let unit: TimeUnit;
    if (input instanceof Temporal.Duration) {
      return Temporal.Duration.from(input);
    } else if (typeof input === 'number') {
      value = input;
      unit = 'ms';
    } else if (TIME_PATTERN.test(input)) {
      const groups = input.match(TIME_PATTERN)?.groups ?? {};
      value = parseInt(groups.amount ?? `${input}`, 10);
      unit = castTo<TimeUnit>(groups.unit || 'ms');
    } else {
      value = parseInt(input, 10);
      unit = 'ms';
    }
    if (Number.isNaN(value)) {
      throw new AppError(`Unable to parse time value: ${input}`, { category: 'data' });
    }
    return Temporal.Duration.from({ [TIME_UNIT_TO_DURATION_UNIT[unit]]: value });
  }

  /**
   * Returns a new date with `amount` units into the future
   * @param input Number of units to extend
   */
  static fromNow(input: TimeSpanInput): Date {
    return new Date(Temporal.Now.instant().add(this.duration(input)).epochMilliseconds);
  }

  /**
   * Returns a pretty timestamp
   * @param input Time span
   */
  static asClock(input: TimeSpanInput): string {
    const duration = this.duration(input);
    const seconds = duration.total({ unit: 'seconds' }) % 60;
    const minutes = duration.total({ unit: 'minutes' }) % 60;
    const hours = duration.total({ unit: 'hours' });
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