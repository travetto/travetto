import type { CompilerLogLevel } from '../support/types';
import { EventUtil } from './event';

function log(level: CompilerLogLevel, message: string, ...args: unknown[]): void {
  EventUtil.sendEvent('log', { level, message, args, time: Date.now(), scope: 'compiler-exec' });
  if (!process.send) {
    // eslint-disable-next-line no-console
    console[level](message, ...args);
  }
}

export const Log = {
  warn: log.bind(null, 'warn'),
  debug: log.bind(null, 'debug'),
  info: log.bind(null, 'info'),
  error: log.bind(null, 'error'),
};