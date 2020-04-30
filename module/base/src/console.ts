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

interface ConsoleState {
  invoke(payload: ConsolePayload, args: any[]): void;
  enrich?: boolean;
  processArgs?(payload: ConsolePayload, args: any[]): any[];
}

const KEY = 'ᚕlg';
const CONSOLE_RE = /(\bconsole[.](debug|info|trace|warn|log|error|fatal)[(])|\n/g;


function wrap(target: Console, enrich: boolean) {
  return {
    enrich,
    invoke(payload: ConsolePayload, args: any[]) {
      const level = payload.level;
      const op = level in target && level !== 'trace' ? level : (/error|warn|fatal/.test(payload.level) ? 'error' : 'log');
      return target[op](...args);
    }
  };
}

/**
 * Provides a general abstraction against the console.* methods to allow for easier capture and redirection
 */
// TODO: Document
class $ConsoleManager {
  private states: ConsoleState[] = [];
  private state: ConsoleState;

  readonly key = KEY;
  readonly defaultEnrich = !(EnvUtil.isTrue('PLAIN_CONSOLE') || EnvUtil.isTrue('PLAIN'));
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
    this.set(wrap(console, this.defaultEnrich)); // Init to console
    TranspileUtil.addPreparer(this.instrument.bind(this)); // Register console manager
  }

  private enrich(payload: ConsolePayload, args: any[]) {
    args = [
      payload.level.padEnd(5), `[${payload.category}:${payload.line}]`,
      ...args
    ];
    if (this.timestamp) {
      const [time] = new Date().toISOString().split(this.timeMillis ? /~/ : /[.]/);
      args.unshift(time);
    }
    return args;
  }

  private instrument(fileName: string, fileContents: string) {
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

  private invoke(payload: ConsolePayload, ...args: any[]) {
    if (this.exclude.has(payload.level)) {
      return; // Do nothing
    }

    args = args.map(x => (x && x.toConsole) ? x.toConsole() : x);

    if (this.state.processArgs) {
      args = this.state.processArgs(payload, args);
    }

    if (this.state.enrich) {
      args = this.enrich(payload, args);
    }

    return this.state.invoke(payload, args);
  }

  set(cons: ConsoleState) {
    this.states.unshift(cons);
    this.state = this.states[0];
  }

  setFile(file: string, state: Omit<ConsoleState, 'invoke'> = {}) {
    const name = file.startsWith('!') ? AppCache.toEntryName(file.substring(1)) : file;
    this.set({
      ...wrap(new console.Console({
        stdout: fs.createWriteStream(name, { flags: 'a' }),
        inspectOptions: { depth: 4 },
      }), state.enrich ?? this.defaultEnrich),
      ...state
    });
  }

  clear() {
    if (this.states.length > 1) {
      this.states.shift();
      this.state = this.states[0];
    }
  }
}

export const ConsoleManager = new $ConsoleManager();