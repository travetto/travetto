/**
 * Grab all models and generate the CREATE TABLE expression for each one
 */
export async function getSchemas(clear = true) {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.init();

  const { DependencyRegistry } = await import('@travetto/di');
  const { ModelRegistry } = await import('@travetto/model-core');
  const { SQLDialect } = await import('../../src/dialect/base');

  const src = (await DependencyRegistry.getInstance(SQLDialect));

  const drops = [];
  const creates = [];

  for (const cls of ModelRegistry.getClasses()) {
    if (clear) {
      drops.push(...src.getDropAllTablesSQL(cls));
    }
    creates.push(...src.getCreateAllTablesSQL(cls));
    creates.push(...src.getCreateAllIndicesSQL(cls, ModelRegistry.get(cls).indices!));
  }

  return [...drops, ...creates];
}