import * as fs from 'fs';
import { AppCache, EnvUtil, TranspileUtil } from '@travetto/boot';

import { SystemUtil } from './system-util';
import { Env } from './env';

export type LogLevel = 'info' | 'log' | 'trace' | 'warn' | 'debug' | 'error' | 'fatal';
export type ConsolePayload = {
  line: number;
  file: string;
  category: string;
  level: LogLevel;
};

type SimpleConsole = { invoke(payload: ConsolePayload, ...args: any[]): void } | Console | Record<LogLevel, (...args: any[]) => void>;
type State = { console: SimpleConsole, transformer?: (arg: any) => any, plain?: boolean };

const OG_CONSOLE = console;
const KEY = '_trvCon';
const CONSOLE_RE = /(\bconsole[.](debug|info|trace|warn|log|error|fatal)[(])|\n/g;

class $ConsoleManager {
  private states: State[] = [{ console }];
  private state: State = this.states[0];

  readonly key = KEY;
  readonly defaultPlain = EnvUtil.isTrue('PLAIN_CONSOLE') || EnvUtil.isTrue('PLAIN');
  readonly timestamp = !EnvUtil.isFalse('LOG_TIME');
  readonly timeMillis = EnvUtil.isTrue('LOG_MILLIS') || (Env.trace ? !EnvUtil.isFalse('LOG_MILLIS') : false);
  readonly exclude = new Set<string>([]);

  constructor() {
    (global as any)[KEY] = this.invoke.bind(this);
    this.exclude = new Set();
    if (!Env.debug) {
      this.exclude.add('debug');
    }
    if (!Env.trace) {
      this.exclude.add('trace');
    }
    this.set(null); // Init
    TranspileUtil.addPreparer(this.instrument.bind(this)); // Register console manager
  }

  private buildContext(payload: ConsolePayload) {
    const out = [payload.level.padEnd(5), `[${payload.category}:${payload.line}]`];
    if (this.timestamp) {
      const [time] = new Date().toISOString().split(this.timeMillis ? /~/ : /[.]/);
      out.unshift(time);
    }
    return out;
  }

  invoke(payload: ConsolePayload, ...args: any[]) {
    if (this.exclude.has(payload.level)) {
      return; // Do nothing
    }

    args = args.map(x => (x && x.toConsole) ? x.toConsole() : x);

    if (this.state.transformer) {
      args = args.map(this.state.transformer!);
    }

    if ('invoke' in this.state.console) {
      return this.state.console.invoke(payload, ...args);
    } else {
      const level = payload.level;
      const op = level in this.state.console && level !== 'trace' ? level : (/error|warn|fatal/.test(payload.level) ? 'error' : 'log');
      if (!this.state.plain) {
        return this.state.console[op](...this.buildContext(payload), ...args);
      } else {
        return this.state.console[op](...args);
      }
    }
  }

  instrument(fileName: string, fileContents: string) {
    // Ignore framework /bin/ folders only
    if (fileName.includes('/bin/')) {
      return fileContents; // Skip cli
    }
    // Insert filename into all log statements for all components
    let line = 1;
    fileContents = fileContents.replace(CONSOLE_RE, (a, cmd, lvl) => {
      if (a === '\n') {
        line += 1;
        return a;
      } else {
        lvl = lvl === 'log' ? 'info' : lvl;
        return `${KEY}({level:'${lvl}',file:__filename,category:'${SystemUtil.computeModule(fileName)}',line:${line}},`;
      }
    });
    return fileContents;
  }

  set(cons: SimpleConsole | string | null, transformer?: (arg: any) => any, plain?: boolean) {
    if (typeof cons === 'string') {
      const name = cons.startsWith('!') ? AppCache.toEntryName(cons.substring(1)) : cons;
      cons = new console.Console({
        stdout: fs.createWriteStream(name, { flags: 'a' }),
        inspectOptions: { depth: 4 },
      });
    }
    this.states.push(this.state = { console: cons ?? OG_CONSOLE, transformer, plain: plain ?? this.defaultPlain });
  }

  clear() {
    if (this.states.length > 1) {
      this.states.pop();
      this.state = this.states[this.states.length - 1];
    }
  }
}

export const ConsoleManager = new $ConsoleManager();