import type { ManifestContext } from '@travetto/manifest';
import type { CompilerLogEvent, CompilerLogLevel } from './types';

export type CompilerLogger = (level: CompilerLogLevel, message: string, ...args: unknown[]) => void;
export type WithLogger<T> = (log: CompilerLogger) => Promise<T>;

const LEVEL_TO_PRI: Record<CompilerLogLevel, number> = { debug: 1, info: 2, warn: 3, error: 4 };

const SCOPE_MAX = 15;

export class LogUtil {

  static root = process.cwd();

  static logLevel: CompilerLogLevel = 'error';

  /**
   * Set level for operation
   */
  static initLogs(ctx: ManifestContext, defaultLevel: CompilerLogLevel): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const build = process.env.TRV_BUILD as CompilerLogLevel | 'none';
    if (build !== 'none' && process.env.TRV_QUIET !== 'true') {
      this.logLevel = build || defaultLevel;
    }
    this.root = ctx.workspacePath;
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
    if (this.isLevelActive(ev.level)) {
      const params = [ev.message, ...ev.args ?? []].map(x => typeof x === 'string' ? x.replaceAll(LogUtil.root, '.') : x);
      if (ev.scope) {
        params.unshift(`[${ev.scope.padEnd(SCOPE_MAX, ' ')}]`);
      }
      params.unshift(new Date().toISOString(), `${ev.level.padEnd(5)}`);
      // eslint-disable-next-line no-console
      console[ev.level]!(...params);
    }
  }
}