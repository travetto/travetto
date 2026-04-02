import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { Suite } from '@travetto/test';

import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

import { SqliteDialect } from '../src/dialect.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new SqliteDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
class SqliteIndexedSuite extends ModelIndexedSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
  supportsDeepIndexes = false;
}

@WithSuiteContext()
@Suite()
class SqliteIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}