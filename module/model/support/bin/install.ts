import type { Class } from '@travetto/runtime';
import type { ModelStorageSupport, ModelType } from '@travetto/model';

export class ModelInstallUtil {
  static async run(provider: ModelStorageSupport, models: Class<ModelType>[]): Promise<void> {
    if (!provider.createModel) {
      throw new Error(`${provider} does not support model installation`);
    }
    for (const cls of models) {
      console.log('Installing', { name: cls.Ⲑid });
      await provider.createModel(cls);
    }
  }
}