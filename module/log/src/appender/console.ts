import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { LogAppender, LogEvent } from '../types';

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

  append(ev: LogEvent, formatted: string): void {
    console![this.config.logToLevel ? ev.level : 'log'](formatted);
  }
}
