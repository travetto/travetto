export async function getSchemas() {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.init('bootstrap').run();

  const { DependencyRegistry } = await import('@travetto/di');
  const { ModelRegistry } = await import('@travetto/model');
  const { SQLDialect } = await import('../src/dialect');

  const src = (await DependencyRegistry.getInstance(SQLDialect)) as SQLDialect;

  let drops = [];
  let creates = [];

  for (const cls of ModelRegistry.getClasses()) {
    drops.push(...src.getDropAllTablesSQL(cls));
    creates.push(...src.getCreateAllTablesSQL(cls));
  }

  return [...drops, ...creates];
}