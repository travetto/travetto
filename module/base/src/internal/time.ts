import { EnvUtil } from '@travetto/boot';

const MIN = 1000 * 60;
const DAY = 24 * MIN * 60;
const TIME_UNITS = {
  y: DAY * 365,
  w: DAY * 7,
  d: DAY,
  h: MIN * 60,
  m: MIN,
  s: 1000,
  ms: 1
};

const timeUnitRegex = new RegExp(`(${Object.keys(TIME_UNITS).join('|')})$`, 'i');
export type RelativeTime = `${number}${keyof typeof TIME_UNITS}`;

export type TimeUnit = keyof typeof TIME_UNITS;

/**
 * Time utilities
 */
export class TimeUtil {

  /**
   * Returns time units convert to ms
   * @param amount Number of units to extend
   * @param unit Time unit to extend ('ms', 's', 'm', 'h', 'd', 'w', 'y')
   */
  static toMillis(amount: number, unit?: TimeUnit): number;
  static toMillis(amount: RelativeTime): number;
  static toMillis(amount: number | RelativeTime, unit: TimeUnit = 'ms') {
    if (typeof amount === 'string') {
      if (timeUnitRegex.test(amount)) { // If unit provided
        [, amount, unit] = amount.match(/^(-?[0-9.]+)(.*)$/i) as [undefined, '1m', 'm'] ?? [undefined, amount, unit];
        unit = unit.toLowerCase() as 'm';
        if (!TIME_UNITS[unit]) {
          return NaN;
        }
      }
      amount = parseFloat(amount as string);
    }
    return amount * TIME_UNITS[unit];
  }

  /**
   * Returns a new date with `age` units into the future
   * @param age Number of units to extend
   * @param unit Time unit to extend ('ms', 's', 'm', 'h', 'd', 'w', 'y')
   */
  static withAge(age: number, unit: TimeUnit): Date;
  static withAge(age: RelativeTime): Date
  static withAge(age: number | RelativeTime, unit: TimeUnit = 'ms') {
    return new Date(Date.now() + this.toMillis(age as number, unit));
  }

  /**
   * Get time as milliseconds
   * @param k The environment key to search for
   * @param deTime The default time if the key isn't found
   * @param unit The unit for the default time, ms is default if not specified
   */
  static getEnv(k: string, defTime: number, unit: TimeUnit = 'ms'): number {
    return this.toMillis(EnvUtil.get(k, '') as unknown as number || defTime, unit);
  }

  /**
   * Wait for n units of time
   */
  static wait(n: number, unit: TimeUnit = 'ms') {
    return new Promise(res => setTimeout(res, this.toMillis(n, unit)));
  }
}