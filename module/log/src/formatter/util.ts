import { type InspectOptions, inspect } from 'node:util';

import { isPlainRecord, safeAssign, type UnknownRecord } from '@travetto/runtime';

import type { LogEvent } from '../types.ts';

const INSPECT_OPTIONS = { colors: false, showHidden: false, depth: 5, breakLength: 200 };

export class LogFormatUtil {
  /** Generate log context */
  static getContext(event: LogEvent): UnknownRecord | undefined {
    const out: UnknownRecord = {};
    for (const arg of event.args ?? []) {
      if (isPlainRecord(arg)) {
        safeAssign(out, arg);
      }
    }
    return out && Object.keys(out).length > 0 ? out : undefined;
  }

  /** Get log message */
  static getLogMessage(event: LogEvent, options: InspectOptions = INSPECT_OPTIONS): string {
    const formatted = event.args?.map(arg => (typeof arg === 'string' ? arg : inspect(arg, options))) ?? [];
    return (event.message ? [event.message, ...formatted] : formatted).join(' ');
  }
}
