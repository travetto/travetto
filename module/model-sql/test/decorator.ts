import { TestRegistry, SuiteConfig } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';

import { PostgreSQLDialect } from '../extension/postgresql/dialect';
import { MySQLDialect } from '../extension/mysql/dialect';

export function DialectSuite(config: Partial<SuiteConfig> = {}) {

  return function (target: any /*Class<{ service: Promise<ModelService> }>*/) {
    const dialects = [PostgreSQLDialect, MySQLDialect];

    for (const el of dialects) {
      const name = el.name.replace(/Dialect/, '');
      const Temp = class extends target { };
      Temp.__filename = target.__filename;
      Temp.__id = target.__id.replace(/#/, `#${name}`);
      Temp.__abstract = false;

      Object.defineProperty(Temp, 'name', { value: `${name}${target.name}` });

      DependencyRegistry.getOrCreatePending(el).target = el; // Target self

      TestRegistry.register(Temp, {
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
        description: `${name} ${config.description || target.name} Suite`,
      });
    }
  };
}