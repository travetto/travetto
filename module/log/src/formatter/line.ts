import util from 'util';

import { ColorOutputUtil } from '@travetto/terminal';

import { LogEvent, Formatter } from '../types';

/**
 * Level coloring
 */
export const STYLES = ColorOutputUtil.palette({
  info: ['yellow', 'goldenrod'],
  debug: ['lightGray', '#555555'],
  warn: ['darkOrange', 'brightMagenta'],
  error: ['darkRed', { text: 'brightCyan', inverse: true }],
  timestamp: ['white', 'black'],
  location: ['lightBlue', 'purple']
});

/**
 * Line formatting options
 */
export interface LineFormatterOpts {
  plain?: boolean;
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
  #opts: LineFormatterOpts;

  constructor(opts: LineFormatterOpts = {}) {
    const notPlain = opts.plain !== true;
    this.#opts = {
      colorize: notPlain,
      timestamp: notPlain ? opts.timestamp : undefined,
      align: true, level: notPlain, location: notPlain,
      ...opts
    };
  }

  pretty(ev: LogEvent, o: unknown): string {
    return util.inspect(o, {
      showHidden: ev.level === 'debug',
      depth: 4,
      colors: this.#opts.colorize !== false,
      breakLength: 100
    });
  }

  /**
   * Format an event into a single line
   */
  format(ev: LogEvent): string {
    const opts = this.#opts;
    const out = [];

    if (opts.timestamp) {
      let timestamp = ev.timestamp.toISOString();
      if (opts.timestamp === 's') {
        timestamp = timestamp.replace(/[.]\d{3}/, '');
      }
      if (opts.colorize) {
        timestamp = STYLES.timestamp(timestamp);
      }
      out.push(timestamp);
    }

    if (opts.level) {
      let level: string = ev.level;
      if (opts.align) {
        level = level.padEnd(5, ' ');
      }
      if (opts.colorize) {
        level = STYLES[ev.level](level);
      }
      out.push(level);
    }

    if (ev.source && opts.location) {
      const ns = `${ev.module}:${ev.modulePath}`;
      let loc = ev.line ? `${ns}:${ev.line}` : ns;
      if (opts.colorize) {
        loc = STYLES.location(loc);
      }
      out.push(`[${loc}]`);
    }

    if (ev.message) {
      out.push(ev.message);
    }

    if (ev.context && Object.keys(ev.context).length) {
      out.push(this.pretty(ev, ev.context));
    }

    if (ev.args && ev.args.length) {
      out.push(...ev.args.map(a => this.pretty(ev, a)));
    }

    return out.join(' ');
  }
}