export const init = {
  key: 'compiler',
  after: ['config', 'base'],
  action: async () => {
    const { Compiler } = await import('../src/compiler');
    Compiler.init();
  }
};