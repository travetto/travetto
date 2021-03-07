/**
 * Responsible for initializing the compiler
 */
export const init = {
  key: '@trv:compiler/init',
  after: ['@trv:config/init', '@trv:base/init'],
  action: async () => {
    const { AppCache } = await import('@travetto/boot');
    const { SourceCodeIndex } = await import('@travetto/boot/src/internal/code');
    const { CompileUtil } = await import('@travetto/boot/src/internal/compile');

    // Ensure all support files are pre-compiled
    for (const x of SourceCodeIndex.find({ folder: 'support' })) {
      if (!AppCache.hasEntry(x.file)) {
        CompileUtil.transpile(x.file); // Transpile all the desired files
      }
    }

    // Overrides the require behavior
    const { Compiler } = await import('../src/compiler');
    await Compiler.init();
  }
};