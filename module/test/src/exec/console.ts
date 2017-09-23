import * as util from 'util';

const OG_CONSOLE = {
  log: console.log,
  info: console.info,
  error: console.error,
  debug: console.debug,
  warn: console.warn
}


export class ConsoleCapture {

  static out: { [key: string]: string };

  static log(level: string, ...args: any[]) {
    let msg = args.map((x: any) => typeof x === 'string' ? x : util.inspect(x, false, 4)).join(' ');
    this.out[level] = (this.out[level] || '') + msg + '\n';
  }

  static start() {
    this.out = {};
    for (let level of Object.keys(OG_CONSOLE)) {
      (console as any)[level] = this.log.bind(this, level);
    }
  }

  static end() {
    let ret = this.out;
    this.out = {};
    for (let [level] of Object.keys(OG_CONSOLE)) {
      (console as any)[level] = (OG_CONSOLE as any)[level];
    }
    return ret;
  }
}