import * as assert from 'assert';

import { Schema, SchemaRegistry } from '@travetto/schema';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { WhereClause } from '@travetto/model/';

import { SQLUtil } from '../src/util';

import '../src/dialect/mysql/dialect';

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

  defaultResolver: QueryResolver = {
    resolveTable: (type) => type.name,
    resolveValue: (f, v) => v,
    namespace: (tbl) => typeof tbl === 'string' ? tbl : tbl.name
  }

  @BeforeAll()
  async beforeAll() {
    await SchemaRegistry.init();
  }

  @Test()
  async validateQuery() {
    let out = SQLUtil.extractSimple({ a: { b: { c: 5 } } });
    assert(out['a.b.c'] === 5);

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

    const qryStr = SQLUtil.buildWhere(qry, WhereType, this.defaultResolver);
    assert(qryStr === '(WhereTypeAB.c = 5 AND WhereTypeD.e = true AND (WhereType.name = 5 OR WhereType.age = 10) AND WhereTypeG.z ALL = (a,b,c) AND (WhereTypeA.d > 20))');
  }


  @Test()
  async testRegEx() {

    const out = SQLUtil.buildWhere({
      name: {
        $regex: '/google.$/'
      }
    }, User, this.defaultResolver);

    assert(out === 'User.name REGEXP /google.$/');
  }
}