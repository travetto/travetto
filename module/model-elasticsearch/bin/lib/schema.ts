import { ElasticsearchModelService } from '../../src/service';

/**
 * Get all models registered in the application and return as a plain object
 */
export async function getSchemas() {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.run('init');

  const { DependencyRegistry } = await import('@travetto/di');
  const { ModelRegistry, } = await import('@travetto/model');
  const { ModelStorageSupportTarget } = await import('@travetto/model/src/internal/service/common');

  const src = (await DependencyRegistry.getInstance<ElasticsearchModelService>(ModelStorageSupportTarget));

  const { ElasticsearchSchemaUtil } = await import('../../src/internal/schema');

  const out: Record<string, Record<string, any>> = {};
  for (const cls of ModelRegistry.getClasses()) {
    out[src.manager.getStore(cls)] = ElasticsearchSchemaUtil.generateSourceSchema(cls);
  }

  return out;
}