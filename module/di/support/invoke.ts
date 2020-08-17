import { CliUtil } from '@travetto/cli/src/util';

export async function invoke(...[mod, cls, method, qualifier]: string[]) {
  CliUtil.initAppEnv({});
  await (await import('@travetto/base')).PhaseManager.init();
  const inst = await (await import('../src/registry')).DependencyRegistry
    .getInstance<any>(require(mod)[cls], qualifier ? Symbol.for(qualifier) : qualifier as any);
  return await inst[method]();
}

invoke(...process.argv.slice(2));