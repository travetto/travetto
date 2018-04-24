import * as log4js from 'log4js';
import * as util from 'util';
import { AppEnv } from '@travetto/base';
import { LogContext, StandardLayout, JsonLayout } from '../types';

const STYLES: { [key: string]: [number, number] } = {
  // styles
  bold: [1, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  // grayscale
  white: [37, 39],
  grey: [90, 39],
  black: [90, 39],
  // colors
  blue: [34, 39],
  cyan: [36, 39],
  green: [32, 39],
  magenta: [35, 39],
  red: [31, 39],
  yellow: [33, 39]
};

const LOG_STYLES: { [key: string]: string[] } = {
  INFO: ['white'],
  ERROR: ['red'],
  DEBUG: ['grey'],
  WARN: ['magenta'],
  FATAL: ['cyan', 'inverse']
};

function processEvent(ev: log4js.LogEvent, opts: JsonLayout | StandardLayout) {
  const out: LogContext = {
    timestamp: new Date(ev.startTime).toISOString().split('.')[0],
    level: ev.level.toString().toUpperCase(),
    category: ev.categoryName.replace(/[\[\]]/g, ''),
  };

  const args = (ev.data || []).slice(0);
  const last = args[args.length - 1];

  if (last) {
    if (Object.keys(last).length === 1 && last.meta) {
      out.meta = args.pop().meta;
    } else if (last.stack) {
      args[args.length - 1] = last.stack;
    }
  }

  if (args.length) {
    if (opts.type === 'standard') {
      if (out.meta) {
        args.push(out.meta);
        delete out.meta;
      }
      out.message = args.map((x: any) => typeof x === 'string' ? x : util.inspect(x, AppEnv.dev, AppEnv.dev ? 4 : 2, opts.colorize)).join(' ');
    } else {
      out.message = util.format.apply(util, args);
    }
  }

  return out;
}

/**
 * Taken from masylum's fork (https://github.com/masylum/log4js-node)
 */
function stylize(text: string, ...styles: string[]) {
  for (const style of styles) {
    const res = STYLES[style];
    if (res) {
      text = `\x1B[${res[0]}m${text}\x1B[${res[1]}m`;
    }
  }
  return text;
}

export const Layouts: { [key: string]: (opts: any) => log4js.Layout } = {
  standard: (opts: StandardLayout): log4js.Layout => {
    return function (ev: log4js.LogEvent) {
      const ctx = processEvent(ev, opts);
      // Return string will be passed to logger.

      let out = '';
      if (opts.timestamp === undefined || !!opts.timestamp) {
        let timestamp = ctx.timestamp;
        if (opts.colorize) {
          timestamp = stylize(timestamp, 'white', 'bold');
        }
        out = `${out}${timestamp} `;
      }
      if (opts.level === undefined || !!opts.level) {
        let level = ctx.level;
        if (opts.colorize) {
          level = stylize(level, ...LOG_STYLES[level]);
        }
        if (opts.align) {
          level += ' '.repeat(8 - ctx.level.length);
        }
        out = `${out}${level} `;
      }
      if (ctx.category) {
        out = `${out}[${ctx.category}] `;
      }
      if (ctx.message) {
        out = `${out}${ctx.message} `;
      }
      return out.substring(0, out.length - 1);
    }
  },

  json: (opts: JsonLayout): log4js.Layout => {
    return function (ev: log4js.LogEvent) {
      return JSON.stringify(processEvent(ev, opts));
    };
  }
};