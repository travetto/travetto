export const init = {
  priority: 0,
  action: () => require('./src/service').Logger._init()
};