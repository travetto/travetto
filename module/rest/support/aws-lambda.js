// @ts-check
let inst;
exports.handler = async (event, context) => {
  if (!inst) {
    require('@travetto/boot/register');
    await require('@travetto/base').PhaseManager.init();

    const { DependencyRegistry } = require('@travetto/di');
    await DependencyRegistry.init();

    const { RestServer } = require('@travetto/rest');
    inst = await DependencyRegistry.getInstance(RestServer, Symbol.for('@trv:rest/aws-lambda'));
    await inst.run();
  }
  return inst.handle(event, context);
};