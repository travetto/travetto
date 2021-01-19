import { CliUtil } from '@travetto/cli/src/util';

import type { Class } from '@travetto/base';
import type { InjectableConfig } from '@travetto/di';
import type { ModelStorageSupport } from '../../src/service/storage';

/**
 * Utilities for supporting the model cli for intall and exporting of schemas
 */
export class ModelCliUtil {

  /**
   * Initialize
   */
  static async init(env: string) {
    CliUtil.initEnv({ watch: false, env });
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init();
  }

  /**
   * Get all providers that are viable candidates
   */
  static async getProviders(): Promise<InjectableConfig<ModelStorageSupport>[]> {
    const { DependencyRegistry } = await import('@travetto/di');
    const { ModelStorageSupportTarget } = await import('@travetto/model/src/internal/service/common');
    const types = DependencyRegistry.getCandidateTypes<ModelStorageSupport>(ModelStorageSupportTarget as unknown as Class<ModelStorageSupport>);
    return types;
  }

  /**
   * Get a single provider
   */
  static async getProvider(cls: Class<ModelStorageSupport>, qualifier?: symbol) {
    const { DependencyRegistry } = await import('@travetto/di');
    return DependencyRegistry.getInstance(cls, qualifier);
  }
}