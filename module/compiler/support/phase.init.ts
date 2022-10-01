/**
 * Responsible for initializing the compiler
 */
export const step = {
  key: '@trv:compiler/init',
  after: ['@trv:base/init'],
  before: ['@trv:base/transpile'],
  active: async (): Promise<boolean> => import('@travetto/boot').then(mod => !mod.EnvUtil.isCompiled()),
  action: async (): Promise<void> => {
    // Overrides the require behavior
    const { Compiler } = await import('../src/compiler');
    await Compiler.init();
  }
};