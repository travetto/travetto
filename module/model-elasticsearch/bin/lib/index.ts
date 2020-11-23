import { ElasticsearchModelService } from '../../src/service';

/**
 * Get all models registered in the application and return as a plain object
 */
export async function getSchemas() {
  const { PhaseManager } = await import('@travetto/base');
  await PhaseManager.init();

  const { DependencyRegistry } = await import('@travetto/di');
  const { ModelRegistry, } = await import('@travetto/model-core');
  const { ModelStorageSupportTarget } = await import('@travetto/model-core/src/internal/service/common');

  const src = (await DependencyRegistry.getInstance<ElasticsearchModelService>(ModelStorageSupportTarget));

  const { ElasticsearchUtil } = await import('../../src/internal/query');

  const out: Record<string, Record<string, string>> = {};
  for (const cls of ModelRegistry.getClasses()) {
    out[src.getStore(cls)] = ElasticsearchUtil.generateSourceSchema(cls);
  }

  return out;
}