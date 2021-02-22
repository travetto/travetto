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

export type TimeUnit = keyof typeof TIME_UNITS;

/**
 * Time utilities
 */
export class TimeUtil {

  /**
   * Returns a new date with `age` units into the future
   * @param age Number of units to extend
   * @param unit Time unit to extend ('ms', 's', 'm', 'h', 'd', 'w', 'y')
   */
  static withAge(age: number, unit: TimeUnit = 'ms') {
    return new Date(Date.now() + age * TIME_UNITS[unit]);
  }

  /**
   * Get time as milliseconds
   * @param k The environment key to search for
   * @param deTime The default time if the key isn't found
   * @param unit The unit for the default time, ms is default if not specified
   */
  static getEnv(k: string, defTime: number, unit: TimeUnit = 'ms'): number {
    let val: string | number = defTime;
    const match = EnvUtil.get(k, '').match(/^(\d+)([hms]?)$/);

    if (match) {
      val = match[1];
      if (match.length > 2 && match[2]) {
        unit = match[2] as TimeUnit;
      }
    }

    return parseInt(`${val}`, 10) * TIME_UNITS[unit];
  }
}