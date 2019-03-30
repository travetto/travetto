// @ts-check
let inst;
exports.handler = async (event, context) => {
  if (!inst) {
    await require('@travetto/base/bin/start');

    const { DependencyRegistry } = require('@travetto/di');
    await DependencyRegistry.init();

    const { RestApp } = require('@travetto/rest');
    const server = await DependencyRegistry.getInstance(RestApp);
    await server.run();

    inst = server['app'];
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return new Promise(resolve => inst.handle(event, { ...context, succeed: resolve }));
};