export const init = {
  key: 'compile-all',
  after: ['compiler'],
  action: async () => {
    const { CompilerUtil } = await import('@travetto/compiler');
    CompilerUtil.findAllUncompiledFiles().forEach(require); // Compile all uncompiled files
  }
};