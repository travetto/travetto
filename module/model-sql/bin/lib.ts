// TODO: Document
export async function getSchemas(clear = true) {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.bootstrap();

  const { DependencyRegistry } = await import('@travetto/di');
  const { ModelRegistry } = await import('@travetto/model');
  const { SQLDialect } = await import('../src/dialect');

  const src = (await DependencyRegistry.getInstance(SQLDialect)) as any;

  const drops = [];
  const creates = [];

  for (const cls of ModelRegistry.getClasses()) {
    if (clear) {
      drops.push(...src.getDropAllTablesSQL(cls));
    }
    creates.push(...src.getCreateAllTablesSQL(cls));
    creates.push(...src.getCreateAllIndicesSQL(cls, ModelRegistry.get(cls).indices));
  }

  return [...drops, ...creates];
}