import type { ManifestContext } from '@travetto/manifest';
import type { CompilerLogEvent, CompilerLogLevel, MainOp } from './types';

export type CompilerLogger = (level: CompilerLogLevel, message: string, ...args: unknown[]) => void;
export type WithLogger<T> = (log: CompilerLogger) => Promise<T>;

const LEVEL_TO_PRI = Object.fromEntries((['debug', 'info', 'warn', 'error'] as const).map((x, i) => [x, i + 1]));

const SCOPE_MAX = 15;

export class LogUtil {

  static root = process.cwd();

  static logLevel?: CompilerLogLevel;

  /**
   * Set level for operation
   */
  static initLogs(ctx: ManifestContext, op: MainOp): void {
    // Listen only if we aren't in quiet
    if ((process.env.TRV_BUILD || !process.env.TRV_QUIET) && op !== 'manifest') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this.logLevel = (process.env.TRV_BUILD as 'debug') ?? (op === 'run' ? 'warn' : 'info');
    }
    this.root = ctx.workspacePath;
  }

  /**
   * Log message with filtering by level
   */
  static log(scope: string, level: CompilerLogLevel, message: string, ...args: unknown[]): void {
    LogUtil.sendLogEventToConsole({ level, scope, message, args, time: Date.now() });
  }

  /**
   * With logger
   */
  static withLogger<T>(scope: string, op: WithLogger<T>, basic = true): Promise<T> {
    const log = this.log.bind(null, scope);
    basic && log('debug', 'Started');
    return op(log).finally(() => basic && log('debug', 'Completed'));
  }

  /**
   * Compiler log event to console
   */
  static sendLogEventToConsole(ev: CompilerLogEvent): void {
    if (this.logLevel && LEVEL_TO_PRI[this.logLevel] <= LEVEL_TO_PRI[ev.level]) {
      const params = [ev.message, ...ev.args ?? []].map(x => typeof x === 'string' ? x.replaceAll(LogUtil.root, '.') : x);
      if (ev.scope) {
        params.unshift(`[${ev.scope.padEnd(SCOPE_MAX, ' ')}]`);
      }
      params.unshift(`${ev.level.padEnd(5)}`);
      if (!/(0|false|off|no)$/i.test(process.env.TRV_LOG_TIME ?? '')) {
        params.unshift(new Date().toISOString());
      }
      // eslint-disable-next-line no-console
      console[ev.level]!(...params);
    }
  }
}