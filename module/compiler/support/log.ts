export type CompilerLogEvent = [level: 'info' | 'debug' | 'warn', message: string];
export type CompilerLogger = (...args: CompilerLogEvent) => void;
export type WithLogger<T> = (log: CompilerLogger) => Promise<T>;

const LEVELS = { warn: true, debug: /^debug$/.test(process.env.TRV_BUILD ?? ''), info: !/^warn$/.test(process.env.TRV_BUILD ?? '') };
const SCOPE_MAX = 15;

export class LogUtil {

  /**
   * Is object a log event
   */
  static isLogEvent = (o: unknown): o is CompilerLogEvent => o !== null && o !== undefined && Array.isArray(o);

  /**
   * Log message with filtering by level
   */
  static log(scope: string, args: string[], ...[level, msg]: CompilerLogEvent): void {
    const message = msg.replaceAll(process.cwd(), '.');
    LEVELS[level] && console.debug(new Date().toISOString(), `[${scope.padEnd(SCOPE_MAX, ' ')}]`, ...args, message);
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