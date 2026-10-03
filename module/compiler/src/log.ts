import type { CompilerLogEvent, CompilerLogLevel, CompilerProgressEvent } from './types.ts';

const LEVEL_TO_PRIORITY: Record<CompilerLogLevel, number> = { debug: 1, info: 2, warn: 3, error: 4 };
const SCOPE_MAX = 15;

type LogConfig = Partial<CompilerLogEvent> & {
  parent?: Logger;
};

type LogParamInput = unknown | unknown[];

export type LogShape = Record<CompilerLogLevel, (message: string, param?: LogParamInput, override?: LogConfig) => void>;

const ESC = '\x1b[';

const fromInput = (config?: LogParamInput) => (!config ? {} : Array.isArray(config) ? { args: config } : { args: [config] });

export class Logger implements LogConfig, LogShape {
  static #linePartial: boolean | undefined;

  /** Rewrite text line, tracking cleanup as necessary */
  static rewriteLine(text: string): Promise<void> | void {
    if ((!text && !this.#linePartial) || !process.stdout.isTTY) {
      return;
    }
    if (this.#linePartial === undefined) {
      // First time
      process.stdout.write(`${ESC}?25l`); // Hide cursor
      process.on('exit', () => this.reset());
    }
    // Move to 1st position, and clear after text
    const done = process.stdout.write(`${ESC}1G${text}${ESC}0K`);
    this.#linePartial = !!text;
    if (!done) {
      return new Promise<void>(resolve => process.stdout.once('drain', resolve));
    }
  }

  static reset(): void {
    process.stdout.write(`${ESC}!p${ESC}?25h`);
  }

  level?: CompilerLogLevel;
  workspace: string = process.cwd();
  scope?: string;
  parent?: Logger;
  disabled = process.env.TRV_QUIET === 'true' || process.env.TRV_BUILD === 'none';

  constructor(config: LogConfig = {}) {
    Object.assign(this, config);
  }

  valid(event: CompilerLogEvent): boolean {
    return LEVEL_TO_PRIORITY[this.level ?? this.parent?.level ?? 'debug'] <= LEVEL_TO_PRIORITY[event.level];
  }

  /** Log event with filtering by level */
  render(event: CompilerLogEvent): void {
    if (!this.valid(event)) {
      return;
    }
    const params = [event.message, ...(event.args ?? [])].map(arg =>
      typeof arg === 'string' ? arg.replaceAll(this.workspace ?? this.parent?.workspace, '.') : arg
    );

    if (event.scope ?? this.scope) {
      params.unshift(`[${(event.scope ?? this.scope!).padEnd(SCOPE_MAX, ' ')}]`);
    }
    params.unshift(new Date().toISOString(), `${event.level.padEnd(5)}`);
    Logger.rewriteLine(''); // Clear out progress line, if active
    console[event.level]!(...params);
  }

  info(message: string, params?: LogParamInput, override?: LogConfig): void {
    this.render({ ...fromInput(params), ...override, level: 'info', message });
  }
  debug(message: string, params?: LogParamInput, override?: LogConfig): void {
    this.render({ ...fromInput(params), ...override, level: 'debug', message });
  }
  warn(message: string, params?: LogParamInput, override?: LogConfig): void {
    this.render({ ...fromInput(params), ...override, level: 'warn', message });
  }
  error(message: string, params?: LogParamInput, override?: LogConfig): void {
    this.render({ ...fromInput(params), ...override, level: 'error', message });
  }
}

class $RootLogger extends Logger {
  #logProgress?: boolean;

  /** Get if we should log progress */
  get logProgress(): boolean {
    if (this.#logProgress === undefined) {
      this.#logProgress = !!process.env.PS1 && process.stdout.isTTY && !this.disabled;
    }
    return this.#logProgress;
  }

  /** Set level for operation */
  initLevel(defaultLevel: CompilerLogLevel): void {
    const value = process.env.TRV_BUILD ?? undefined;
    switch (value) {
      case 'debug':
      case 'warn':
      case 'error':
      case 'info':
        this.level = value;
        break;
      case undefined:
        this.level = defaultLevel;
        break;
    }
  }

  /** Produce a scoped logger */
  scoped<T extends Logger>(this: T, name: string): T {
    const cons = this.constructor as new (config: LogConfig) => T;
    return new cons({ parent: this, scope: name });
  }

  /** Scope and provide a callback pattern for access to a logger */
  wrap<T = unknown>(scope: string, operation: (log: Logger) => Promise<T>, basic = true): Promise<T> {
    const logger = this.scoped(scope);
    if (basic) {
      logger.debug('Started');
      return operation(logger).finally(() => logger.debug('Completed'));
    } else {
      return operation(logger);
    }
  }

  /** Write progress event, if active */
  onProgressEvent(event: CompilerProgressEvent): void | Promise<void> {
    if (!this.logProgress) {
      return;
    }
    const progress = Math.trunc((event.idx * 100) / event.total);
    const text = event.complete
      ? ''
      : `Compiling [${'#'.repeat(Math.trunc(progress / 10)).padEnd(10, ' ')}] [${event.idx}/${event.total}] ${event.message}`;
    return Logger.rewriteLine(text);
  }

  /** Write all progress events if active */
  async consumeProgressEvents(input: () => AsyncIterable<CompilerProgressEvent>): Promise<void> {
    if (!this.logProgress) {
      return;
    }
    for await (const event of input()) {
      this.onProgressEvent(event);
    }
    Logger.reset();
  }
}

export const Log = new $RootLogger();

export class IpcLogger extends Logger {
  render(event: CompilerLogEvent): void {
    if (!this.valid(event)) {
      return;
    }
    if (process.connected && process.send) {
      process.send({ type: 'log', payload: { scope: this.scope, ...event } });
    }
    if (!process.connected) {
      super.render(event);
    }
  }
}
