export const init = {
  action: () => {
    return require('../src/compiler').Compiler.init();
  },
  priority: 1
};