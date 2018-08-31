let inst;
exports.handler = async (event, context) => {
  if (!inst) {
    const mgr = require('@travetto/base/bin/bootstrap');
    await mgr.run();

    const { DependencyRegistry } = require('@travetto/di');
    await DependencyRegistry.init();

    const { RestApp } = require('@travetto/rest');
    const app = await DependencyRegistry.getInstance(RestApp)
    await app.run();

    inst = app.app;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return new Promise(resolve => inst.handle(event, { ...context, succeed: resolve }));
};