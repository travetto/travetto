import timers from 'node:timers/promises';

export class TimerUtil {
  /**
   * Non-blocking timeout, that is cancellable
   */
  static nonBlockingTimeout(time: number): Promise<void> {
    return timers.setTimeout(time, undefined, { ref: false }).catch(() => { });
  }

  /**
   * Queue new macrotask
   */
  static queueMacroTask(): Promise<void> {
    return timers.setImmediate(undefined);
  }
}