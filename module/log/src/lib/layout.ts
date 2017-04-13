import * as log4js from 'log4js';

import { LogContext, StandardLayout, JsonLayout } from './types';

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


function processEvent(ev: log4js.LogEvent) {
  let out: LogContext = {
    timestamp: new Date(ev.startTime).toISOString().split('.')[0],
    level: ev.level.toString().toUpperCase(),
    category: ev.categoryName.replace(/[\[\]]/g, ''),
  };

  let args = (ev.data || []).slice(0);

  if (args && typeof args[0] === 'string') {
    out.message = args.shift();
  }

  if (args && args.length) {
    out.meta = args.length === 1 ? args[0] : args;
  }

  return out;
}

/**
 * Taken from masylum's fork (https://github.com/masylum/log4js-node)
 */
function stylize(text: string, ...styles: string[]) {
  for (let style of styles) {
    let res = STYLES[style];
    if (res) {
      text = `\x1B[${res[0]}m${text}\x1B[${res[1]}m`;
    }
  }
  return text;
}

export const Layouts: { [key: string]: (opts: any) => log4js.Layout } = {
  standard: (opts: StandardLayout): log4js.Layout => {
    return function (ev: log4js.LogEvent) {
      let ctx = processEvent(ev);
      // Return string will be passed to logger.

      if (ctx.meta) {
        if (ctx.meta.stack) {
          ctx.meta = ctx.meta.stack;
        } else if (Object.keys(ctx.meta).length) {
          ctx.meta = JSON.stringify(ctx.meta, undefined, opts['prettyPrint'] ? 2 : undefined);
        }
      }

      let out = '';
      if (opts.timestamp === undefined || !!opts.timestamp) {
        let timestamp = ctx.timestamp;
        if (opts.colorize) {
          timestamp = stylize(timestamp, 'white', 'bold');
        }
        out += timestamp + ' ';
      }
      if (opts.level === undefined || !!opts.level) {
        let level = ctx.level;
        if (opts.colorize) {
          level = stylize(level, ...LOG_STYLES[level]);
        }
        if (opts.align) {
          level += ' '.repeat(8 - ctx.level.length);
        }
        out += level + ' ';
      }
      if (ctx.category) {
        out += '[' + ctx.category + '] ';
      }
      if (ctx.message) {
        out += ctx.message + ' ';
      }
      if (ctx.meta) {
        out += ctx.meta + ' ';
      }
      return out.substring(0, out.length - 1);
    }
  },

  json: (opts: JsonLayout): log4js.Layout => {
    return function (ev: log4js.LogEvent) {
      return JSON.stringify(processEvent(ev));
    };
  }
};