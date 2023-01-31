import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { OpenApiService } from '../../src/service';

export async function main(): Promise<unknown> {
  await RootRegistry.init();

  const instance = await DependencyRegistry.getInstance(OpenApiService);
  return instance.spec;
}