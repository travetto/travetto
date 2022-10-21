export async function main(): Promise<unknown> {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init');

  const { DependencyRegistry } = await import('@travetto/di');
  const { OpenApiService } = await import('../src/service');

  const instance = await DependencyRegistry.getInstance(OpenApiService);
  return instance.spec;
}