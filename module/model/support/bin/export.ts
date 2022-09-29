import type { Class } from '@travetto/base';
import type { ModelStorageSupport } from '@travetto/model/src/service/storage';
import type { ModelType } from '@travetto/model/src/types/model';

export class ModelExportUtil {
  static async run(provider: ModelStorageSupport, models: Class<ModelType>[]): Promise<void> {
    for (const model of models) {
      console.log(await provider.exportModel!(model));
    }
  }
}