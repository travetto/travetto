import * as util from 'util';
import { LogEvent } from '../types';

export interface JSONFormatterOpts { }

export function jsonFormatter(opts: JSONFormatterOpts) {
  return (ev: LogEvent) => {
    return JSON.stringify(ev);
  };
}