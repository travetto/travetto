/**
 * Responsible for compiling all new code
 */
export const init = {
  key: 'compile-all',
  after: ['compiler'],
  action: async () => {
    const { AppCache, EnvUtil } = await import('@travetto/boot');

    if (EnvUtil.isReadonly()) {
      console.debug('Skipping compilation, in readonly mode');
      return;
    }

    const { ScanApp } = await import('@travetto/base');
    const { Compiler } = await import('../src/compiler');

    for (const x of ScanApp.findAppSourceFiles()) {
      if (!AppCache.hasEntry(x.file)) {
        Compiler.transpile(x.file); // Transpile all the desired files
      }
    }

    for (const x of ScanApp.findFiles({ folder: 'support' })) {
      if (!AppCache.hasEntry(x.file)) {
        Compiler.transpile(x.file); // Transpile all the desired files
      }
    }
  }
};