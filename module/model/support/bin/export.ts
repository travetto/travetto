import type { Class } from '@travetto/runtime';
import type { ModelStorageSupport, ModelType } from '@travetto/model';

export class ModelExportUtil {
  static async run(provider: ModelStorageSupport, models: Class<ModelType>[]): Promise<void> {
    for (const model of models) {
      console.log(await provider.exportModel!(model));
    }
  }
}