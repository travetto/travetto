import util from 'util';

import { GlobalTerminal } from '@travetto/terminal';
import { Injectable } from '@travetto/di';
import { Config, EnvVar } from '@travetto/config';
import { GlobalEnv } from '@travetto/base';
import { Ignore } from '@travetto/schema';

import { LogEvent, LogFormatter } from '../types';

/**
 * Level coloring
 */
export const STYLES = GlobalTerminal.palette({
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

@Config('log')
export class LineLogFormatterConfig {
  @EnvVar('TRV_LOG_PLAIN')
  plain?: boolean;

  @EnvVar('TRV_LOG_TIME')
  time?: 's' | 'ms' | string;

  colorize?: boolean;
  align?: boolean;
  level?: boolean;
  location?: boolean;

  @Ignore()
  timestamp?: 's' | 'ms';

  postConstruct(): void {
    if (GlobalEnv.test) {
      this.plain = true;
      this.time = undefined;
    }
    this.time ??= (!this.plain ? 'ms' : undefined);
    this.plain ??= GlobalTerminal.colorLevel === 0;
    this.colorize ??= !this.plain;
    this.location ??= !this.plain;
    this.level ??= !this.plain;
    this.align ??= !this.plain;
    if (this.time !== undefined && this.time === 'ms' || this.time === 's') {
      this.timestamp = this.time;
    }
  }
}

/**
 * Line Logging Formatter
 */
@Injectable()
export class LineLogFormatter implements LogFormatter {

  opts: LineLogFormatterConfig;

  constructor(opts: LineLogFormatterConfig) {
    this.opts = opts;
  }

  pretty(ev: LogEvent, o: unknown): string {
    return util.inspect(o, {
      showHidden: ev.level === 'debug',
      depth: 4,
      colors: this.opts.colorize !== false,
      breakLength: 100
    });
  }

  /**
   * Format an event into a single line
   */
  format(ev: LogEvent): string {
    const out = [];

    if (this.opts.timestamp) {
      let timestamp = ev.timestamp.toISOString();
      if (this.opts.timestamp === 's') {
        timestamp = timestamp.replace(/[.]\d{3}/, '');
      }
      if (this.opts.colorize) {
        timestamp = STYLES.timestamp(timestamp);
      }
      out.push(timestamp);
    }

    if (this.opts.level) {
      let level: string = ev.level;
      if (this.opts.align) {
        level = level.padEnd(5, ' ');
      }
      if (this.opts.colorize) {
        level = STYLES[ev.level](level);
      }
      out.push(level);
    }

    if (ev.source && this.opts.location) {
      const ns = `${ev.module}:${ev.modulePath}`;
      let loc = ev.line ? `${ns}:${ev.line}` : ns;
      if (this.opts.colorize) {
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