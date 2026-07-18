import type { ModelStorageSupport, ModelType } from '@travetto/model';
import type { Class } from '@travetto/runtime';

export class ModelInstallUtil {
  static async run(provider: ModelStorageSupport, models: Class<ModelType>[]): Promise<void> {
    if (!provider.upsertModel) {
      throw new Error(`${provider} does not support model installation`);
    }
    for (const cls of models) {
      console.log('Installing', { name: cls.Ⲑid });
      await provider.upsertModel(cls);
    }
  }
}
