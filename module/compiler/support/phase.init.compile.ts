/**
 * Responsible for compiling all new code
 */
export const init = {
  key: '@trv:compiler/compile',
  after: ['@trv:compiler/init'],
  action: async () => {
    const { AppCache, EnvUtil, SourceIndex } = await import('@travetto/boot');

    if (EnvUtil.isReadonly()) {
      console.debug('Skipping compilation, in readonly mode');
      return;
    }

    const { AppManifest } = await import('@travetto/base');
    const { Compiler } = await import('../src/compiler');

    for (const x of SourceIndex.findByFolders(AppManifest.sourceFolders)) {
      if (!AppCache.hasEntry(x.file)) {
        Compiler.transpile(x.file); // Compile all the desired files
      }
    }
  }
};