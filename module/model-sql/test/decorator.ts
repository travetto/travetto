import { Class } from '@travetto/registry';
import { TestRegistry, SuiteConfig, TestRegistryUtil } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { PostgreSQLDialect } from '../extension/postgresql/dialect';
import { MySQLDialect } from '../extension/mysql/dialect';

export function DialectSuite(config: Partial<SuiteConfig> = {}) {

  return function (target: any /* Class<{ service: Promise<ModelService> }> */) {
    const dialects = [PostgreSQLDialect, MySQLDialect];

    for (const el of dialects) {
      const custom = TestRegistryUtil.customizeClass(target as Class, el, 'Dialect');

      DependencyRegistry.getOrCreatePending(el).target = el; // Target self

      TestRegistry.register(custom, {
        beforeEach: [async function (this: any) {
          if (!this.__initialized) {
            this.__initialized = true;
            const src = (await this.service).source;
            const dia = await DependencyRegistry.getInstance(el); // Get real instance
            src.dialect = dia;
            await src.postConstruct();
          }
        }],
        ...config,
        description: `${custom.shortName} ${config.description || target.name} Suite`,
      });
    }
  };
}