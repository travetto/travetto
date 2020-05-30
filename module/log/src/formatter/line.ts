import * as util from 'util';

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
  fullCategory?: boolean;
}

/**
 * Line formatter
 */
export class LineFormatter implements Formatter {
  private opts: LineFormatterOpts;

  constructor(opts: LineFormatterOpts) {
    this.opts = {
      colorize: true, timestamp: 'ms', align: true, level: true, location: true,
      fullCategory: true,
      ...opts
    };
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
      let ns = ev.category;
      if (opts.fullCategory || !ev.file.includes('node_modules')) {
        ns = ev.file.replace(FsUtil.cwd, '.');
      }
      let loc = ev.line ? `${ns}:${ev.line}` : ns;
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
        (typeof x === 'string' || x instanceof Error) ? x :
          util.inspect(x,
            ev.level === 'debug',
            ev.level === 'debug' ? 4 : 2,
            opts.colorize !== false
          )
      ).join(' ');
    }

    if (message) {
      out = `${out}${message} `;
    }
    return out.substring(0, out.length - 1);
  }
}