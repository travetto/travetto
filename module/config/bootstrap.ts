export const init = {
  priority: 0,
  action: () => require('./src/service/config-loader').ConfigLoader.initialize()
}