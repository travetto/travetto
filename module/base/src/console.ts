import { TranspileUtil } from '@travetto/boot';

import { AppManifest } from './manifest';

export type LogLevel = 'info' | 'warn' | 'debug' | 'error';

type LineContext = { file: string, line: number };

interface ConsoleListener {
  onLog<T extends LineContext>(context: LogLevel, ctx: T, args: unknown[]): void;
}

const CONSOLE_RE = /(\bconsole[.](debug|info|warn|log|error)[(])|\n/g;

function wrap(target: Console): ConsoleListener {
  return {
    onLog(level: LogLevel, ctx: LineContext, args: unknown[]) {
      return target[level](...args);
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
   * Stack of nested appenders
   */
  private stack: ConsoleListener[] = [];

  /**
   * The current appender
   */
  private appender: ConsoleListener;

  /**
   * List of log levels to exclude
   */
  private readonly exclude = new Set<string>([]);

  /**
   * Unique key to use as a logger function
   */
  constructor(public readonly key: string) {
    // @ts-expect-error
    global[this.key] = this.invoke.bind(this);
    this.exclude = new Set();

    if (AppManifest.debug.status === false) {
      this.exclude.add('debug');
    }

    this.set(console); // Init to console
    TranspileUtil.addPreProcessor(this.instrument.bind(this)); // Register console manager
  }

  /**
   * Modify typescript file to point to the Console Manager
   */
  private instrument(filename: string, fileContents: string) {
    // Insert filename into all log statements for all components
    let line = 1;
    fileContents = fileContents.replace(CONSOLE_RE, (a, cmd, lvl) => {
      if (a === '\n') {
        line += 1;
        return a;
      } else {
        lvl = lvl === 'log' ? 'info' : lvl;
        return `${this.key}('${lvl}', { file: ᚕsrc(__filename), line: ${line} },`; // Make ConsoleManager target for all console invokes
      }
    });
    return fileContents;
  }

  /**
   * Handle direct call in lieu of the console.* commands
   */
  invoke(level: LogLevel, ctx: LineContext, ...args: unknown[]) {
    if (this.exclude.has(level)) {
      return; // Do nothing
    }

    return this.appender.onLog(level, ctx, args);
  }

  /**
   * Set a new console appender, works as a stack to allow for nesting
   */
  set(cons: ConsoleListener | Console, replace = false) {
    cons = ('onLog' in cons) ? cons : wrap(cons);
    if (!replace) {
      this.stack.unshift(cons);
    } else {
      this.stack[0] = cons;
    }
    this.appender = this.stack[0];
  }

  /**
   * Pop off the logging stack
   */
  clear() {
    if (this.stack.length > 1) {
      this.stack.shift();
      this.appender = this.stack[0];
    }
  }
}

export const ConsoleManager = new $ConsoleManager('ᚕlg');