import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { LogEvent, LogFormatter } from '../types';
import { LogFormatUtil } from './util';

@Config('log')
export class JSONLogFormatterConfig {
  jsonIndent?: number;
}

/**
 * JSON Logging Formatter
 */
@Injectable()
export class JsonLogFormatter implements LogFormatter {
  opts: JSONLogFormatterConfig;

  constructor(opts: JSONLogFormatterConfig) {
    this.opts = opts;
  }

  format(ev: LogEvent): string {
    const { message: _m, args: _a, ...rest } = ev;
    const message = LogFormatUtil.getLogMessage(ev);
    const context = LogFormatUtil.getContext(ev);
    return JSON.stringify({
      ...rest,
      ...(message ? { message } : {}),
      ...(context ? { context } : {}),
    }, null, this.opts.jsonIndent);
  }
}