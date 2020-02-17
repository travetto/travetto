import * as fs from 'fs';
import { EnvUtil, FsUtil, RegisterUtil, AppCache } from '@travetto/boot';

export type LogLevel = 'info' | 'log' | 'trace' | 'warn' | 'debug' | 'error' | 'fatal';
export type ConsolePayload = {
  line: number;
  file: string;
  category: string;
  level: LogLevel;
};

type SimpleConsole = { invoke(payload: ConsolePayload, args: any[]): void } | Console | Record<LogLevel, (...args: any[]) => void>;

const OG_CONSOLE = console;
const KEY = '_trvCon';
const CONSOLE_RE = /(\bconsole[.](debug|info|trace|warn|log|error|fatal)[(])|\n/g;

class $ConsoleManager {
  private targetConsole: SimpleConsole;
  private argTransformer?: (arg: any) => any;
  private plain: boolean;

  readonly key = KEY;
  readonly defaultPlain = EnvUtil.isTrue('plain_console') || EnvUtil.isTrue('plain');
  readonly colorize = (process.stdout.isTTY && !EnvUtil.isTrue('no_color')) || EnvUtil.isTrue('force_color');
  readonly timestamp = !EnvUtil.isFalse('log_time');
  readonly timeMillis = EnvUtil.isTrue('trace');
  readonly exclude = new Set<string>([]);

  constructor() {
    (global as any)[KEY] = this.invoke.bind(this);
    this.exclude = new Set(['trace', 'debug'].filter(x => !EnvUtil.isTrue(x)));
    this.set(null); // Init
    RegisterUtil.addPreparer(this.instrument.bind(this)); // Register console manager
  }

  private buildContext(payload: ConsolePayload) {
    const out = [`[${payload.level.padEnd(5)}]`, `[${payload.category}:${payload.line}]`];
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

    if (this.argTransformer) {
      args = args.map(this.argTransformer!);
    }

    if ('invoke' in this.targetConsole) {
      return this.targetConsole.invoke(payload, args);
    } else {
      const level = payload.level;
      const op = level in this.targetConsole && level !== 'trace' ? level : (/error|warn|fatal/.test(payload.level) ? 'error' : 'log');
      if (!this.plain) {
        return this.targetConsole[op](...this.buildContext(payload), ...args);
      } else {
        return this.targetConsole[op](...args);
      }
    }
  }

  instrument(fileName: string, fileContents: string) {
    // Insert filename into all log statements for all components, when logger isn't loaded
    let line = 1;
    fileContents = fileContents.replace(CONSOLE_RE, (a, cmd, lvl) => {
      if (a === '\n') {
        line += 1;
        return a;
      } else {
        lvl = lvl === 'log' ? 'info' : lvl;
        return `${KEY}({level:'${lvl}',file:__filename,category:'${FsUtil.computeModule(fileName)}',line:${line}},`;
      }
    });
    return fileContents;
  }

  set(cons: SimpleConsole | string | null, transformer?: (arg: any) => any, plain?: boolean) {
    if (typeof cons === 'string') {
      const name = cons.startsWith('!') ? AppCache.toEntryName(cons.substring(1)) : cons;
      cons = new console.Console({
        stdout: fs.createWriteStream(name, { flags: 'a' }),
        inspectOptions: { depth: 4 }
      });
    }
    this.targetConsole = cons ?? OG_CONSOLE;
    this.argTransformer = transformer;
    this.plain = plain ?? this.defaultPlain;
  }
}

export const ConsoleManager = new $ConsoleManager();