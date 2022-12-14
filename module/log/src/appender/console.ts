import { LogLevel } from '@travetto/base';
import { Appender } from '../types';

/**
 * Console.output
 */
export class ConsoleAppender implements Appender {
  append(level: LogLevel, message: string): void {
    console![level](message);
  }
}
