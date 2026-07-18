import { Config } from '@travetto/config';
import { Injectable } from '@travetto/di';

import type { LogAppender, LogEvent } from '../types.ts';

@Config('log')
export class ConsoleLogAppenderConfig {
  logToLevel = true;
}

/**
 * Console Logging Appender
 */
@Injectable()
export class ConsoleLogAppender implements LogAppender {
  config: ConsoleLogAppenderConfig;

  constructor(config: ConsoleLogAppenderConfig) {
    this.config = config;
  }

  append(event: LogEvent, formatted: string): void {
    console![this.config.logToLevel ? event.level : 'log'](formatted);
  }
}
