import { RootRegistry } from '@travetto/registry';

import { DependencyRegistry } from '../src/registry';

export async function main(...[mod, cls, method, qualifier]: (string | undefined)[]): Promise<unknown> {
  await RootRegistry.init();

  const tgt = (await import(mod!))[cls!];

  const inst = await DependencyRegistry.getInstance(
    tgt,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    qualifier ? Symbol.for(qualifier) : qualifier as undefined
  );
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return await (inst as Record<string, () => Promise<unknown>>)[method!]();
}