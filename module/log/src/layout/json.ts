import * as util from 'util';
import { LogEvent } from '../types';

export function jsonLayout(opts: {}) {
  return (ev: LogEvent) => {
    return JSON.stringify(ev);
  };
}