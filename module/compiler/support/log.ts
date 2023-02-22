export type CompilerLogEvent = [level: 'info' | 'debug' | 'warn', message: string];
export type CompilerLogger = (...args: CompilerLogEvent) => void;
export type WithLogger<T> = (log: CompilerLogger) => Promise<T>;

const SCOPE_MAX = 15;

export class LogUtil {

  static levels: {
    debug: boolean;
    info: boolean;
    warn: boolean;
  }

  static set level(value: string) {
    this.levels = {
      warn: /^(debug|info|warn)$/.test(value),
      info: /^(debug|info)$/.test(value),
      debug: /^debug$/.test(value),
    };
  }

  /**
   * Is object a log event
   */
  static isLogEvent = (o: unknown): o is CompilerLogEvent => o !== null && o !== undefined && Array.isArray(o);

  /**
   * Log message with filtering by level
   */
  static log(scope: string, args: string[], ...[level, msg]: CompilerLogEvent): void {
    const message = msg.replaceAll(process.cwd(), '.');
    if (LogUtil.levels[level]) {
      const params = [`[${scope.padEnd(SCOPE_MAX, ' ')}]`, ...args, message];
      if (!/(0|false|off|no)$/i.test(process.env.TRV_LOG_TIME ?? '')) {
        params.unshift(new Date().toISOString());
      }
      // eslint-disable-next-line no-console
      console[level]!(...params);
    }
  }

  /**
   * With logger
   */
  static withLogger<T>(scope: string, op: WithLogger<T>, basic = true, args: string[] = []): Promise<T> {
    const log = this.log.bind(null, scope, args);
    basic && log('debug', 'Started');
    return op(log).finally(() => basic && log('debug', 'Completed'));
  }
}