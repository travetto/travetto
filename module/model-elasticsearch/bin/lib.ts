import { ElasticsearchModelSource } from '../src/source';

export async function getSchemas() {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.init('bootstrap').run();

  const { DependencyRegistry } = await import('@travetto/di');
  const { ModelRegistry } = await import('@travetto/model');
  const { ModelSource } = await import('@travetto/model');

  const src = (await DependencyRegistry.getInstance<ElasticsearchModelSource>(ModelSource));

  const { ElasticsearchUtil } = await import('../src/util');

  const out: { [key: string]: string } = {};
  for (const cls of ModelRegistry.getClasses()) {
    out[src.getCollectionName(cls)] = ElasticsearchUtil.generateSourceSchema(cls);
  }

  return out;
}