import { fileURLToPath } from 'url';

import { path } from '@travetto/manifest';

import type { LogLevel, LineContext } from '../src/types';

/**
 * Used to help produce __output
 */
export const trv = {
  out: (val: string) => path.toPosix(val.startsWith('file:') ? fileURLToPath(val) : val),
  // eslint-disable-next-line no-console
  log: (level: LogLevel, ctx: LineContext, ...args: unknown[]): void => console[level](...args),
};