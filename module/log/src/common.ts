import { Config, EnvVar } from '@travetto/config';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';

import { ConsoleLogAppender } from './appender/console';
import { FileLogAppender } from './appender/file';
import { JsonLogFormatter } from './formatter/json';
import { LineLogFormatter } from './formatter/line';
import { LogAppender, LogFormatter, LogEvent, LogCommonⲐ, Logger } from './types';

@Config('log')
export class CommonLoggerConfig {
  @EnvVar('TRV_LOG_FORMAT')
  format: 'line' | 'json' = 'line';

  @EnvVar('TRV_LOG_OUTPUT')
  output: 'console' | 'file' | string = 'console';
}

@Injectable()
export class CommonLogger implements Logger {

  @Inject()
  config: CommonLoggerConfig;

  @Inject(LogCommonⲐ, { optional: true })
  formatter: LogFormatter;

  @Inject(LogCommonⲐ, { optional: true })
  appender: LogAppender;

  async postConstruct(): Promise<void> {
    this.formatter ??= await DependencyRegistry.getInstance(this.config.format === 'line' ? LineLogFormatter : JsonLogFormatter);
    this.appender ??= await DependencyRegistry.getInstance(this.config.output !== 'console' ? FileLogAppender : ConsoleLogAppender);
  }

  onLog(ev: LogEvent): void {
    this.appender.append(ev, this.formatter.format(ev));
  }
}