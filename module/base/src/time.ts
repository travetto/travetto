import * as timers from 'timers/promises';

import { EnvUtil } from './env';

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

export type TimeSpan = `${number}${keyof typeof TIME_UNITS}`;
export type TimeUnit = keyof typeof TIME_UNITS;

export class TimeUtil {

  static #timePattern = new RegExp(`^(-?[0-9.]+)(${Object.keys(TIME_UNITS).join('|')})$`);

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
      [, amount, unit] = amount.match(this.#timePattern) as [undefined, '1m', 'm'] ?? [undefined, amount, unit];
      if (!TIME_UNITS[unit]) {
        return NaN;
      }
      amount = amount.includes('.') ? parseFloat(amount) : parseInt(amount, 10);
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
    const val = EnvUtil.get(key);
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
}