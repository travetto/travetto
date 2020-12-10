// @ts-check
let inst;
exports.handler = async (event, context) => {
  if (!inst) {
    require('@travetto/boot/register');
    await require('@travetto/base').PhaseManager.init();

    const { DependencyRegistry } = require('@travetto/di');
    await DependencyRegistry.init();

    const { RestServer } = require('@travetto/rest');
    const { RestLambdaSymbol } = require('@travetto/rest/src/internal/lambda');

    inst = await DependencyRegistry.getInstance(RestServer, RestLambdaSymbol);
    await inst.run();
  }
  return inst.handle(event, context);
};