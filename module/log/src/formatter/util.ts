import { inspect, type InspectOptions } from 'node:util';
import { DataUtil } from '@travetto/schema';
import { LogEvent } from '../types.ts';

const INSPECT_OPTIONS = { colors: false, showHidden: false, depth: 5, breakLength: 200 };

export class LogFormatUtil {
  /** Generate log context */
  static getContext(ev: LogEvent): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    for (const o of ev.args ?? []) {
      if (DataUtil.isPlainObject(o)) {
        Object.assign(out, o);
      }
    }
    return out && Object.keys(out).length > 0 ? out : undefined;
  }

  /** Get log message */
  static getLogMessage(ev: LogEvent, options: InspectOptions = INSPECT_OPTIONS): string {
    const formatted = ev.args?.map(x => typeof x === 'string' ? x : inspect(x, options)) ?? [];
    return (ev.message ? [ev.message, ...formatted] : formatted).join(' ');
  }
}