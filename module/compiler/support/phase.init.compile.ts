/**
 * Responsible for compiling all new code
 */
export const init = {
  key: '@trv:compiler/compile',
  after: ['@trv:compiler/init'],
  action: async () => {
    const { AppCache, EnvUtil } = await import('@travetto/boot');
    const { SourceCodeIndex } = await import('@travetto/boot/src/internal/code');
    const { Compiler } = await import('../src/compiler');

    if (EnvUtil.isReadonly()) {
      console.debug('Skipping compilation, in readonly mode');
      return;
    }

    const { AppManifest } = await import('@travetto/base');

    for (const x of SourceCodeIndex.findByFolders(AppManifest.source)) {
      if (!AppCache.hasEntry(x.file)) {
        Compiler.transpile(x.file); // Compile all the desired files
      }
    }
  }
};