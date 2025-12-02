import { CompilerLogEvent, CompilerLogLevel, CompilerProgressEvent } from './types.ts';

const LEVEL_TO_PRI: Record<CompilerLogLevel | 'none', number> = { debug: 1, info: 2, warn: 3, error: 4, none: 5 };
const SCOPE_MAX = 15;

type LogConfig = {
  level?: CompilerLogLevel | 'none';
  root?: string;
  scope?: string;
  parent?: Logger;
};

export type LogShape = Record<'info' | 'debug' | 'warn' | 'error', (message: string, ...args: unknown[]) => void>;

const ESC = '\x1b[';

export class Logger implements LogConfig, LogShape {

  static #linePartial: boolean | undefined;

  /** Rewrite text line, tracking cleanup as necessary */
  static rewriteLine(text: string): Promise<void> | void {
    if ((!text && !this.#linePartial) || !process.stdout.isTTY) {
      return;
    }
    if (this.#linePartial === undefined) { // First time
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

  static reset(): void { process.stdout.write(`${ESC}!p${ESC}?25h`); }

  level?: CompilerLogLevel | 'none';
  root: string = process.cwd();
  scope?: string;
  parent?: Logger;

  constructor(config: LogConfig = {}) {
    Object.assign(this, config);
  }

  valid(event: CompilerLogEvent): boolean {
    return LEVEL_TO_PRI[this.level ?? this.parent?.level!] <= LEVEL_TO_PRI[event.level];
  }

  /** Log event with filtering by level */
  render(event: CompilerLogEvent): void {
    if (!this.valid(event)) { return; }
    const params = [event.message, ...event.args ?? []].map(x => typeof x === 'string' ? x.replaceAll(this.root ?? this.parent?.root!, '.') : x);
    if (event.scope ?? this.scope) {
      params.unshift(`[${(event.scope ?? this.scope!).padEnd(SCOPE_MAX, ' ')}]`);
    }
    params.unshift(new Date().toISOString(), `${event.level.padEnd(5)}`);
    Logger.rewriteLine(''); // Clear out progress line, if active
    // eslint-disable-next-line no-console
    console[event.level]!(...params);
  }

  info(message: string, ...args: unknown[]): void { return this.render({ level: 'info', message, args }); }
  debug(message: string, ...args: unknown[]): void { return this.render({ level: 'debug', message, args }); }
  warn(message: string, ...args: unknown[]): void { return this.render({ level: 'warn', message, args }); }
  error(message: string, ...args: unknown[]): void { return this.render({ level: 'error', message, args }); }
}

class $RootLogger extends Logger {
  #logProgress?: boolean;

  /** Get if we should log progress */
  get logProgress(): boolean {
    if (this.#logProgress === undefined) {
      this.#logProgress = !!process.env.PS1 && process.stdout.isTTY && process.env.TRV_BUILD !== 'none' && process.env.TRV_QUIET !== 'true';
    }
    return this.#logProgress;
  }

  /** Set level for operation */
  initLevel(defaultLevel: CompilerLogLevel | 'none'): void {
    const value = process.env.TRV_QUIET !== 'true' ? process.env.TRV_BUILD : 'none';
    switch (value) {
      case 'debug': case 'warn': case 'error': case 'info': this.level = value; break;
      case undefined: this.level = defaultLevel; break;
      case 'none': default: this.level = 'none';
    }
  }

  /** Produce a scoped logger */
  scoped(name: string): Logger {
    return new Logger({ parent: this, scope: name });
  }

  /** Scope and provide a callback pattern for access to a logger */
  wrap<T = unknown>(scope: string, operation: (log: Logger) => Promise<T>, basic = true): Promise<T> {
    const logger = this.scoped(scope);
    return basic ? (logger.debug('Started'), operation(logger).finally(() => logger.debug('Completed'))) : operation(logger);
  }

  /** Write progress event, if active */
  onProgressEvent(event: CompilerProgressEvent): void | Promise<void> {
    if (!(this.logProgress)) { return; }
    const pct = Math.trunc(event.idx * 100 / event.total);
    const text = event.complete ? '' : `Compiling [${'#'.repeat(Math.trunc(pct / 10)).padEnd(10, ' ')}] [${event.idx}/${event.total}] ${event.message}`;
    return Logger.rewriteLine(text);
  }

  /** Write all progress events if active */
  async consumeProgressEvents(src: () => AsyncIterable<CompilerProgressEvent>): Promise<void> {
    if (!(this.logProgress)) { return; }
    for await (const event of src()) { this.onProgressEvent(event); }
    Logger.reset();
  }
}

export const Log = new $RootLogger();

export class IpcLogger extends Logger {
  render(event: CompilerLogEvent): void {
    if (!this.valid(event)) { return; }
    if (process.connected && process.send) {
      process.send({ type: 'log', payload: event });
    }
    if (!process.connected) {
      super.render(event);
    }
  }
}
