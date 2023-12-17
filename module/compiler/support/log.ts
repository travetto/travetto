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
    // Listen only if we aren't in quiet
    if (process.env.TRV_BUILD || !/^(1|true|on|yes)$/i.test(process.env.TRV_QUIET ?? '')) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      this.logLevel = (process.env.TRV_BUILD as 'debug') || defaultLevel;
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
      params.unshift(`${ev.level.padEnd(5)}`);
      if (!/(0|false|off|no)$/i.test(process.env.TRV_LOG_TIME ?? '')) {
        params.unshift(new Date().toISOString());
      }
      // eslint-disable-next-line no-console
      console[ev.level]!(...params);
    }
  }
}