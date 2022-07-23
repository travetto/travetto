import { SourceIndex } from '@travetto/boot/src/internal/source';

/**
 * Responsible for transpiling all new code
 */
export const init = {
  key: '@trv:base/transpile',
  after: '@trv:base/init',
  action: async (): Promise<void> => {
    const { ModuleManager } = await import('@travetto/boot/src/internal/module');
    const { AppManifest } = await import('@travetto/base');
    ModuleManager.transpileAll(SourceIndex.findByFolders(AppManifest.source));
  }
};