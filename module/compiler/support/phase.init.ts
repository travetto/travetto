/**
 * Responsible for initializing the compiler
 */
export const init = {
  key: '@trv:compiler/init',
  after: ['@trv:base/init'],
  before: ['@trv:base/transpile'],
  action: async () => {
    // Overrides the require behavior
    const { Compiler } = await import('../src/compiler');
    await Compiler.init();
  }
};