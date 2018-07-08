export const init = {
  action: async () => {
    const compiler = require('../src/compiler').Compiler;
    await new Promise(res => setTimeout(res, 0));
    return compiler.init();
  },
  priority: 1
};