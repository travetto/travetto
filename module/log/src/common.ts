import { Config, EnvVar } from '@travetto/config';
import { Inject, Injectable } from '@travetto/di';

import { ConsoleAppender } from './appender/console';
import { FileAppender } from './appender/file';
import { JsonFormatter } from './formatter/json';
import { LineFormatter } from './formatter/line';
import { Appender, Formatter, LogEvent } from './types';

@Config('log')
export class CommonLoggerConfig {
  /** Should we enrich the console by default */
  @EnvVar('TRV_LOG_FORMAT')
  format: 'line' | 'json' = 'line';

  /** Log file, if needed */
  @EnvVar('TRV_LOG_FILE')
  file?: string;

  @EnvVar('TRV_LOG_PLAIN')
  plain?: boolean;

  @EnvVar('TRV_LOG_TIME')
  timestamp: 's' | 'ms' | false = 'ms';
}

@Injectable()
export class CommonLogger {
  #appender: Appender;
  #formatter: Formatter;

  @Inject()
  config: CommonLoggerConfig;

  postConstruct() {
    this.#formatter = this.config.format === 'line' ?
      new LineFormatter(this.config) :
      new JsonFormatter();
    this.#appender = this.config.file ?
      new FileAppender({ file: this.config.file }) :
      new ConsoleAppender();
  }

  onLog(ev: LogEvent) {
    this.#appender.append(ev.level, this.#formatter.format(ev));
  }
}