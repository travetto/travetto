import util from 'node:util';

import { Env, RuntimeIndex } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { Config, EnvVar } from '@travetto/config';
import { Ignore } from '@travetto/schema';
import { StyleUtil, type TermStyleFn } from '@travetto/terminal';

import type { LogEvent, LogFormatter } from '../types.ts';
import { LogFormatUtil } from './util.ts';

const styleInput = {
  info: ['#ffff00', '#ff5733'], // Yellow / goldenrod
  debug: ['#d3d3d3', '#555555'], // Light gray / dark gray
  warn: ['#ff8c00', '#ff00ff'], // Dark orange / bright magenta
  error: ['#8b0000', { text: '#00ffff', inverse: true }], // Dark red / bright cyan inverted
  timestamp: ['#e5e5e5', '#000000'], // White /black
  location: ['#add8e6', '#800080'] // Light blue / purple
} as const;

/**
 * Level coloring
 */
export const STYLES: Record<keyof typeof styleInput, TermStyleFn> = StyleUtil.getPalette(styleInput);

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

  links?: boolean;
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
    this.links ??= !this.plain;
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

  config: LineLogFormatterConfig;

  constructor(config: LineLogFormatterConfig) {
    this.config = config;
  }

  /**
   * Format an event into a single line
   */
  format(event: LogEvent): string {
    const out = [];

    if (this.config.timestamp) {
      let timestamp = event.timestamp.toISOString();
      if (this.config.timestamp === 's') {
        timestamp = timestamp.replace(/[.]\d{3}/, '');
      }
      if (this.config.colorize) {
        timestamp = STYLES.timestamp(timestamp);
      }
      out.push(timestamp);
    }

    if (this.config.level) {
      let level: string = event.level;
      if (this.config.align) {
        level = level.padEnd(5, ' ');
      }
      if (this.config.colorize) {
        level = STYLES[event.level](level);
      }
      out.push(level);
    }

    if (event.modulePath && this.config.location) {
      const namespace = `${event.module}:${event.modulePath}`;
      let location = event.line ? `${namespace}:${event.line}` : namespace;
      if (this.config.colorize) {
        location = STYLES.location(location);
      }
      if (this.config.links) {
        location = StyleUtil.link(location, `file://${RuntimeIndex.getModule(event.module)?.sourcePath}/${event.modulePath}${event.line ? `#${event.line}` : ''}`);
      }
      out.push(`[${location}]`);
    }

    out.push(LogFormatUtil.getLogMessage(event, this.config.inspectOptions));

    return out.join(' ');
  }
}