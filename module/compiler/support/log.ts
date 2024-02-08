import type { ManifestContext } from '@travetto/manifest';
import type { CompilerLogEvent, CompilerLogLevel, CompilerProgressEvent } from './types';

export type CompilerLogger = (level: CompilerLogLevel, message: string, ...args: unknown[]) => void;
export type WithLogger<T> = (log: CompilerLogger) => Promise<T>;

type ProgressWriter = (ev: CompilerProgressEvent) => (unknown | Promise<unknown>);

const LEVEL_TO_PRI: Record<CompilerLogLevel, number> = { debug: 1, info: 2, warn: 3, error: 4 };

const SCOPE_MAX = 15;

const ESC = '\x1b[';

export class LogUtil {

  static root = process.cwd();

  static logLevel: CompilerLogLevel = 'error';

  static logProgress?: ProgressWriter;

  static linePartial = false;

  static #rewriteLine(text: string): Promise<void> | void {
    // Move to 1st position, and clear after text
    const done = process.stdout.write(`${ESC}1G${text}${ESC}0K`);
    this.linePartial = !!text;
    if (!done) {
      return new Promise<void>(r => process.stdout.once('drain', r));
    }
  }

  /**
   * Set level for operation
   */
  static initLogs(ctx: ManifestContext, defaultLevel: CompilerLogLevel): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const build = process.env.TRV_BUILD as CompilerLogLevel | 'none';
    if (build !== 'none' && process.env.TRV_QUIET !== 'true') {
      this.logLevel = build || defaultLevel;
    }
    this.root = ctx.workspace.path;
    // If we are in info or a terminal and also in a tty
    this.logProgress = ((this.isLevelActive('info') || process.env.PS1) && process.stdout.isTTY) ? this.#logProgressEvent : undefined;
    if (this.logProgress) {
      process.stdout.write(`${ESC}?25l`); // Hide cursor
    }
    process.on('exit', () => this.cleanup());
  }

  static cleanup(): void {
    if (this.logProgress) {
      process.stdout.write(`${ESC}!p`); // Reset
    }
  }

  static #logProgressEvent(ev: CompilerProgressEvent): Promise<void> | void {
    const pct = Math.trunc(ev.idx * 100 / ev.total);
    const text = ev.complete ? '' : `Compiling [${'#'.repeat(Math.trunc(pct / 10)).padEnd(10, ' ')}] [${ev.idx}/${ev.total}] ${ev.message}`;
    return this.#rewriteLine(text);
  }

  /**
   * Is the log level active?
   */
  static isLevelActive(lvl: CompilerLogLevel): boolean {
    return LEVEL_TO_PRI[this.logLevel] <= LEVEL_TO_PRI[lvl];
  }

  /**
   * Log event with filtering by level
   */
  static logEvent(ev: CompilerLogEvent): void {
    if (this.isLevelActive(ev.level)) {
      const params = [ev.message, ...ev.args ?? []].map(x => typeof x === 'string' ? x.replaceAll(this.root, '.') : x);
      if (ev.scope) {
        params.unshift(`[${ev.scope.padEnd(SCOPE_MAX, ' ')}]`);
      }
      params.unshift(new Date().toISOString(), `${ev.level.padEnd(5)}`);
      if (this.linePartial) {
        this.#rewriteLine(''); // Clear out progress line
      }
      // eslint-disable-next-line no-console
      console[ev.level]!(...params);
    }
  }

  /**
   * With logger
   */
  static withLogger<T>(scope: string, op: WithLogger<T>, basic = true): Promise<T> {
    const log = this.logger(scope);
    basic && log('debug', 'Started');
    return op(log).finally(() => basic && log('debug', 'Completed'));
  }

  /**
   * With scope
   */
  static logger(scope: string): CompilerLogger {
    return (level, message, ...args) => this.logEvent({ scope, message, level, args, time: Date.now() });
  }

  /**
   * Write all progress events if active
   */
  static async consumeProgressEvents(src: () => AsyncIterable<CompilerProgressEvent>): Promise<void> {
    if (!this.logProgress) { return; }
    for await (const item of src()) { await this.logProgress?.(item); }
  }
}