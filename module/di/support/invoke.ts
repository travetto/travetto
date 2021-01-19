import { CliUtil } from '@travetto/cli/src/util';

export async function invoke(...[mod, cls, method, qualifier]: (string | undefined)[]) {
  CliUtil.initEnv({});
  await (await import('@travetto/base')).PhaseManager.init();
  const inst = await (await import('../src/registry')).DependencyRegistry
    .getInstance(require(mod!)[cls!], qualifier ? Symbol.for(qualifier) : qualifier as undefined);
  return await (inst as Record<string, () => Promise<unknown>>)[method!]();
}

invoke(...process.argv.slice(2));