import timers from 'timers/promises';

import { Env } from './env';

const MIN = 1000 * 60;
const DAY = 24 * MIN * 60;
const TIME_UNITS = {
  y: DAY * 365,
  M: DAY * 30,
  w: DAY * 7,
  d: DAY,
  h: MIN * 60,
  m: MIN,
  s: 1000,
  ms: 1
};

const ORDER = ['ms', 's', 'm', 'h', 'd', 'w', 'M', 'y'] as const;

export type TimeSpan = `${number}${keyof typeof TIME_UNITS}`;
export type TimeUnit = keyof typeof TIME_UNITS;

export class TimeUtil {

  static #timePattern = new RegExp(`^(?<amount>-?[0-9.]+)(?<unit>${Object.keys(TIME_UNITS).join('|')})$`);

  /**
   * Test to see if a string is valid for relative time
   * @param val
   */
  static isTimeSpan(val: string): val is TimeSpan {
    return this.#timePattern.test(val);
  }

  /**
   * Returns time units convert to ms
   * @param amount Number of units to extend
   * @param unit Time unit to extend ('ms', 's', 'm', 'h', 'd', 'w', 'y')
   */
  static timeToMs(amount: number | TimeSpan, unit?: TimeUnit): number {
    if (typeof amount === 'string') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const { groups } = (amount.match(this.#timePattern) as { groups: { amount?: string, unit?: TimeUnit } });
      const amountStr = groups?.amount ?? `${amount}`;
      unit = groups?.unit ?? unit ?? 'ms';
      if (!TIME_UNITS[unit]) {
        return NaN;
      }
      amount = amountStr.includes('.') ? parseFloat(amountStr) : parseInt(amountStr, 10);
    }
    return amount * TIME_UNITS[unit ?? 'ms'];
  }

  /**
   * Returns a new date with `age` units into the future
   * @param age Number of units to extend
   * @param unit Time unit to extend ('ms', 's', 'm', 'h', 'd', 'w', 'y')
   */
  static timeFromNow(age: number | TimeSpan, unit?: TimeUnit): Date {
    return new Date(Date.now() + this.timeToMs(age, unit));
  }

  /**
   * Wait for n units of time
   */
  static wait(n: number | TimeSpan, unit?: TimeUnit): Promise<void> {
    return timers.setTimeout(this.timeToMs(n, unit));
  }

  /**
   * Get environment variable as time
   * @param key env key
   * @param def backup value if not valid or found
   */
  static getEnvTime(key: string, def?: number | TimeSpan): number {
    const val = Env.get(key);
    let ms: number | undefined;
    if (val) {
      if (this.isTimeSpan(val)) {
        ms = this.timeToMs(val);
      } else if (!Number.isNaN(+val)) {
        ms = +val;
      }
    }
    return ms ?? (def ? this.timeToMs(def) : NaN);
  }

  /**
   * Pretty print a delta, with auto-detection of largest unit
   */
  static prettyDelta(delta: number, unit?: TimeUnit): string {
    if (delta === 0) {
      return `0${unit ?? 'ms'}`;
    } else if (delta < 0) {
      return `-${this.prettyDelta(-delta, unit)}`;
    }

    let idx: number = 0;
    if (!unit) {
      let i = 0;
      while (delta > TIME_UNITS[ORDER[i]]) {
        i += 1;
      }
      idx = i - 1;
    } else {
      idx = ORDER.indexOf(unit);
    }
    const majorUnit = TIME_UNITS[ORDER[idx]];
    const minorUnit = TIME_UNITS[ORDER[idx - 1]];
    const value = delta / majorUnit;
    const major = Math.trunc(value);
    if (unit === undefined && value < 1.25 && idx > 0) {
      return this.prettyDelta(delta, ORDER[idx - 1]);
    }
    const sub = value - major;
    const out: (string | number)[] = [major, ORDER[idx]];
    if (idx > 0 && sub > .01) {
      const minor = Math.trunc(sub * (majorUnit / minorUnit));
      out.push(' ', minor, ORDER[idx - 1]);
    }
    return out.join('');
  }
}