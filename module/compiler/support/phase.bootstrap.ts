export const init = {
  action: async () => {
    const compiler = require('../src/compiler').Compiler;
    await new Promise(r => setTimeout(r, 0));
    const res = compiler.init();
    return res;
  },
  priority: 1
};