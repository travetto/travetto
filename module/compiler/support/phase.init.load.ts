/**
 * Responsible for loading all available modules
 */
export const init = {
  key: '@trv:compiler/load',
  after: ['@trv:compiler/compile'],
  action: async () => {
    const { Compiler } = await import('../src/compiler');
    for (const file of Compiler.getRootFiles()) {
      require(file); // Scan all files as compiler source root
    }
  }
};