import * as util from 'util';

const OG_CONSOLE = {
  log: console.log,
  info: console.info,
  error: console.error,
  debug: console.debug,
  warn: console.warn
};

export class ConsoleCapture {

  static out: Record<string, string>;

  static log(level: string, ...args: any[]) {
    const msg = args.map((x: any) => {
      if (x instanceof Error) {
        return x.toConsole!();
      } else if (typeof x === 'string') {
        return x;
      } else {
        return util.inspect(x, false, 4);
      }
    }).join(' ');
    this.out[level] = `${this.out[level] || ''}${msg}\n`;
  }

  static start() {
    this.out = {};
    for (const level of Object.keys(OG_CONSOLE)) {
      (console as any)[level] = this.log.bind(this, level);
    }
  }

  static end() {
    const ret = this.out;
    this.out = {};
    for (const level of Object.keys(OG_CONSOLE)) {
      (console as any)[level] = (OG_CONSOLE as any)[level];
    }
    return ret;
  }
}