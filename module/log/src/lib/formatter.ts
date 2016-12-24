let wConf = require('winston/lib/winston/config');

export interface LoggingContext {
  level: string;
  colorize: boolean;
  showLevel: boolean;
  timestamp: boolean;
  meta?: any;
  align: boolean;
  message?: string;
  prettyPrint: boolean;
}

wConf.addColors({ white: 'bold white' });

export const Formatters = {
  standard(opts: LoggingContext) {
    // Return string will be passed to logger.
    let meta = '';
    let message = opts.message || '';

    if (opts.meta.stack) {
      meta = opts.meta.stack;
    } else if (opts.meta) {
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
    if (message) {
      out += message + ' ';
    }
    if (meta && Object.keys(meta).length) {
      out += meta + ' ';
    }
    return out.substring(0, out.length - 1);
  }
};
