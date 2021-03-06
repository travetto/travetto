/**
 * Responsible for resetting the compiler
 */
export const init = {
  key: '@trv:compiler/reset',
  action: async () => {
    const { Compiler } = await import('../src/compiler');
    Compiler.reset();
  }
};