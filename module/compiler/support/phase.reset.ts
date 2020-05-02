/**
 * Responsible for resetting the compiler
 */
export const init = {
  key: 'compiler',
  action: async () => {
    const { Compiler } = await import('../src/compiler');
    Compiler.reset();
  }
};