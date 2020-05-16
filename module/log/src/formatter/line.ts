import * as util from 'util';

import { Env, StacktraceUtil } from '@travetto/base';
import { FsUtil, ColorUtil } from '@travetto/boot';

import { LogEvent, Formatter } from '../types';

/**
 * Level coloring
 */
export const STYLES = {
  info: ColorUtil.makeColorer('white'),
  error: ColorUtil.makeColorer('red'),
  debug: ColorUtil.makeColorer('yellow'),
  warn: ColorUtil.makeColorer('magenta'),
  fatal: ColorUtil.makeColorer('cyan', 'inverse'),
  trace: ColorUtil.makeColorer('white', 'faint'),
  timestamp: ColorUtil.makeColorer('white', 'bold'),
  location: ColorUtil.makeColorer('blue')
};

/**
 * Line formatting options
 */
export interface LineFormatterOpts {
  timestamp?: 'ms' | 's' | false;
  colorize?: boolean;
  align?: boolean;
  level?: boolean;
  location?: boolean;
}

/**
 * Line formatter
 */
export class LineFormatter implements Formatter {
  private opts: LineFormatterOpts;

  constructor(opts: LineFormatterOpts) {
    this.opts = { colorize: true, timestamp: 'ms', align: true, level: true, location: true, ...opts };
  }

  /**
   * Format an event into a single line
   */
  format(ev: LogEvent) {
    const opts = this.opts;
    let out = '';

    if (opts.timestamp) {
      let timestamp = new Date(ev.timestamp).toISOString();
      if (opts.timestamp === 's') {
        timestamp = timestamp.replace(/[.]\d{3}/, '');
      }
      if (opts.colorize) {
        timestamp = STYLES.timestamp(timestamp);
      }
      out = `${out}${timestamp} `;
    }

    if (opts.level) {
      let level: string = ev.level;
      if (opts.colorize) {
        level = STYLES[ev.level](ev.level);
      }
      if (opts.align) {
        level += ' '.repeat(5 - ev.level.length);
      }
      out = `${out}${level} `;
    }

    if (ev.file && opts.location) {
      const ns = ev.category;
      let loc = ev.line ? `${Env.prod ? ev.category : FsUtil.toTS(ev.file.replace(FsUtil.cwd, '.'))}:${ev.line}` : ns;
      if (opts.colorize) {
        loc = STYLES.location(loc);
      }
      out = `${out}[${loc}] `;
    }

    let message = ev.message;

    if (ev.args && ev.args.length) {
      const args = ev.args.slice(0);
      if (message) {
        args.unshift(message);
      }

      message = args.map((x: any) =>
        typeof x === 'string' ? x :
          (x instanceof Error ? (Env.prod ? x.stack : StacktraceUtil.simplifyStack(x)) :
            util.inspect(x,
              ev.level === 'trace',
              (ev.level === 'debug' || ev.level === 'trace') ? 4 : 2,
              opts.colorize !== false
            )
          )).join(' ');
    }

    if (message) {
      out = `${out}${message} `;
    }
    return out.substring(0, out.length - 1);
  }
}