import util from 'node:util';
import chalk from 'chalk';

import { ColorUtil, Env } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { Config, EnvVar } from '@travetto/config';
import { Ignore } from '@travetto/schema';

import { LogEvent, LogFormatter } from '../types';

/**
 * Level coloring
 */
export const STYLES = ColorUtil.palette({
  info: [chalk.hex('#ffff00'), chalk.hex('#ff5733')], // Yellow / goldenrod
  debug: [chalk.hex('#d3d3d3'), chalk.hex('#555555')], // Light gray / dark gray
  warn: [chalk.hex('#ff8c00'), chalk.magentaBright], // Dark orange / bright magenta
  error: [chalk.hex('#8b0000'), chalk.cyanBright.inverse], // Dark red / bright cyan inverted
  timestamp: [chalk.white, chalk.black],
  location: [chalk.hex('#add8e6'), chalk.hex('#800080')] // Light blue / purple
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
  @EnvVar(Env.TRV_LOG_PLAIN.key)
  plain?: boolean;

  @EnvVar(Env.TRV_LOG_TIME.key)
  time?: 's' | 'ms' | string;

  colorize?: boolean;
  align?: boolean;
  level?: boolean;
  location?: boolean;

  @Ignore()
  timestamp?: 's' | 'ms';

  postConstruct(): void {
    this.time ??= (!this.plain ? 'ms' : undefined);
    this.plain ??= chalk.level === 0;
    this.colorize ??= !this.plain;
    this.location ??= !this.plain;
    this.level ??= !this.plain;
    this.align ??= !this.plain;
    if (this.time !== undefined && this.time === 'ms' || this.time === 's') {
      this.timestamp = this.time;
    }
    Object.assign(util.inspect.defaultOptions, {
      breakLength: Math.max(util.inspect.defaultOptions.breakLength ?? 0, 100),
      depth: Math.max(util.inspect.defaultOptions.depth ?? 0, 4)
    });
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
      colors: this.opts.colorize !== false,
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
        timestamp = STYLES('timestamp', timestamp);
      }
      out.push(timestamp);
    }

    if (this.opts.level) {
      let level: string = ev.level;
      if (this.opts.align) {
        level = level.padEnd(5, ' ');
      }
      if (this.opts.colorize) {
        level = STYLES(ev.level, level);
      }
      out.push(level);
    }

    if (ev.source && this.opts.location) {
      const ns = `${ev.module}:${ev.modulePath}`;
      let loc = ev.line ? `${ns}:${ev.line}` : ns;
      if (this.opts.colorize) {
        loc = STYLES('location', loc);
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