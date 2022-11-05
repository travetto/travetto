import * as path from '@travetto/path';
import { Env } from '@travetto/base';

import { EditorState } from './bin/editor';

/**
 * Entry point for template editing
 */
export async function main(): Promise<void> {
  Env.define({
    append: { TRV_RESOURCES: path.resolve(path.dirname(__output), 'resources') }
  });

  EditorState.init();
}