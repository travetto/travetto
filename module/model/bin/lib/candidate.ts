import { CliUtil } from '@travetto/cli/src/util';
import { ExecUtil } from '@travetto/boot/src';

import type { ModelStorageSupport } from '../../src/service/storage';
import type { Class } from '@travetto/base';

/**
 * Utilities for finding candidates for model operations
 */
export class CliModelCandidateUtil {

  /**
   * Get all models
   */
  private static async getModels() {
    const { ModelRegistry } = await import('@travetto/model');
    return ModelRegistry.getClasses()
      .map(x => ModelRegistry.getBaseModel(x))
      .map(x => ModelRegistry.getStore(x))
      .sort();
  }

  /**
   * Get all providers that are viable candidates
   */
  private static async getProviders(): Promise<string[]> {
    const { DependencyRegistry } = await import('@travetto/di');
    const { ModelStorageSupportTarget } = await import('@travetto/model/src/internal/service/common');
    const types = DependencyRegistry.getCandidateTypes<ModelStorageSupport>(ModelStorageSupportTarget as unknown as Class<ModelStorageSupport>);
    return types
      .map(x => x.qualifier.toString().split(/[()]/)[1]
        .replace(/@trv:(.*?)(?:\/.*)$/, (a, b) => b)
      )
      .filter(x => x !== 'undefined')
      .sort();
  }

  /**
   * Initialize
   */
  private static async init() {
    CliUtil.initEnv({ watch: false });
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init();
  }

  /**
   * Get a single provider
   */
  static async getProvider(qualifier?: symbol) {
    const { DependencyRegistry } = await import('@travetto/di');
    const { ModelStorageSupportTarget } = await import('@travetto/model/src/internal/service/common');
    return DependencyRegistry.getInstance(ModelStorageSupportTarget, qualifier);
  }

  static async getCandidates() {
    return CliUtil.waiting('Compiling', () =>
      ExecUtil.worker<{ providers: string[], models: string[] }>(require.resolve('../plugin-candidates'), ['build'], {
        env: { TRV_WATCH: '0' }
      }).message
    );
  }

  /**
   * Handles plugin response
   */
  static async run() {
    try {
      await this.init();
      CliUtil.pluginResponse({
        models: await this.getModels(),
        providers: await this.getProviders()
      });
    } catch (err) {
      CliUtil.pluginResponse(err);
    }
  }
}