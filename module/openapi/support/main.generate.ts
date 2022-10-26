import { PhaseManager } from '@travetto/boot';

export async function main(): Promise<unknown> {
  await PhaseManager.run('init');

  const { DependencyRegistry } = await import('@travetto/di');
  const { OpenApiService } = await import('../src/service');

  const instance = await DependencyRegistry.getInstance(OpenApiService);
  return instance.spec;
}