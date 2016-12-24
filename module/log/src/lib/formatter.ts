let wConf = require('winston/lib/winston/config');
wConf.addColors({ white: 'bold white' });

import { LoggingContext, LoggerExtra } from './types';

function extractExtra(meta: any) {
  let extra: LoggerExtra = {};

  if (meta && meta.__extra) {
    extra = meta.__extra;
    delete meta.__extra;
  }

  return extra;
}

export const Formatters = {
  standard(opts: LoggingContext) {
    // Return string will be passed to logger.
    let meta = '';
    let message = opts.message || '';
    let extra: LoggerExtra = extractExtra(opts.meta);

    if (opts.meta.stack) {
      meta = opts.meta.stack;
    } else if (opts.meta && Object.keys(opts.meta).length) {
      meta = JSON.stringify(opts.meta, undefined, opts.prettyPrint ? 2 : undefined);
    }

    let out = '';
    if (opts.timestamp) {
      let timestamp = new Date().toISOString().split('.')[0];
      if (opts.colorize) {
        timestamp = wConf.colorize('white', timestamp);
      }
      out += timestamp + ' ';
    }
    if (opts.level) {
      let level = opts.level.toUpperCase();
      if (opts.colorize) {
        level = wConf.colorize(opts.level, level);
      }
      if (opts.align) {
        level += ' '.repeat(8 - opts.level.length);
      }
      out += level + ' ';
    }
    if (extra.scope) {
      out += '[' + extra.scope + '] ';
    }
    if (message) {
      out += message + ' ';
    }
    if (meta) {
      out += meta + ' ';
    }
    return out.substring(0, out.length - 1);
  },

  json(opts: LoggingContext) {
    let res: any = {};
    let extra: LoggerExtra = extractExtra(opts.meta);

    if (opts.timestamp) {
      res.timestamp = new Date().toISOString().split('.')[0];
    }

    if (opts.level) {
      res.level = opts.level;
    }

    if (extra.scope) {
      res.scope = extra.scope;
    }

    if (opts.message) {
      res.message = opts.message;
    }

    if (opts.meta && Object.keys(opts.meta).length > 0) {
      res.meta = opts.meta;
    }

    return JSON.stringify(res);
  }
};