/**
 * Responsible for initializing the compiler
 */
export const init = {
  key: '@trv:compiler/init',
  after: ['@trv:config/init', '@trv:base/init'],
  action: async () => {
    const { Compiler } = await import('../src/compiler');
    Compiler.init();
  }
};