import * as fs from 'fs';
import { AppCache, EnvUtil, TranspileUtil } from '@travetto/boot';

import { SystemUtil } from './internal/system';
import { StacktraceUtil } from './stacktrace';

export type LogLevel = 'info' | 'warn' | 'debug' | 'error' | 'fatal';
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

const CONSOLE_RE = /(\bconsole[.](debug|info|warn|log|error|fatal)[(])|\n/g;


function wrap(target: Console, enrich: boolean) {
  return {
    enrich,
    invoke(payload: ConsolePayload, args: any[]) {
      const op = /error|warn|fatal/.test(payload.level) ? 'error' : 'log';
      return target[op](...args);
    }
  };
}

/**
 * Provides a general abstraction against the console.* methods to allow for easier capture and redirection.
 *
 * The transpiler will replace all console.* calls in the typescript files for the framework and those provided by the user.
 * Any console.log statements elsewhere will not be affected.
 */
class $ConsoleManager {

  /**
   * Stack of nested states
   */
  private states: ConsoleState[] = [];

  /**
   * The current state
   */
  private state: ConsoleState;

  /**
   * List of log levels to exclude
   */
  private readonly exclude = new Set<string>([]);

  /**
   * Full stack?
   */
  private readonly fullStack = EnvUtil.isProd();

  /**
   * Should we enrich the console by default
   */
  readonly defaultEnrich = !EnvUtil.isTrue('TRV_LOG_PLAIN');

  /**
   * Should the timestamp be included
   */
  readonly timestamp = EnvUtil.isValueOrFalse('TRV_LOG_TIME', ['s', 'ms'] as const, 'ms');

  /**
   * Unique key to use as a logger function
   */
  constructor(public readonly key: string) {
    // @ts-expect-error
    global[this.key] = this.invoke.bind(this);
    this.exclude = new Set();

    if (!(EnvUtil.getBoolean('DEBUG') ?? !EnvUtil.isProd())) {
      this.exclude.add('debug');
    }

    this.set(wrap(console, this.defaultEnrich)); // Init to console
    TranspileUtil.addPreProcessor(this.instrument.bind(this)); // Register console manager
  }

  /**
   * Prepare data for pretty printing
   * @param payload Console payload
   * @param args Supplemental arguments
   */
  private enrich(payload: ConsolePayload, args: any[]) {
    args = [
      payload.level.padEnd(5), `[${payload.category}:${payload.line}]`,
      ...args
    ];
    if (this.timestamp) {
      let timestamp = new Date().toISOString();
      if (this.timestamp === 's') {
        timestamp = timestamp.replace(/[.]\d{3}/, '');
      }
      args.unshift(timestamp);
    }
    return args;
  }

  /**
   * Modify typescript file to point to the Console Manager
   */
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
        return `${this.key}({level:'${lvl}',file:__filename.ᚕunix,category:'${SystemUtil.computeModule(fileName)}',line:${line}},`;
      }
    });
    return fileContents;
  }

  /**
   * Handle direct call in lieu of the console.* commands
   */
  invoke(payload: ConsolePayload, ...args: any[]) {
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

  /**
   * Set a new console state, works as a stack to allow for nesting
   */
  set(cons: ConsoleState, replace = false) {
    if (!replace) {
      this.states.unshift(cons);
    } else {
      this.states[0] = cons;
    }
    this.state = this.states[0];
  }

  /**
   * Set console state to log to a file. If the filename starts with an !, then
   * the file will be relative to the `AppCache`
   *
   * @param file The file to log to
   * @param state Additional log state config
   */
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

  /**
   * Pop off the logging stack
   */
  clear() {
    if (this.states.length > 1) {
      this.states.shift();
      this.state = this.states[0];
    }
  }

  /**
   * Format error for logging
   * @param err Error to format
   * @param mid supplemental text
   */
  formatError(err: Error, mid = '') {
    const stack = this.fullStack ? err.stack! : StacktraceUtil.simplifyStack(err);
    return `${err.message}\n${mid}${stack.substring(stack.indexOf('\n') + 1)}`;
  }
}

export const ConsoleManager = new $ConsoleManager('ᚕlg');