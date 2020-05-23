// @ts-check
let inst;
exports.handler = async (event, context) => {
  if (!inst) {
    await require('@travetto/boot/bin/init')
      .libRequire('@travetto/base')
      .PhaseManager.init();

    const { DependencyRegistry } = require('@travetto/di');
    await DependencyRegistry.init();

    const { RestServer } = require('@travetto/rest');
    const server = await DependencyRegistry.getInstance(RestServer);
    await server.run();

    inst = server['app'];
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return new Promise(resolve => inst.handle(event, { ...context, succeed: resolve }));
};