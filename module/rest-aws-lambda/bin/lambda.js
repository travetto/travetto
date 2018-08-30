let inst;
exports.handler = async (event, context) => {
  if (!inst) {
    const mgr = require('@travetto/base/bin/bootstrap');
    await mgr.run();
    const { DependencyRegistry } = require('@travetto/di');
    const { AwsLambdaAppProvider } = require('../src');
    await DependencyRegistry.init();
    inst = await DependencyRegistry.getInstance(AwsLambdaAppProvider)
  }
  inst.handle(event, context);
};