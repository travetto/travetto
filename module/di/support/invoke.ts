import { EnvInit } from '@travetto/base/bin/init';

export async function invoke(...[mod, cls, method, qualifier]: (string | undefined)[]): Promise<unknown> {
  EnvInit.init();
  await (await import('@travetto/base')).PhaseManager.run('init');
  const inst = await (await import('../src/registry')).DependencyRegistry
    .getInstance(
      (await import(mod!))[cls!],
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      qualifier ? Symbol.for(qualifier) : qualifier as undefined
    );
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return await (inst as Record<string, () => Promise<unknown>>)[method!]();
}

invoke(...process.argv.slice(2));