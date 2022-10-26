import * as path from 'path';
import { EnvInit } from '@travetto/base/support/bin/env';

/**
 * Entry point for template editing
 */
export async function main(): Promise<void> {
  EnvInit.init({
    append: { TRV_RESOURCES: path.resolve(__source.folder, 'resources').__posix }
  });
  (await import('./bin/editor')).EditorState.init();
}