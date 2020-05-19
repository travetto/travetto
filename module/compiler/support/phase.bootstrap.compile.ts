/**
 * Responsible for compiling all new code
 */
export const init = {
  key: 'compile-all',
  after: ['compiler'],
  action: async () => {
    const { AppCache } = await import('@travetto/boot');
    const { ScanApp } = await import('@travetto/base');

    for (const x of ScanApp.findAppSourceFiles()) {
      if (!AppCache.hasEntry(x.file)) {
        require(x.file); // Load all uncompiled files
      }
    }
  }
};