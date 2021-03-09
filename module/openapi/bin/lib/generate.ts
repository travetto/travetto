import { CliUtil } from '@travetto/cli/src/util';

export async function main() {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init');

  const { DependencyRegistry } = await import('@travetto/di');
  const { OpenApiService } = await import('../../src/service');

  const instance = await DependencyRegistry.getInstance(OpenApiService);
  const spec = await instance.spec;
  CliUtil.pluginResponse(spec);
}