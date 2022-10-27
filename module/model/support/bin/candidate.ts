import { Class, ExecUtil } from '@travetto/base';
import { CliUtil } from '@travetto/cli';
import { ModelRegistry } from '@travetto/model';
import { InjectableConfig, DependencyRegistry } from '@travetto/di';
import { ModelStorageSupportTarget } from '@travetto/model/src/internal/service/common';

import type { ModelStorageSupport } from '../../src/service/storage';
import type { ModelType } from '../../src/types/model';

type CandidateNames = { providers: string[], models: string[] };

/**
 * Utilities for finding candidates for model operations
 */
export class ModelCandidateUtil {

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
    return (await this.#getModels()).map(x => ModelRegistry.getStore(x)).sort();
  }

  /**
   * Get all providers that are viable candidates
   */
  static async getProviders(op?: keyof ModelStorageSupport): Promise<InjectableConfig[]> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const types = DependencyRegistry.getCandidateTypes<ModelStorageSupport>(ModelStorageSupportTarget as unknown as Class<ModelStorageSupport>);
    return types.filter(x => !op || x.class.prototype[op]);
  }

  /**
   * Get list of names of all viable providers
   */
  static async getProviderNames(op?: keyof ModelStorageSupport): Promise<string[]> {
    return (await this.getProviders(op))
      .map(x => x.class.name.replace(/ModelService/, ''))
      .sort();
  }

  /**
   * Get a single provider
   */
  static async getProvider(provider: string): Promise<ModelStorageSupport> {
    const config = (await this.getProviders()).find(x => x.class.name === `${provider}ModelService`)!;
    return DependencyRegistry.getInstance<ModelStorageSupport>(config.class, config.qualifier);
  }

  /**
   * Get candidates asynchronously
   * @returns
   */
  static async getCandidates(op: keyof ModelStorageSupport): Promise<CandidateNames> {
    return CliUtil.waiting('Resolving', () =>
      ExecUtil.worker<CandidateNames>(`${__source.folder}/../candidate`, [op]).message
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