import { PhaseManager } from '@travetto/boot';
import { DependencyRegistry } from '@travetto/di';

import { OpenApiService } from '../src/service';

export async function main(): Promise<unknown> {
  await PhaseManager.run('init');

  const instance = await DependencyRegistry.getInstance(OpenApiService);
  return instance.spec;
}