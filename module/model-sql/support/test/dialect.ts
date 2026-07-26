import assert from 'node:assert';

import { Model, type ModelType, TransientField } from '@travetto/model';
import { Registry } from '@travetto/registry';
import type { Class } from '@travetto/runtime';
import { DiscriminatorField, Required, Schema } from '@travetto/schema';
import { BeforeAll, Suite, Test } from '@travetto/test';

import type { AbstractANSI99Dialect } from '../../src/dialect.ts';
import { SQLModelSchemaUtil } from '../../src/schema.ts';
import type { TableContext } from '../../src/types.ts';

@Schema()
class ChildItem {
  name: string;
  age: number;
  active: boolean;
  createdDate: Date;
}

@Model('dialect_gap_parent')
class ParentModel {
  id: string;
  title: string;
  child: ChildItem;
}

@Schema()
@Model('dialect_gap_simple')
class SimpleModel {
  id: string;
  @Required()
  requiredField: string;
  optionalField?: string;
  @TransientField()
  transientField: string;
}

@Schema()
@Model('dialect_gap_base_poly')
abstract class BasePolymorphic {
  id: string;
  @DiscriminatorField()
  type: string;
  @Required()
  sharedRequired: string;
}

@Schema()
@Model('dialect_gap_sub_a')
class SubTypeA extends BasePolymorphic {
  @Required()
  subTypeAOnlyRequired: string;
}

function getTableContext<T extends ModelType>(modelClass: Class<T>): TableContext<T> {
  return {
    tableName: modelClass.name.toLowerCase(),
    ...SQLModelSchemaUtil.getSchemaContext(modelClass)
  };
}

@Suite({ skip: true })
export abstract class BaseSQLDialectSuite {
  abstract dialect: AbstractANSI99Dialect;

  @BeforeAll()
  async setup() {
    await Registry.init();
    SQLModelSchemaUtil.SCHEMA_CACHE.clear();
  }

  @Test('Verify DDL column nullability')
  async testDDLNullability() {
    const dialect = this.dialect;
    const quote = dialect.escapeIdentifier('').substring(0, 1) || '"';

    const simpleContext = getTableContext(SimpleModel);
    const simpleSQL = dialect.getCreateTableSQL(simpleContext);

    const requiredLine = simpleSQL.split('\n').find(line => line.includes(`${quote}requiredField${quote}`));
    assert(requiredLine?.includes('NOT NULL'));

    const optionalLine = simpleSQL.split('\n').find(line => line.includes(`${quote}optionalField${quote}`));
    if (optionalLine) {
      assert(!optionalLine.includes('NOT NULL'));
    }

    const transientLine = simpleSQL.split('\n').find(line => line.includes(`${quote}transientField${quote}`));
    if (transientLine) {
      assert(!transientLine.includes('NOT NULL'));
    }

    const polyContext = getTableContext(BasePolymorphic);
    const polySQL = dialect.getCreateTableSQL(polyContext);

    const sharedRequiredLine = polySQL.split('\n').find(line => line.includes(`${quote}sharedRequired${quote}`));
    assert(sharedRequiredLine?.includes('NOT NULL'));

    const subTypeLine = polySQL.split('\n').find(line => line.includes(`${quote}subTypeAOnlyRequired${quote}`));
    if (subTypeLine) {
      assert(!subTypeLine.includes('NOT NULL'));
    }
  }

  @Test()
  async testFormatJsonPathEscaping() {
    const simpleJsonPath = this.dialect.formatJsonPath(['child', 'age']);
    assert(simpleJsonPath === 'child.age');

    const complexJsonPath = this.dialect.formatJsonPath(['child', 'first name']);
    assert(complexJsonPath === 'child."first name"');
  }

  @Test()
  async testPartialUpdateSetsWithoutRegex() {
    const tableContext = getTableContext(ParentModel);
    const quote = this.dialect.escapeIdentifier('').substring(0, 1) || '"';
    const placeholder = this.dialect.getPlaceholder(1);

    const { sets, values } = this.dialect.compilePartialUpdate(tableContext, { title: 'Updated Title' });
    assert.deepStrictEqual(sets, [`${quote}title${quote} = ${placeholder}`]);
    assert.deepStrictEqual(values, ['Updated Title']);
  }
}
