import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { Suite } from '@travetto/test';

import { ModelIndexedSuite } from '@travetto/model-indexed/support/test/indexed.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';
import { ModelIndexedPolymorphismSuite } from '@travetto/model-indexed/support/test/polymorphism.ts';

import { PostgreSQLDialect } from '../src/dialect.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(ctx: AsyncContext, config: SQLModelConfig) {
    return new PostgreSQLDialect(ctx, config);
  }
}

@WithSuiteContext()
@Suite()
class PostgreSQLIndexedSuite extends ModelIndexedSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}

@WithSuiteContext()
@Suite()
class PostgreSQLIndexedPolymorphicSuite extends ModelIndexedPolymorphismSuite {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;
}