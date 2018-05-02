import * as util from 'util';
import * as path from 'path';
import { LogEvent } from '../types';
import { stylize, LEVEL_STYLES, makeLink } from './styles';

const RE_SEP = path.sep === '/' ? '\\/' : path.sep;
const PATH_RE = new RegExp(RE_SEP, 'g');

export interface LineFormatterOpts {
  timestamp?: boolean;
  colorize?: boolean;
  align?: boolean;
  level?: boolean;
  location?: boolean;
}

export function lineFormatter(opts: LineFormatterOpts) {
  opts = { colorize: true, timestamp: true, align: true, level: true, simple: false, location: true, ...opts };

  return (ev: LogEvent) => {
    let out = '';

    if (opts.timestamp) {
      let timestamp = new Date(ev.timestamp).toISOString().split('.')[0];
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
      const ns = ev.file
        .replace(process.cwd(), '')
        .replace(/^.*node_modules/, '')
        .replace(PATH_RE, '.')
        .replace(/^[.]/, '')
        .replace(/[.](t|j)s$/, '');

      const loc = ev.line ? `${ns}:${' '.repeat(2 - Math.trunc(Math.floor(Math.log10(ev.line)))) + ev.line}` : ns;
      if (opts.colorize) {
        // ev.category = makeLink(ev.category, `file://${ev.file}:${ev.line}`);
      }
      out = `${out}[${loc}] `;
    }

    if (ev.category) {
      out = `${out}[${ev.category}] `;
    }

    let message = ev.message;

    if (ev.args && ev.args.length) {
      const args = ev.args.slice(0);
      if (message) {
        args.unshift(message);
      }

      if (ev.meta) {
        args.push(ev.meta);
      }
      message = args.map((x: any) => typeof x === 'string' ? x :
        util.inspect(x, ev.level === 'debug', ev.level === 'debug' ? 4 : 2, opts.colorize !== false)).join(' ');
    }

    if (message) {
      out = `${out}${message} `;
    }
    return out.substring(0, out.length - 1);
  }
};