import { LogEvent } from '../types';


export interface JSONFormatterOpts { }

// TODO: Document
export class JsonFormatter {
  constructor(private opts: JSONFormatterOpts) { }

  format(ev: LogEvent) {
    return JSON.stringify(ev);
  }
}