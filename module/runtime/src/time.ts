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
      const groups: { amount?: string, unit?: TimeUnit } = amount.match(this.#timePattern)?.groups ?? {};
      const amountStr = groups.amount ?? `${amount}`;
      unit = groups.unit ?? unit ?? 'ms';
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
  static fromValue(value: Date | number | string | undefined): number | undefined {
    if (value === undefined) {
      return value;
    }
    const val = (typeof value === 'string' && /\d{1,30}[a-z]$/i.test(value)) ?
      (this.isTimeSpan(value) ? this.asMillis(value) : undefined) :
      (typeof value === 'string' ? parseInt(value, 10) :
        (value instanceof Date ? value.getTime() : value));
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
   * Returns a pretty timestamp
   * @param time Time in milliseconds
   */
  static asClock(time: number): string {
    const s = Math.trunc(time / 1000);
    return [
      s > 3600 ? `${Math.trunc(s / 3600).toString().padStart(2, '0')}h` : '',
      s > 60 ? `${Math.trunc((s % 3600) / 60).toString().padStart(2, '0')}m` : '',
      `${(s % 60).toString().padStart(2, '0')}s`
    ].filter(x => !!x).slice(0, 2).join(' ');
  }
}