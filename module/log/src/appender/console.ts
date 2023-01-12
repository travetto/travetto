import { Appender, LogEvent } from '../types';

/**
 * Console.output
 */
export class ConsoleAppender implements Appender {
  append(ev: LogEvent, formatted: string): void {
    console![ev.level](formatted);
  }
}
