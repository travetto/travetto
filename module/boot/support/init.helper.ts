import { path } from '@travetto/manifest';
import { ConsoleManager } from '../src/console';

import { invokeMain } from './init.main';

/**
 * Drop in replacement for logging
 */
export const log = ConsoleManager.invoke.bind(ConsoleManager);

/**
 * Used to help produce __output
 */
export const out = path.toPosix;

/**
 * Invoke, only if filename, or module are main
 */
export async function main(target: Function, filename: string, module: NodeJS.Module): Promise<void> {
  if (filename === path.toPosix(process.env.TRV_MAIN ?? '') || (!process.env.TRV_MAIN && module === require.main)) {
    delete process.env.TRV_MAIN;
    invokeMain(target);
  }
}