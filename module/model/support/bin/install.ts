import type { Class } from '@travetto/runtime';
import type { ModelStorageSupport } from '@travetto/model/src/service/storage.ts';
import type { ModelType } from '@travetto/model/src/types/model.ts';

export class ModelInstallUtil {
  static async run(provider: ModelStorageSupport, models: Class<ModelType>[]): Promise<void> {
    if (!provider.createModel) {
      throw new Error(`${provider} does not support model installation`);
    }
    for (const m of models) {
      console.log('Installing', { name: m.Ⲑid });
      await provider.createModel(m);
    }
  }
}