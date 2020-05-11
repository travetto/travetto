import { LogEvent, Formatter } from '../types';


/**
 * JSON Options
 */
export interface JSONFormatterOpts { }

/**
 * JSON Formatter
 */
export class JsonFormatter implements Formatter {
  constructor(private opts: JSONFormatterOpts) { }

  format(ev: LogEvent) {
    return JSON.stringify(ev);
  }
}