/**
 * Responsible for initializing the compiler
 */
export const init = {
  key: '@trv:compiler/init',
  after: ['@trv:config/init', '@trv:base/init'],
  action: async () => {
    const { AppCache, TranspileUtil } = await import('@travetto/boot');
    const { ScanApp } = await import('@travetto/base');

    // Ensure all transformer support is ready for Compiler init
    for (const x of ScanApp.findCommonFiles({ folder: 'support', filter: /\/(transformer|lib)[.]/ })) {
      if (!AppCache.hasEntry(x.file)) {
        TranspileUtil.transpile(x.file); // Transpile all the desired files
      }
    }

    const { Compiler } = await import('../src/compiler');
    Compiler.init();
  }
};