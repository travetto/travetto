import { inspect, type InspectOptions } from 'node:util';
import { ObjectUtil } from '@travetto/base';
import { LogEvent } from '../types';

export class LogFormatUtil {
  static #inspectOptions = { colors: false, showHidden: false, depth: 5, breakLength: 200 };

  /** Generate log context */
  static getContext(ev: LogEvent): Record<string, unknown> | undefined {
    const out: Record<string, unknown> = {};
    for (const o of ev.args ?? []) {
      if (ObjectUtil.isPlainObject(o)) {
        Object.assign(out, o);
      }
    }
    return out && Object.keys(out).length > 0 ? out : undefined;
  }

  /** Get log message */
  static getLogMessage(ev: LogEvent, options: InspectOptions = this.#inspectOptions): string {
    const formatted = ev.args?.map(x => inspect(x, options)) ?? [];
    return (ev.message ? [ev.message, ...formatted] : formatted).join(' ');
  }
}