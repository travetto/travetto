import { appendFileSync } from 'node:fs';
import util from 'node:util';
import type { ManifestContext } from '@travetto/manifest';
import type { CompilerLogEvent, CompilerLogLevel, CompilerProgressEvent } from './types';

export type CompilerLogger = (level: CompilerLogLevel, message: string, ...args: unknown[]) => void;
export type WithLogger<T> = (log: CompilerLogger) => Promise<T>;

type ProgressWriter = (ev: CompilerProgressEvent) => (unknown | Promise<unknown>);

const LEVEL_TO_PRI: Record<CompilerLogLevel, number> = { debug: 1, info: 2, warn: 3, error: 4 };

const SCOPE_MAX = 15;

export class LogUtil {

  static root = process.cwd();

  static logLevel: CompilerLogLevel = 'error';

  static logProgress?: ProgressWriter;

  static outFile: string;

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
    this.outFile = `${ctx.workspace.path}/${ctx.build.toolFolder}/compiler.log`;

    if (this.isLevelActive('info') && process.stdout.isTTY) {
      this.logProgress = this.#logProgressEvent;
    } else {
      this.logProgress = undefined;
    }
  }

  static #logProgressEvent(ev: CompilerProgressEvent): Promise<void> | void {
    const pct = Math.trunc(ev.idx * 100 / ev.total);
    const text = ev.complete ? '' : `Compiling [${'#'.repeat(Math.trunc(pct / 10)).padEnd(10, ' ')}] [${ev.idx}/${ev.total}] ${ev.message}`;
    // Move to 1st position, and clear after text
    const done = process.stdout.write(`\x1b[1G${text}\x1b[0K`);
    if (!done) {
      return new Promise<void>(r => process.stdout.once('drain', r));
    }
  }

  /**
   * Is the log level active?
   */
  static isLevelActive(lvl: CompilerLogLevel): boolean {
    return LEVEL_TO_PRI[this.logLevel] <= LEVEL_TO_PRI[lvl];
  }

  /**
   * Log message with filtering by level
   */
  static log(event: CompilerLogEvent): void;
  static log(scope: string, ...args: Parameters<CompilerLogger>): void;
  static log(scopeOrEvent: string | CompilerLogEvent, level?: CompilerLogLevel, message?: string, ...args: unknown[]): void {
    const ev = typeof scopeOrEvent === 'string' ? { scope: scopeOrEvent, level: level!, message, args } : scopeOrEvent;
    if (this.isLevelActive(ev.level)) {
      const params = [ev.message, ...ev.args ?? []].map(x => typeof x === 'string' ? x.replaceAll(this.root, '.') : x);
      if (ev.scope) {
        params.unshift(`[${ev.scope.padEnd(SCOPE_MAX, ' ')}]`);
      }
      params.unshift(new Date().toISOString(), `${ev.level.padEnd(5)}`);
      // eslint-disable-next-line no-console
      console[ev.level]!(...params);
      // Log to file
      appendFileSync(this.outFile, `${params.map(x => typeof x === 'string' ? x : util.inspect(x)).join(' ')}\n`, 'utf8');
    }
  }

  /**
   * With logger
   */
  static withLogger<T>(scope: string, op: WithLogger<T>, basic = true): Promise<T> {
    const log = this.scoped(scope);
    basic && log('debug', 'Started');
    return op(log).finally(() => basic && log('debug', 'Completed'));
  }

  /**
   * With scope
   */
  static scoped(scope: string): CompilerLogger {
    return this.log.bind(this, scope);
  }

  /**
   * Stream Compiler log events to console
   */
  static async consumeLogEvents(src: AsyncIterable<CompilerLogEvent>): Promise<void> {
    for await (const ev of src) { this.log(ev); }
  }

  /**
   * Write all progress events if active
   */
  static async consumeProgressEvents(src: () => AsyncIterable<CompilerProgressEvent>): Promise<void> {
    if (!this.logProgress) { return; }
    for await (const item of src()) { await this.logProgress?.(item); }
  }
}