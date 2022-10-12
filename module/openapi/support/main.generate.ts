import { ModuleExec } from '@travetto/boot/src/internal/module-exec';

export async function main(): Promise<void> {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init');

  const { DependencyRegistry } = await import('@travetto/di');
  const { OpenApiService } = await import('../src/service');

  const instance = await DependencyRegistry.getInstance(OpenApiService);
  ModuleExec.mainResponse(await instance.spec);
}