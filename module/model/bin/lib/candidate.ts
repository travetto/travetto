import { CliUtil } from '@travetto/cli/src/util';
import { ExecUtil } from '@travetto/boot';

import type { Class } from '@travetto/base';
import type { InjectableConfig } from '@travetto/di';

import type { ModelStorageSupport } from '../../src/service/storage';
import type { ModelType } from '../../src/types/model';

/**
 * Utilities for finding candidates for model operations
 */
export class CliModelCandidateUtil {

  /**
   * Get all models
   */
  private static async getModels(models?: string[]) {
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
  private static async getModelNames() {
    const { ModelRegistry } = await import('@travetto/model');
    return (await this.getModels()).map(x => ModelRegistry.getStore(x)).sort();
  }

  /**
   * Get all providers that are viable candidates
   */
  private static async getProviders(): Promise<InjectableConfig[]> {
    const { DependencyRegistry } = await import('@travetto/di');
    const { ModelStorageSupportTarget } = await import('@travetto/model/src/internal/service/common');
    const types = DependencyRegistry.getCandidateTypes<ModelStorageSupport>(ModelStorageSupportTarget as unknown as Class<ModelStorageSupport>);
    return types;
  }

  private static async getProviderNames() {
    return (await this.getProviders())
      .map(x => x.class.name.replace(/ModelService/, ''))
      .sort();
  }

  /**
   * Initialize
   */
  private static async init() {
    CliUtil.initEnv({ watch: false });
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');
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
  static async getCandidates() {
    return CliUtil.waiting('Compiling', () =>
      ExecUtil.workerEntry<{ providers: string[], models: string[] }>(__filename, ['build'], {
        env: { TRV_WATCH: '0' }
      }).message
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
      models: await this.getModels(models)
    };
  }

  /**
   * Handles plugin response
   */
  static async run() {
    try {
      await this.init();
      CliUtil.pluginResponse({
        models: await this.getModelNames(),
        providers: await this.getProviderNames()
      });
    } catch (err) {
      CliUtil.pluginResponse(err);
    }
  }
}

export function entry(...args: string[]) {
  CliModelCandidateUtil.run();
}