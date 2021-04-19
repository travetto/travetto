import { ExecUtil } from '@travetto/boot';

export async function main() {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init');

  const { DependencyRegistry } = await import('@travetto/di');
  const { OpenApiService } = await import('../src/service');

  const instance = await DependencyRegistry.getInstance(OpenApiService);
  ExecUtil.mainResponse(await instance.spec);
}