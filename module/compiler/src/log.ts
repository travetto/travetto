import util from 'util';

import type { CompilerLogEvent } from '../support/transpile';

function log(level: 'info' | 'debug', message: string, ...args: unknown[]): void {
  if (process.send) {
    const ev: CompilerLogEvent = [level, util.format(message, ...args)];
    process.send(ev);
  } else {
    // eslint-disable-next-line no-console
    console[level](message, ...args);
  }
}

export const Log = {
  debug: log.bind(null, 'debug'),
  info: log.bind(null, 'info')
};