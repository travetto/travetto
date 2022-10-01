/**
 * Responsible for resetting the compiler
 */
export const step = {
  key: '@trv:compiler/reset',
  action: async (): Promise<void> => {
    const { Compiler } = await import('../src/compiler');
    Compiler.reset();
  }
};