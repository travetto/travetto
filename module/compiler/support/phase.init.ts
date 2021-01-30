/**
 * Responsible for initializing the compiler
 */
export const init = {
  key: '@trv:compiler/init',
  after: ['@trv:config/init', '@trv:base/init'],
  action: async () => {
    const { AppCache, SourceIndex, TranspileUtil } = await import('@travetto/boot');

    // Ensure all support files are pre-compiled
    for (const x of SourceIndex.find({ folder: 'support' })) {
      if (!AppCache.hasEntry(x.file)) {
        TranspileUtil.transpile(x.file); // Transpile all the desired files
      }
    }

    const { Compiler } = await import('../src/compiler');
    Compiler.init();
  }
};