import * as path from 'path';
import { Env } from '@travetto/base';

/**
 * Entry point for template editing
 */
export async function main(): Promise<void> {
  Env.define({
    append: { TRV_RESOURCES: path.resolve(__source.folder, 'resources').__posix }
  });
  (await import('./bin/editor')).EditorState.init();
}