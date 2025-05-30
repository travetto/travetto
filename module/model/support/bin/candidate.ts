import { toConcrete, Class } from '@travetto/runtime';
import { InjectableConfig, DependencyRegistry } from '@travetto/di';

import { ModelRegistry } from '../../src/registry/model.ts';
import type { ModelStorageSupport } from '../../src/types/storage.ts';
import type { ModelType } from '../../src/types/model.ts';

/**
 * Utilities for finding candidates for model operations
 */
export class ModelCandidateUtil {

  static async export(op: keyof ModelStorageSupport): Promise<{ models: string[], providers: string[] }> {
    return {
      models: await this.getModelNames(),
      providers: await this.getProviderNames(op)
    };
  }

  /**
   * Get all models
   */
  static async #getModels(models?: string[]): Promise<Class<ModelType>[]> {
    const names = new Set(models ?? []);
    const all = names.has('*');
    return ModelRegistry.getClasses()
      .map(x => ModelRegistry.getBaseModel(x))
      .filter(x => !models || all || names.has(ModelRegistry.getStore(x)));
  }

  /**
   * Get model names
   */
  static async getModelNames(): Promise<string[]> {
    return (await this.#getModels()).map(x => ModelRegistry.getStore(x)).toSorted();
  }

  /**
   * Get all providers that are viable candidates
   */
  static async getProviders(op?: keyof ModelStorageSupport): Promise<InjectableConfig[]> {
    const types = DependencyRegistry.getCandidateTypes(toConcrete<ModelStorageSupport>());
    return types.filter(x => !op || x.class.prototype?.[op]);
  }

  /**
   * Get list of names of all viable providers
   */
  static async getProviderNames(op?: keyof ModelStorageSupport): Promise<string[]> {
    return (await this.getProviders(op))
      .map(x => x.class.name.replace(/ModelService/, ''))
      .toSorted();
  }

  /**
   * Get a single provider
   */
  static async getProvider(provider: string): Promise<ModelStorageSupport> {
    const config = (await this.getProviders()).find(x => x.class.name === `${provider}ModelService`)!;
    return DependencyRegistry.getInstance<ModelStorageSupport>(config.class, config.qualifier);
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