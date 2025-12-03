import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { LogEvent, LogFormatter } from '../types.ts';
import { LogFormatUtil } from './util.ts';

@Config('log')
export class JSONLogFormatterConfig {
  jsonIndent?: number;
}

/**
 * JSON Logging Formatter
 */
@Injectable()
export class JsonLogFormatter implements LogFormatter {
  config: JSONLogFormatterConfig;

  constructor(config: JSONLogFormatterConfig) {
    this.config = config;
  }

  format(event: LogEvent): string {
    const { message: _m, args: _a, ...rest } = event;
    const message = LogFormatUtil.getLogMessage(event);
    const context = LogFormatUtil.getContext(event);
    return JSON.stringify({
      ...rest,
      ...(message ? { message } : {}),
      ...(context ? { context } : {}),
    }, null, this.config.jsonIndent);
  }
}