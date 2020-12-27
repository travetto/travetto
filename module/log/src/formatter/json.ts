import { LogEvent, Formatter } from '../types';

/**
 * JSON Options
 */
export interface JSONFormatterOpts {
  depth?: number;
}

/**
 * JSON Formatter
 */
export class JsonFormatter implements Formatter {
  constructor(private opts: JSONFormatterOpts = {}) { }

  format(ev: LogEvent) {
    return JSON.stringify(ev, null, this.opts.depth);
  }
}