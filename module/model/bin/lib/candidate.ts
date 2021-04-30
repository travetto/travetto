import { CliUtil } from '@travetto/cli/src/util';
import { ExecUtil } from '@travetto/boot';

import type { Class } from '@travetto/base';
import type { InjectableConfig } from '@travetto/di';

import type { ModelStorageSupport } from '../../src/service/storage';
import type { ModelType } from '../../src/types/model';

/**
 * Utilities for finding candidates for model operations
 */
export class ModelCandidateUtil {

  /**
   * Get all models
   */
  static async #getModels(models?: string[]) {
    const names = new Set(models ?? []);
    const all = names.has('*');
    const { ModelRegistry } = await import('@travetto/model');
    return ModelRegistry.getClasses()
      .map(x => ModelRegistry.getBaseModel(x))
      .filter(x => !models || all || names.has(ModelRegistry.getStore(x)));
  }

  /**
   * Get model names
   */
  static async getModelNames() {
    const { ModelRegistry } = await import('@travetto/model');
    return (await this.#getModels()).map(x => ModelRegistry.getStore(x)).sort();
  }

  /**
   * Get all providers that are viable candidates
   */
  static async getProviders(op?: keyof ModelStorageSupport): Promise<InjectableConfig[]> {
    const { DependencyRegistry } = await import('@travetto/di');
    const { ModelStorageSupportTarget } = await import('@travetto/model/src/internal/service/common');
    const types = DependencyRegistry.getCandidateTypes<ModelStorageSupport>(ModelStorageSupportTarget as unknown as Class<ModelStorageSupport>);
    return types.filter(x => !op || x.class.prototype[op]);
  }

  /**
   * Get list of names of all viable providers
   */
  static async getProviderNames(op?: keyof ModelStorageSupport) {
    return (await this.getProviders(op))
      .map(x => x.class.name.replace(/ModelService/, ''))
      .sort();
  }

  /**
   * Get a single provider
   */
  static async getProvider(provider: string) {
    const { DependencyRegistry } = await import('@travetto/di');
    const config = (await this.getProviders()).find(x => x.class.name === `${provider}ModelService`)!;
    return DependencyRegistry.getInstance<ModelStorageSupport>(config.class, config.qualifier);
  }

  /**
   * Get candidates asynchronously
   * @returns
   */
  static async getCandidates(op: keyof ModelStorageSupport) {
    return CliUtil.waiting('Resolving', () =>
      ExecUtil.workerMain<{ providers: string[], models: string[] }>(require.resolve('../candidate'), [op]).message
    );
  }

  /**
   * Get resolved instances/classes/configs
   * @param provider
   * @param models
   * @returns
   */
  static async resolve(provider: string, models: string[]): Promise<{ provider: ModelStorageSupport, models: Class<ModelType>[] }> {
    return {
      provider: await this.getProvider(provider),
      models: await this.#getModels(models)
    };
  }
}