/**
 * Responsible for transpiling all new code
 */
export const init = {
  key: '@trv:base/transpile',
  after: '@trv:base/init',
  action: async () => {
    const { AppCache, EnvUtil } = await import('@travetto/boot');
    const { SourceCodeIndex } = await import('@travetto/boot/src/internal/code');
    const { CompileUtil } = await import('@travetto/boot/src/internal/compile');

    if (EnvUtil.isReadonly()) {
      console.debug('Skipping compilation, in readonly mode');
      return;
    }

    const { AppManifest } = await import('@travetto/base');

    for (const x of SourceCodeIndex.findByFolders(AppManifest.source)) {
      if (!AppCache.hasEntry(x.file)) {
        CompileUtil.transpile(x.file); // Compile all the desired files
      }
    }
  }
};