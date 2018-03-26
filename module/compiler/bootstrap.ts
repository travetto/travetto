export const init = {
  action: () => require('./src/compiler').init(process.cwd()),
  priority: 1
};