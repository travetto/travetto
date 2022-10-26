import * as path from 'path';

/**
 * Entry point for template editing
 */
export async function main(): Promise<void> {
  const { EnvInit } = await import('@travetto/base/support/bin/init');
  EnvInit.init({
    append: { TRV_RESOURCES: path.resolve(__source.folder, 'resources').__posix }
  });
  (await import('./bin/editor')).EditorState.init();
}