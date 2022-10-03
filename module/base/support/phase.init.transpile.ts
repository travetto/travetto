/**
 * Responsible for transpiling all new code
 */
export const step = {
  key: '@trv:base/transpile',
  after: '@trv:base/init',
  active: async (): Promise<boolean> => import('@travetto/boot').then(mod => !mod.EnvUtil.isCompiled()),
  action: async (): Promise<void> => {
    const { TranspileManager } = await import('@travetto/boot/src/internal/transpile');
    const { ModuleIndex } = await import('@travetto/boot/src/internal/module');
    const { AppManifest } = await import('@travetto/base');
    TranspileManager.transpileAll(ModuleIndex.findByFolders(AppManifest.source));
  }
};