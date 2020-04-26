import { ElasticsearchModelSource } from '../src/source';

export async function getSchemas() {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.bootstrap();

  const { DependencyRegistry } = await import('@travetto/di');
  const { ModelRegistry } = await import('@travetto/model');
  const { ModelSource } = await import('@travetto/model');

  const src = (await DependencyRegistry.getInstance<ElasticsearchModelSource>(ModelSource));

  const { ElasticsearchUtil } = await import('../src/util');

  const out: Record<string, Record<string, string>> = {};
  for (const cls of ModelRegistry.getClasses()) {
    out[src.getCollectionName(cls)] = ElasticsearchUtil.generateSourceSchema(cls);
  }

  return out;
}