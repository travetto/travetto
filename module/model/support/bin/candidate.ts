import { toConcrete, Class } from '@travetto/runtime';
import { InjectableCandidate, DependencyRegistryIndex } from '@travetto/di';
import { SchemaRegistryIndex } from '@travetto/schema';

import type { ModelStorageSupport } from '../../src/types/storage.ts';
import type { ModelType } from '../../src/types/model.ts';
import { ModelRegistryIndex } from '../../src/registry/registry-index.ts';

/**
 * Utilities for finding candidates for model operations
 */
export class ModelCandidateUtil {

  static async export(operation: keyof ModelStorageSupport): Promise<{ models: string[], providers: string[] }> {
    return {
      models: await this.getModelNames(),
      providers: await this.getProviderNames(operation)
    };
  }

  /**
   * Get all models
   */
  static async #getModels(models?: string[]): Promise<Class<ModelType>[]> {
    const names = new Set(models ?? []);
    const all = names.has('*');
    return ModelRegistryIndex.getClasses()
      .map(x => SchemaRegistryIndex.getBaseClass(x))
      .filter(x => !models || all || names.has(ModelRegistryIndex.getStoreName(x)));
  }

  /**
   * Get model names
   */
  static async getModelNames(): Promise<string[]> {
    return (await this.#getModels()).map(x => ModelRegistryIndex.getStoreName(x)).toSorted();
  }

  /**
   * Get all providers that are viable candidates
   */
  static async getProviders(operation?: keyof ModelStorageSupport): Promise<InjectableCandidate[]> {
    const types = DependencyRegistryIndex.getCandidates(toConcrete<ModelStorageSupport>());
    return types.filter(x => !operation || x.class.prototype?.[operation]);
  }

  /**
   * Get list of names of all viable providers
   */
  static async getProviderNames(operation?: keyof ModelStorageSupport): Promise<string[]> {
    return (await this.getProviders(operation))
      .map(x => x.class.name.replace(/ModelService/, ''))
      .toSorted();
  }

  /**
   * Get a single provider
   */
  static async getProvider(provider: string): Promise<ModelStorageSupport> {
    const config = (await this.getProviders()).find(x => x.class.name === `${provider}ModelService`)!;
    return DependencyRegistryIndex.getInstance<ModelStorageSupport>(config.candidateType, config.qualifier);
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