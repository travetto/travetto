import type { Class } from '@travetto/runtime';
import type { ModelStorageSupport } from '@travetto/model/src/service/storage.ts';
import type { ModelType } from '@travetto/model/src/types/model.ts';

export class ModelExportUtil {
  static async run(provider: ModelStorageSupport, models: Class<ModelType>[]): Promise<void> {
    for (const model of models) {
      console.log(await provider.exportModel!(model));
    }
  }
}