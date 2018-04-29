export const init = {
  priority: 0,
  action: () => require('./src/service/loader').ConfigLoader.initialize()
}