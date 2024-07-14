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
  static asMillis(amount: Date | number | TimeSpan, unit?: TimeUnit): number {
    if (amount instanceof Date) {
      return amount.getTime();
    } else if (typeof amount === 'string') {
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
   * Returns the time converted to seconds
   * @param date The date to convert
   */
  static asSeconds(date: Date | number | TimeSpan, unit?: TimeUnit): number {
    return Math.trunc(this.asMillis(date, unit) / 1000);
  }

  /**
   * Returns the time converted to a Date
   * @param date The date to convert
   */
  static asDate(date: Date | number | TimeSpan, unit?: TimeUnit): Date {
    return new Date(this.asMillis(date, unit));
  }

  /**
   * Resolve time or span to possible time
   */
  static coerceValue(value: number | string | undefined): number | undefined {
    if (value === undefined) {
      return value;
    }
    const val = (typeof value === 'string' && /\d+[a-z]+$/i.test(value)) ?
      (this.isTimeSpan(value) ? this.asMillis(value) : undefined) :
      (typeof value === 'string' ? parseInt(value, 10) : value);
    return Number.isNaN(val) ? undefined : val;
  }

  /**
   * Returns a new date with `amount` units into the future
   * @param amount Number of units to extend
   * @param unit Time unit to extend ('ms', 's', 'm', 'h', 'd', 'w', 'y')
   */
  static fromNow(amount: number | TimeSpan, unit: TimeUnit = 'ms'): Date {
    return new Date(Date.now() + this.asMillis(amount, unit));
  }

  /**
   * Pretty print a delta between now and `time`, with auto-detection of largest unit
   */
  static prettyDeltaSince(time: number, unit?: TimeUnit): string {
    return this.prettyDelta(Date.now() - time, unit);
  }

  /**
   * Pretty print a delta, with auto-detection of largest unit
   * @param delta The number of milliseconds in the delta
   */
  static prettyDelta(delta: number, unit?: TimeUnit): string {
    if (delta === 0) {
      return `0${unit}`;
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

  /**
   * Determine the number of units between two dates
   */
  static unitsBetween(startDate: Date | number, endDate: Date | number, unit: TimeUnit): number {
    const delta =
      (typeof endDate === 'number' ? endDate : endDate.getTime()) -
      (typeof startDate === 'number' ? startDate : startDate.getTime());
    return delta / TIME_UNITS[unit];
  }
}