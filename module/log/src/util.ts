import { LogEvent, Formatter, Appender } from './types';

/**
 * Logging utilities
 */
export class LogUtil {

  /**
   * Produce an event listener
   */
  static buildListener(formatter: Formatter, appender: Appender, filter?: (ev: LogEvent) => boolean): (ev: LogEvent) => void {
    if (filter) {
      return (ev: LogEvent) => {
        if (filter(ev)) {
          appender.append(ev.level, formatter.format(ev));
        }
      };
    } else {
      return (ev: LogEvent) => appender.append(ev.level, formatter.format(ev));
    }
  }
}