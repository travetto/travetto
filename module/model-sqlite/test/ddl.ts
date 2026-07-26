import assert from 'node:assert';

import { Model, TransientField } from '@travetto/model';
import { SQLModelSchemaUtil } from '@travetto/model-sql';
import { Required } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

import { SqliteDialect } from '../src/dialect.ts';

@Model()
class SimpleModel {
  id: string;
  @Required()
  requiredField: string;
  optionalField?: string;
  @TransientField()
  transientField: string;
}

@Model({ discriminator: 'type' })
abstract class BasePolymorphic {
  id: string;
  type: string;
  @Required()
  sharedRequired: string;
}

@Model()
class SubTypeA extends BasePolymorphic {
  @Required()
  subTypeAOnlyRequired: string;
}

@Suite()
export class SqliteDDLSuite {
  @Test('Verify DDL column nullability')
  async testDDLNullability() {
    const dialect = new SqliteDialect();

    const simpleContext = { tableName: 'simple_model', ...SQLModelSchemaUtil.getSchemaContext(SimpleModel) };
    const simpleSQL = dialect.getCreateTableSQL(simpleContext);

    assert(simpleSQL.includes('"requiredField" TEXT NOT NULL'));
    assert(
      simpleSQL.includes('"optionalField" TEXT,\n') ||
        simpleSQL.includes('"optionalField" TEXT,') ||
        !simpleSQL.includes('"optionalField" TEXT NOT NULL')
    );
    assert(!simpleSQL.includes('"transientField" TEXT NOT NULL'));

    const polyContext = { tableName: 'base_polymorphic', ...SQLModelSchemaUtil.getSchemaContext(BasePolymorphic) };
    const polySQL = dialect.getCreateTableSQL(polyContext);

    assert(polySQL.includes('"sharedRequired" TEXT NOT NULL'));
    assert(!polySQL.includes('"subTypeAOnlyRequired" TEXT NOT NULL'));
  }
}
