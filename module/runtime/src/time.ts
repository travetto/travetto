import { Temporal } from 'temporal-polyfill';

import { AppError } from './error.ts';

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

const TIME_PATTERN = new RegExp(`^(?<amount>-?[0-9.]+)(?<unit>${Object.keys(TIME_UNIT_TO_DURATION_UNIT).join('|')})$`);
const TIME_LIKE_STRING = /\d{1,30}[a-z]$/i;

export class TimeUtil {

  /**
   * Test to see if a string is valid for relative time
   * @param val
   */
  static isTimeSpan(value: string): value is TimeSpan {
    return TIME_PATTERN.test(value);
  }

  static duration(input: Date | TimeSpan | number | string, inputUnit?: TimeUnit): Temporal.Duration {
    let value: number;
    let unit: TimeUnit;
    if (input instanceof Date) {
      value = input.getTime();
      unit = 'ms';
    } else if (typeof input === 'number') {
      value = input;
      unit ??= inputUnit ?? 'ms';
    } else if (TIME_LIKE_STRING.test(input)) {
      const groups = input.match(TIME_PATTERN)?.groups ?? {};
      const amountString = groups.amount ?? `${input}`;
      value = amountString.includes('.') ? parseFloat(amountString) : parseInt(amountString, 10);
      unit = (groups.unit || 'ms') as TimeUnit;
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
   * Returns time units convert to ms
   * @param amount Number of units to extend
   * @param unit Time unit to extend ('ms', 's', 'm', 'h', 'd', 'w', 'y')
   */
  static asMillis(amount: Date | number | string | TimeSpan, unit?: TimeUnit): number {
    return this.duration(amount, unit).total({ unit: 'milliseconds' });
  }

  /**
   * Returns a new date with `amount` units into the future
   * @param amount Number of units to extend
   * @param unit Time unit to extend ('ms', 's', 'm', 'h', 'd', 'w', 'y')
   */
  static fromNow(amount: number | TimeSpan, unit: TimeUnit = 'ms'): Date {
    return new Date(Temporal.Now.instant().add(this.duration(amount, unit)).epochMilliseconds);
  }

  /**
   * Returns a pretty timestamp
   * @param time Time in milliseconds
   */
  static asClock(time: number): string {
    const duration = this.duration(time, 'ms');
    const seconds = duration.total({ unit: 'seconds' }) % 60;
    const minutes = duration.total({ unit: 'minutes' }) % 60;
    const hours = duration.total({ unit: 'hours' });

    if (hours) {
      return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
    } else if (minutes) {
      return `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    } else {
      return `${seconds.toString().padStart(2, '0')}s`;
    }
  }
}