import type { CompilerLogEvent, CompilerLogLevel, CompilerProgressEvent } from './types.ts';

const LEVEL_TO_PRIORITY: Record<CompilerLogLevel, number> = { debug: 1, info: 2, warn: 3, error: 4 };
const SCOPE_MAX = 15;

export type CompilerLogConfig = Partial<CompilerLogEvent> & {
  parent?: Logger;
};

export type LogParamInput = unknown | unknown[];

const ESC = '\x1b[';

export const fromCompilerLogParamInput = (config?: LogParamInput) =>
  !config ? {} : Array.isArray(config) ? { args: config } : { args: [config] };

class Logger {
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

  #level?: CompilerLogLevel;
  #disabled?: boolean;
  #logProgress?: boolean;

  workspace: string = process.cwd();
  scope?: string;
  parent?: Logger;

  constructor(config: CompilerLogConfig = {}) {
    const build = process.env.TRV_BUILD;
    this.#level ??= build === 'debug' || build === 'info' || build === 'warn' || build === 'error' ? build : undefined;
    this.#disabled ??= (/^(1|true|on|yes)$/i.test(process.env.TRV_QUIET ?? '') && !build) || build === 'none';
    this.scope ??= config.scope;
  }

  get disabled(): boolean {
    return this.#disabled ?? this.parent?.disabled ?? false;
  }

  set disabled(value: boolean) {
    this.#disabled = value;
  }

  get level(): CompilerLogLevel {
    return this.#level ?? this.parent?.level ?? 'debug';
  }

  set level(value: CompilerLogLevel) {
    this.#level = value;
  }

  /** Get if we should log progress */
  get logProgress(): boolean {
    return (this.#logProgress ??= process.stdout.isTTY && !this.disabled);
  }

  /** Produce a scoped logger */
  scoped(name: string): Logger {
    return new Logger({ parent: this, scope: name });
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

  valid(event: CompilerLogEvent): boolean {
    if (this.disabled && event.level !== 'error') {
      return false;
    }
    return LEVEL_TO_PRIORITY[this.level] <= LEVEL_TO_PRIORITY[event.level];
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

  info(message: string, params?: LogParamInput, override?: CompilerLogConfig): void {
    this.render({ ...fromCompilerLogParamInput(params), ...override, level: 'info', message });
  }
  debug(message: string, params?: LogParamInput, override?: CompilerLogConfig): void {
    this.render({ ...fromCompilerLogParamInput(params), ...override, level: 'debug', message });
  }
  warn(message: string, params?: LogParamInput, override?: CompilerLogConfig): void {
    this.render({ ...fromCompilerLogParamInput(params), ...override, level: 'warn', message });
  }
  error(message: string, params?: LogParamInput, override?: CompilerLogConfig): void {
    this.render({ ...fromCompilerLogParamInput(params), ...override, level: 'error', message });
  }
}

export type LogShape = Pick<Logger, CompilerLogLevel>;

export const Log = new Logger();
