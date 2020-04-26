export const init = {
  key: 'require-all',
  after: ['compile-all'],
  action: async () => {
    const { Compiler } = await import('@travetto/compiler');
    for (const file of Compiler.getRootFiles()) {
      require(file); // Scan all files as compiler source root
    }
  }
};