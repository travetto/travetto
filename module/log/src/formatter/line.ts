import * as util from 'util';

import { ColorUtil, EnvUtil } from '@travetto/boot';

import { LogEvent, Formatter } from '../types';

/**
 * Level coloring
 */
export const STYLES = {
  info: ColorUtil.makeColorer('white'),
  debug: ColorUtil.makeColorer('yellow'),
  warn: ColorUtil.makeColorer('magenta'),
  error: ColorUtil.makeColorer('cyan', 'inverse'),
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
  #opts: LineFormatterOpts;

  constructor(opts: LineFormatterOpts = {}) {
    const notPlain = !EnvUtil.isTrue('TRV_LOG_PLAIN');
    this.#opts = {
      colorize: notPlain && ColorUtil.colorize,
      timestamp: notPlain ? EnvUtil.isValueOrFalse('TRV_LOG_TIME', ['s', 'ms'] as const, 'ms') : undefined,
      align: true, level: notPlain, location: notPlain,
      ...opts
    };
  }

  pretty(ev: LogEvent, o: unknown) {
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
  format(ev: LogEvent) {
    const opts = this.#opts;
    const out = [];

    if (opts.timestamp) {
      let timestamp = ev.timestamp;
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
      if (opts.colorize) {
        level = STYLES[ev.level](ev.level);
      }
      if (opts.align) {
        level += ' '.repeat(5 - ev.level.length);
      }
      out.push(level);
    }

    if (ev.file && opts.location) {
      const ns = ev.category;
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