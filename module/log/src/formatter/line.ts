import * as util from 'util';
import { LogEvent } from '../types';
import { stylize, LEVEL_STYLES } from './styles';

export interface LineFormatterOpts {
  timestamp?: boolean;
  colorize?: boolean;
  align?: boolean;
  level?: boolean;
  simple?: boolean;
}

export function lineFormatter(opts: LineFormatterOpts) {
  return (ev: LogEvent) => {
    let out = '';

    if (opts.timestamp !== false) {
      let timestamp = new Date(ev.timestamp).toISOString().split('.')[0];
      if (opts.colorize !== false) {
        timestamp = stylize(timestamp, 'white', 'bold');
      }
      out = `${out}${timestamp} `;
    }

    if (opts.level !== false) {
      let level: string = ev.level;
      if (opts.colorize !== false) {
        level = stylize(level, ...LEVEL_STYLES[level]);
      }
      if (opts.align) {
        level += ' '.repeat(8 - ev.level.length);
      }
      out = `${out}${level} `;
    }

    if (!ev.category && ev.file) {
      ev.category = ev.line ? `${ev.file}:${ev.line}` : ev.file;
    }

    if (ev.category) {
      out = `${out}[${ev.category}] `;
    }

    let message;

    if (ev.args && ev.args.length) {
      const args = ev.args.slice(0);
      if (opts.simple) {
        if (ev.meta) {
          args.push(ev.meta);
        }
        if (ev.message) {
          args.unshift(ev.message);
        }
        message = args.map((x: any) => typeof x === 'string' ? x :
          util.inspect(x, ev.level === 'debug', ev.level === 'debug' ? 4 : 2, opts.colorize !== false)).join(' ');
      } else {
        message = util.format.apply(util, args);
      }
    }

    if (ev.message) {
      out = `${out}${message} `;
    }
    return out.substring(0, out.length - 1);
  }
};