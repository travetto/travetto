import { ShutdownManager } from '@travetto/boot';
import { Class } from '@travetto/base';
import type { ModelStorageSupport } from '@travetto/model/src/service/storage';
import type { ModelType } from '@travetto/model/src/types/model';

export class ModelInstallUtil {
  static async run(provider: ModelStorageSupport, models: Class<ModelType>[]): Promise<void> {
    if (!provider.createModel) {
      throw new Error(`${provider} does not support model installation`);
    }
    for (const m of models) {
      console.log('Installing', { name: m.Ⲑid });
      await provider.createModel(m);
    }
    ShutdownManager.execute(-1); // Release database
  }
}