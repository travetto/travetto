import { fileURLToPath } from 'url';

// Avoids issues with transpiling
import { path } from '@travetto/manifest';

import type { LogLevel, LineContext } from '../src/types';

/**
 * Used to help produce __output
 */
export const trv = {
  out: (val: string): string => path.toPosix(val.startsWith('file:') ? fileURLToPath(val) : val),
  // eslint-disable-next-line no-console
  log: (level: LogLevel, ctx: LineContext, ...args: unknown[]): void => console[level](...args),
};