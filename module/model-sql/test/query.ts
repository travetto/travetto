import * as assert from 'assert';

import { Schema, SchemaRegistry, FieldConfig } from '@travetto/schema';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { WhereClause } from '@travetto/model/';

import { VisitStack } from '../src/util';

import { ModelRegistry } from '@travetto/model/src/registry';
import { DependencyRegistry } from '@travetto/di';
import { SQLDialect } from '../src/dialect';

// tslint:disable-next-line: no-import-side-effect
import './dialect';

@Schema()
class User {
  id: string;
  name: string;
}

@Schema()
class WhereTypeAB {
  c: number;
}

@Schema()
class WhereTypeA {
  d: number;
  b: WhereTypeAB;
}

@Schema()
class WhereTypeD {
  e: boolean;
}

@Schema()
class WhereTypeG {
  z: string[];
}

@Schema()
class WhereType {
  a: WhereTypeA[];
  d: WhereTypeD;
  g: WhereTypeG;
  name: number;
  age: number;
}

@Suite()
export class QueryTest {

  @BeforeAll()
  async beforeAll() {
    await SchemaRegistry.init();
    await ModelRegistry.init();
    await DependencyRegistry.init();
  }

  @Test()
  async validateQuery() {
    const qry: WhereClause<WhereType> = {
      $and: [
        { a: { b: { c: 5 } } },
        { d: { e: true } },
        {
          $or: [{ name: 5 }, { age: 10 }]
        },
        { g: { z: { $all: ['a', 'b', 'c'] } } },
        { a: { d: { $gt: 20 } } }
      ]
    };

    const dct = await DependencyRegistry.getInstance(SQLDialect);
    dct.resolveName = (stack: VisitStack[]) => {
      const field = stack[stack.length - 1] as FieldConfig;
      const parent = stack[stack.length - 2] as FieldConfig;
      return `${field.owner ? field.owner.name : parent.name}.${field.name}`;
    };

    const qryStr = dct.getWhereGroupingSQL(WhereType, qry);
    assert(qryStr === `(WhereTypeAB.c = 5 AND WhereTypeD.e = TRUE AND (WhereType.name = 5 OR WhereType.age = 10) AND z.z ALL = ('a','b','c') AND WhereTypeA.d > 20)`);
  }

  @Test()
  async testRegEx() {
    const dct = await DependencyRegistry.getInstance(SQLDialect);
    dct.resolveName = (stack: VisitStack[]) => {
      const field = stack[stack.length - 1] as FieldConfig;
      return `${field.owner.name}.${field.name}`;
    };

    const out = dct.getWhereGroupingSQL(User, {
      name: {
        $regex: /google.$/
      }
    });

    assert(out === `User.name ${dct.SQL_OPS.$regex} 'google.$'`);

    const outBoundary = dct.getWhereGroupingSQL(User, {
      name: {
        $regex: /\bgoogle\b/
      }
    });

    assert(outBoundary === `User.name ${dct.SQL_OPS.$regex} '\\ygoogle\\y'`);
  }
}