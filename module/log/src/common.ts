import { Class, Env } from '@travetto/runtime';
import { Config, EnvVar } from '@travetto/config';
import { DependencyRegistryIndex, Inject, Injectable } from '@travetto/di';
import { Required } from '@travetto/schema';

import { ConsoleLogAppender } from './appender/console.ts';
import { FileLogAppender } from './appender/file.ts';
import { JsonLogFormatter } from './formatter/json.ts';
import { LineLogFormatter } from './formatter/line.ts';
import { LogAppender, LogFormatter, LogEvent, LogCommonSymbol, Logger } from './types.ts';

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

  @Inject(LogCommonSymbol)
  @Required(false)
  formatter: LogFormatter;

  @Inject(LogCommonSymbol)
  @Required(false)
  appender: LogAppender;

  async postConstruct(): Promise<void> {
    const formatterCls: Class = this.config.format === 'line' ? LineLogFormatter : JsonLogFormatter;
    const appenderCls: Class = this.config.output !== 'console' ? FileLogAppender : ConsoleLogAppender;
    this.formatter ??= await DependencyRegistryIndex.getInstance(formatterCls);
    this.appender ??= await DependencyRegistryIndex.getInstance(appenderCls);
  }

  log(ev: LogEvent): void {
    this.appender.append(ev, this.formatter.format(ev));
  }
}