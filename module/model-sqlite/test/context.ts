import assert from 'node:assert';

import type { AsyncContext } from '@travetto/context';
import { InjectableFactory } from '@travetto/di';
import { Model, NotFoundError } from '@travetto/model';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';
import { SqliteDialect } from '@travetto/model-sqlite';
import { RuntimeError } from '@travetto/runtime';
import { Suite, Test } from '@travetto/test';

import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

class Config {
  @InjectableFactory({ primary: true })
  static getDialect(context: AsyncContext, config: SQLModelConfig): SqliteDialect {
    return new SqliteDialect(context, config);
  }
}

@Model()
class ContextTestModel {
  id: string;
  name: string;
}

@Suite()
export class SqliteContextRequirementTest extends BaseModelSuite<SQLModelService> {
  serviceClass = SQLModelService;
  configClass = SQLModelConfig;

  @Test()
  async testReadWithoutContext(): Promise<void> {
    const service = await this.service;
    // Calling get without active context should not throw "Context not initialized".
    // Instead it should run with active connection and throw a standard NotFoundError.
    await assert.rejects(() => service.get(ContextTestModel, 'missing-id'), NotFoundError);
  }

  @Test()
  async testTransactionWithoutContext(): Promise<void> {
    const service = await this.service;
    // Calling create (which is @Transactional) without active context should throw
    // a RuntimeError "Context not initialized" because it attempts to use a transaction.
    await assert.rejects(
      () => service.create(ContextTestModel, { name: 'test' }),
      (error: unknown) => error instanceof RuntimeError && error.message.includes('Context not initialized')
    );
  }
}
