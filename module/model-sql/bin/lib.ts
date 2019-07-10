import { SQLDialect } from '../src/dialect/dialect';

export async function getSchemas() {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.init('bootstrap').run();

  const { DependencyRegistry } = await import('@travetto/di');
  const { ModelRegistry } = await import('@travetto/model');

  const src = (await DependencyRegistry.getInstance<SQLDialect>(SQLDialect));

  let drops = [];
  let creates = [];

  for (const cls of ModelRegistry.getClasses()) {
    drops.push(...src.getDropAllTablesSQL(cls));
    creates.push(...src.getCreateAllTablesSQL(cls));
  }

  return [...drops, ...creates];
}