import { inspect, type InspectOptions } from 'node:util';

import { DataUtil } from '@travetto/schema';
import { safeAssign } from '@travetto/runtime';

import { LogEvent } from '../types.ts';

const INSPECT_OPTIONS = { colors: false, showHidden: false, depth: 5, breakLength: 200 };

export class LogFormatUtil {
  /** Generate log context */
  static getContext(event: LogEvent): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    for (const arg of event.args ?? []) {
      if (DataUtil.isPlainObject(arg)) {
        safeAssign(out, arg);
      }
    }
    return out && Object.keys(out).length > 0 ? out : undefined;
  }

  /** Get log message */
  static getLogMessage(event: LogEvent, options: InspectOptions = INSPECT_OPTIONS): string {
    const formatted = event.args?.map(x => typeof x === 'string' ? x : inspect(x, options)) ?? [];
    return (event.message ? [event.message, ...formatted] : formatted).join(' ');
  }
}