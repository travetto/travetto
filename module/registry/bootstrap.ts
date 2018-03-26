export const init = {
  priority: 2,
  action: () => require('./src/service/root/RootRegistry').init()
};