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
  #opts: JSONFormatterOpts;

  constructor(opts: JSONFormatterOpts = {}) {
    this.#opts = opts;
  }

  format(ev: LogEvent): string {
    return JSON.stringify(ev, null, this.#opts.depth);
  }
}