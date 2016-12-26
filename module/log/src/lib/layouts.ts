import * as log4js from 'log4js';

import { LogContext, StandardLayout, JsonLayout } from './types';

function processEvent(ev: log4js.LogEvent) {
  let out: LogContext = {
    timestamp: new Date(ev.startTime).toISOString().split('.')[0],
    level: ev.level.toString().toUpperCase(),
    category: ev.categoryName,
  };

  let args = ev.data;

  if (args && typeof args[0] === 'string') {
    out['message'] = args.shift();
  }

  if (args) {
    out.meta = args;
  }

  return out;
}

export const Formatters = {
  standard(opts: StandardLayout): log4js.Layout {
    return function (ev: log4js.LogEvent) {
      let ctx = processEvent(ev);
      // Return string will be passed to logger.

      if (ctx.meta.stack) {
        ctx.meta = ctx.meta.stack;
      } else if (ctx.meta && Object.keys(ctx.meta).length) {
        ctx.meta = JSON.stringify(ctx.meta, undefined, opts['prettyPrint'] ? 2 : undefined);
      }

      let out = '';
      if (opts.timestamp === undefined || !!opts.timestamp) {
        let timestamp = ctx.timestamp;
        if (opts.colorize) {
          // timestamp = wConf.colorize('white', timestamp);
        }
        out += timestamp + ' ';
      }
      if (opts.level === undefined || !!opts.level) {
        let level = ctx.level;
        if (opts.colorize) {
          // level = wConf.colorize(ctx.level, level);
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

  json(opts: JsonLayout): log4js.Layout {
    return function (ev: log4js.LogEvent) {
      return JSON.stringify(processEvent(ev));
    };
  }
};

log4js.layouts.addLayout('json', Formatters.json);
log4js.layouts.addLayout('standard', Formatters.standard);