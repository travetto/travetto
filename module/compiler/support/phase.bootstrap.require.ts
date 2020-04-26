export const init = {
  key: 'require-all',
  after: ['compile-all'],
  action: async () => {
    const { Compiler } = await import('@travetto/compiler');
    Compiler.getRootFiles().forEach(require); // Scan all files as compiler source root
  }
};