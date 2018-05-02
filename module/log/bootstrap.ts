export const init = {
  priority: 0,
  action: () => require('./src/service').Logger.listen(
    require('./src/layout/console')()
  )
};