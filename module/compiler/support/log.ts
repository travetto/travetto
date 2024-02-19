import type { ManifestContext } from '@travetto/manifest';
import type { CompilerLogEvent, CompilerLogLevel, CompilerProgressEvent } from './types';

const LEVEL_TO_PRI: Record<CompilerLogLevel, number> = { debug: 1, info: 2, warn: 3, error: 4 };
const SCOPE_MAX = 15;
const ESC = '\x1b[';

export class CompilerLogger {

  static #root = process.cwd();
  static #logLevel: CompilerLogLevel = 'error';
  static #linePartial: boolean | undefined;

  static logProgress = false;

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
      return new Promise<void>(r => process.stdout.once('drain', r));
    }
  }

  /** Are we in a shell that is interactive */
  static get isInteractiveShell(): boolean {
    return !!process.env.PS1 && process.stdout.isTTY;
  }

  /**
   * Set level for operation
   */
  static init(ctx: ManifestContext, defaultLevel?: CompilerLogLevel): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const build = process.env.TRV_BUILD as CompilerLogLevel | 'none';
    if (build !== 'none' && process.env.TRV_QUIET !== 'true') {
      this.#logLevel = build || defaultLevel;
      this.logProgress = this.isInteractiveShell;
    }
    this.#root = ctx.workspace.path;
  }

  /** Cleanup to restore behavior */
  static reset(): void {
    if (process.stdout.isTTY) {
      process.stdout.write(`${ESC}!p${ESC}?25h`);
    }
  }

  constructor(
    private scope: string,
    private level?: CompilerLogLevel,
    private logProgress?: boolean,
    private root = CompilerLogger.#root,
  ) { }

  isActive(level: CompilerLogLevel): boolean {
    return LEVEL_TO_PRI[this.level ?? CompilerLogger.#logLevel] <= LEVEL_TO_PRI[level];
  }

  /** Log event with filtering by level */
  onLogEvent(ev: CompilerLogEvent): void {
    if (!this.isActive(ev.level)) { return; }
    const params = [ev.message, ...ev.args ?? []].map(x => typeof x === 'string' ? x.replaceAll(this.root, '.') : x);
    if (ev.scope) {
      params.unshift(`[${ev.scope.padEnd(SCOPE_MAX, ' ')}]`);
    }
    params.unshift(new Date().toISOString(), `${ev.level.padEnd(5)}`);
    CompilerLogger.rewriteLine(''); // Clear out progress line, if active
    // eslint-disable-next-line no-console
    console[ev.level]!(...params);
  }

  /** Write progress event, if active */
  onProgressEvent(ev: CompilerProgressEvent): void | Promise<void> {
    if (!(this.logProgress ?? CompilerLogger.logProgress)) { return; }
    const pct = Math.trunc(ev.idx * 100 / ev.total);
    const text = ev.complete ? '' : `Compiling [${'#'.repeat(Math.trunc(pct / 10)).padEnd(10, ' ')}] [${ev.idx}/${ev.total}] ${ev.message}`;
    return CompilerLogger.rewriteLine(text);
  }

  /** Write all progress events if active */
  async consumeProgressEvents(src: () => AsyncIterable<CompilerProgressEvent>): Promise<void> {
    if (!(this.logProgress ?? CompilerLogger.logProgress)) { return; }
    for await (const ev of src()) { this.onProgressEvent(ev); }
    await CompilerLogger.reset();
  }

  log(level: CompilerLogLevel, message: string, args: unknown[]): void {
    this.onLogEvent({ scope: this.scope, message, level, args, time: Date.now() });
  }
  info(message: string, ...args: unknown[]): void { return this.log('info', message, args); }
  debug(message: string, ...args: unknown[]): void { return this.log('debug', message, args); }
  warn(message: string, ...args: unknown[]): void { return this.log('warn', message, args); }
  error(message: string, ...args: unknown[]): void { return this.log('error', message, args); }
  wrap<T = unknown>(op: (log: typeof this) => Promise<T>, basic = false): Promise<T> {
    return basic ? (this.debug('Started'), op(this).finally(() => this.debug('Completed'))) : op(this);
  }
}