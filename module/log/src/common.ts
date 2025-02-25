import { Env } from '@travetto/runtime';
import { Config, EnvVar } from '@travetto/config';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';

import { ConsoleLogAppender } from './appender/console';
import { FileLogAppender } from './appender/file';
import { JsonLogFormatter } from './formatter/json';
import { LineLogFormatter } from './formatter/line';
import { LogAppender, LogFormatter, LogEvent, LogCommonSymbol, Logger } from './types';

@Config('log')
export class CommonLoggerConfig {
  @EnvVar(Env.TRV_LOG_FORMAT.key)
  format: 'line' | 'json' = 'line';

  @EnvVar(Env.TRV_LOG_OUTPUT.key)
  output: 'console' | 'file' | string = 'console';
}

@Injectable()
export class CommonLogger implements Logger {

  @Inject()
  config: CommonLoggerConfig;

  @Inject(LogCommonSymbol, { optional: true })
  formatter: LogFormatter;

  @Inject(LogCommonSymbol, { optional: true })
  appender: LogAppender;

  async postConstruct(): Promise<void> {
    this.formatter ??= await DependencyRegistry.getInstance(this.config.format === 'line' ? LineLogFormatter : JsonLogFormatter);
    this.appender ??= await DependencyRegistry.getInstance(this.config.output !== 'console' ? FileLogAppender : ConsoleLogAppender);
  }

  log(ev: LogEvent): void {
    this.appender.append(ev, this.formatter.format(ev));
  }
}