// @ts-check
let inst;
exports.handler = async (event, context) => {
  if (!inst) {
    require('@travetto/boot/register');
    await require('@travetto/base').PhaseManager.init();

    const { DependencyRegistry } = require('@travetto/di');
    await DependencyRegistry.init();

    const { RestApplication } = require('@travetto/rest');
    const { RestLambdaSym } = require('@travetto/rest/src/internal/lambda');

    inst = await DependencyRegistry.getInstance(RestApplication, RestLambdaSym);
    await inst.run();
  }
  return inst.handle(event, context);
};