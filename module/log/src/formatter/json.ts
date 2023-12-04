import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { LogEvent, LogFormatter } from '../types';

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
    return JSON.stringify(ev, null, this.opts.jsonIndent);
  }
}