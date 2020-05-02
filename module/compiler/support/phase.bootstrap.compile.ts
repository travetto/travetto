// TODO: Document
export const init = {
  key: 'compile-all',
  after: ['compiler'],
  action: async () => {
    const { AppCache } = await import('@travetto/boot');
    const { ScanApp } = await import('@travetto/base');

    for (const x of ScanApp.findAppFiles(ScanApp.getAppPaths())) {
      if (!AppCache.hasEntry(x)) {
        require(x); // Load all uncompiled files
      }
    }
  }
};