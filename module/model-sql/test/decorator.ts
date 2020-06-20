import { Class } from '@travetto/registry';
import { TestRegistry, SuiteConfig, TestRegistryUtil } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { PostgreSQLDialect } from '../src/dialects/postgresql/dialect';
import { MySQLDialect } from '../src/dialects/mysql/dialect';
import { SQLDialect } from '../src/dialect';
import { SQLModelSource } from '../src/source';

const args = DependencyRegistry.getOrCreatePending(SQLModelSource)?.dependencies?.cons || [];
args.splice(args.findIndex(x => x.target === SQLDialect), 1);

export function DialectSuite(config: Partial<SuiteConfig> = {}) {

  return function (target: any /* Class<{ service: Promise<ModelService> }> */) {
    const dialects = [PostgreSQLDialect, MySQLDialect];


    for (const el of dialects) {
      const custom = TestRegistryUtil.customizeClass(target as Class, el, 'Dialect');

      TestRegistry.register(custom, {
        beforeEach: [async function (this: any) {
          if (!this.__initialized) {
            this.__initialized = true;
            const dia = await DependencyRegistry.getInstance(el); // Get real instance
            const src = (await this.service).source;
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