import { GlobalEnv } from '@travetto/base';
import { Config, EnvVar } from '@travetto/config';
import { Inject, Injectable } from '@travetto/di';
import { Ignore } from '@travetto/schema';
import { GlobalTerminal } from '@travetto/terminal';

import { ConsoleAppender } from './appender/console';
import { FileAppender } from './appender/file';
import { JsonFormatter } from './formatter/json';
import { LineFormatter } from './formatter/line';
import { Appender, Formatter, LogEvent } from './types';

@Config('log')
export class CommonLoggerConfig {
  @EnvVar('TRV_LOG_COMMON')
  commonActive?: boolean;

  /** Should we enrich the console by default */
  @EnvVar('TRV_LOG_FORMAT')
  format: 'line' | 'json' = 'line';

  /** Log file, if needed */
  @EnvVar('TRV_LOG_FILE')
  file?: string;

  @EnvVar('TRV_LOG_PLAIN')
  plain?: boolean;

  @EnvVar('TRV_LOG_TIME')
  time: 's' | 'ms' | string = 'ms';

  @Ignore()
  get timestamp(): 's' | 'ms' | false {
    return (this.time ?? 'ms') === 'ms' ? 'ms' : (this.time === 's' ? 's' : false);
  }

  postConstruct(): void {
    if (GlobalEnv.test) {
      this.time = '';
    }
    this.plain ??= GlobalTerminal.colorLevel === 0;
  }
}

@Injectable()
export class CommonLogger {
  #appender: Appender;
  #formatter: Formatter;

  @Inject()
  config: CommonLoggerConfig;

  get active(): boolean {
    return this.config.commonActive !== false;
  }

  postConstruct(): void {
    this.#formatter = this.config.format === 'line' ?
      new LineFormatter(this.config) :
      new JsonFormatter();
    this.#appender = this.config.file ?
      new FileAppender({ file: this.config.file }) :
      new ConsoleAppender();
  }

  onLog(ev: LogEvent): void {
    this.#appender.append(ev, this.#formatter.format(ev));
  }
}