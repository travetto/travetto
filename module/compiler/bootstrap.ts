export const init = {
  action: () => require('./src/compiler').Compiler.init(process.cwd()),
  priority: 1
};