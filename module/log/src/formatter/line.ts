import util from 'node:util';

import { Env } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { Config, EnvVar } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { StyleUtil } from '@travetto/terminal';

import { LogEvent, LogFormatter } from '../types';
import { LogFormatUtil } from './util';

/**
 * Level coloring
 */
export const STYLES = StyleUtil.getPalette({
  info: ['#ffff00', '#ff5733'], // Yellow / goldenrod
  debug: ['#d3d3d3', '#555555'], // Light gray / dark gray
  warn: ['#ff8c00', '#ff00ff'], // Dark orange / bright magenta
  error: ['#8b0000', { text: '#00ffff', inverse: true }], // Dark red / bright cyan inverted
  timestamp: ['#e5e5e5', '#000000'], // White /black
  location: ['#add8e6', '#800080'] // Light blue / purple
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

  @Ignore()
  inspectOptions: {
    breakLength: number;
    depth: number;
    colors: boolean;
  };

  postConstruct(): void {
    this.time ??= (!this.plain ? 'ms' : undefined);
    this.plain ??= !StyleUtil.enabled;
    this.colorize ??= !this.plain;
    this.location ??= !this.plain;
    this.level ??= !this.plain;
    this.align ??= !this.plain;
    if (this.time !== undefined && this.time === 'ms' || this.time === 's') {
      this.timestamp = this.time;
    }
    this.inspectOptions = {
      colors: this.colorize !== false,
      breakLength: Math.max(util.inspect.defaultOptions.breakLength ?? 0, 100),
      depth: Math.max(util.inspect.defaultOptions.depth ?? 0, 5)
    };
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

    if (ev.modulePath && this.opts.location) {
      const ns = `${ev.module}:${ev.modulePath}`;
      let loc = ev.line ? `${ns}:${ev.line}` : ns;
      if (this.opts.colorize) {
        loc = STYLES.location(loc);
      }
      out.push(`[${loc}]`);
    }

    out.push(LogFormatUtil.getLogMessage(ev, this.opts.inspectOptions));

    return out.join(' ');
  }
}