/**
 * Responsible for transpiling all new code
 */
export const step = {
  key: '@trv:base/transpile',
  after: '@trv:base/init',
  active: async (): Promise<boolean> => import('@travetto/boot').then(mod => !mod.EnvUtil.isCompiled()),
  action: async (): Promise<void> => {
    const { ModuleManager } = await import('@travetto/boot/src/internal/module');
    const { SourceIndex } = await import('@travetto/boot/src/internal/source');
    const { AppManifest } = await import('@travetto/base');
    ModuleManager.transpileAll(SourceIndex.findByFolders(AppManifest.source));
  }
};