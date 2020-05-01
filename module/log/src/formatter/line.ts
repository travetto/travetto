import * as util from 'util';

import { Env, StacktraceUtil } from '@travetto/base';

import { LogEvent, Formatter } from '../types';
import { stylize, LEVEL_STYLES } from './styles';
import { FsUtil } from '@travetto/boot';

// TODO: Document
export interface LineFormatterOpts {
  timestamp?: boolean;
  timeMillis?: boolean;
  colorize?: boolean;
  align?: boolean;
  level?: boolean;
  location?: boolean;
}

// TODO: Document
export class LineFormatter implements Formatter {
  private opts: LineFormatterOpts;

  constructor(opts: LineFormatterOpts) {
    this.opts = { colorize: true, timestamp: true, align: true, level: true, location: true, ...opts };
  }

  format(ev: LogEvent) {
    const opts = this.opts;
    let out = '';

    if (opts.timestamp) {
      let timestamp = new Date(ev.timestamp).toISOString();
      if (!opts.timeMillis) {
        [timestamp] = timestamp.split('.');
      }
      if (opts.colorize) {
        timestamp = stylize(timestamp, 'white', 'bold');
      }
      out = `${out}${timestamp} `;
    }

    if (opts.level) {
      let level: string = ev.level;
      if (opts.colorize) {
        level = stylize(level, ...LEVEL_STYLES[level]);
      }
      if (opts.align) {
        level += ' '.repeat(5 - ev.level.length);
      }
      out = `${out}${level} `;
    }

    if (ev.file && opts.location) {
      const ns = ev.category;
      const loc = ev.line ? `${Env.prod ? ev.category : FsUtil.toTS(ev.file.replace(Env.cwd, '.'))}:${ev.line}` : ns;
      out = `${out}[${stylize(loc!, 'blue')}] `;
    }

    let message = ev.message;

    if (ev.args && ev.args.length) {
      const args = ev.args.slice(0);
      if (message) {
        args.unshift(message);
      }

      message = args.map((x: any) =>
        typeof x === 'string' ? x :
          (x instanceof Error ? (Env.prod ? x.stack : StacktraceUtil.simplifyStack(x)) :
            util.inspect(x,
              ev.level === 'trace',
              (ev.level === 'debug' || ev.level === 'trace') ? 4 : 2,
              opts.colorize !== false
            )
          )).join(' ');
    }

    if (message) {
      out = `${out}${ev.prefix ?? ''}${message} `;
    }
    return out.substring(0, out.length - 1);
  }
}