import { LogEvent } from '../types';

export interface JSONFormatterOpts { }

export function jsonFormatter(opts: JSONFormatterOpts) {
  return (ev: LogEvent) => JSON.stringify(ev);
}