import { path } from '@travetto/manifest';

import type { LogLevel, LineContext } from '../src/types';

/**
 * Used to help produce __output
 */
export const trv = {
  out: path.toPosix,
  // eslint-disable-next-line no-console
  log: (level: LogLevel, ctx: LineContext, ...args: unknown[]): void => console[level](...args),
};