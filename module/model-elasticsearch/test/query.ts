import * as assert from 'assert';

import { Schema, SchemaRegistry } from '@travetto/schema';
import { Suite, Test, BeforeAll } from '@travetto/test';

import { ElasticsearchUtil } from '../src/util';
import { WhereClause } from '../../model/src/model/where-clause';

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
  }

  @Test()
  async validateQuery() {
    let out = ElasticsearchUtil.extractSimple({ a: { b: { c: 5 } } });
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

    out = ElasticsearchUtil.extractWhereQuery(qry, WhereType);

    assert.ok(out.bool);

    assert.ok(out.bool.must[0]);

    assert.ok(out.bool.must[0].nested);

    assert(out.bool.must[0].nested.path === 'a');

    assert(out.bool.must[0].nested.query);

    assert.ok(out.bool.must[0].nested.query.term);

    assert.ok(out.bool.must[0].nested.query.term['a.b.c']);

    assert(out.bool.must[0].nested.query.term['a.b.c'] === 5);
  }

  @Test()
  async translateIds() {
    let out = ElasticsearchUtil.extractWhereQuery({
      $and: [
        { id: { $in: ['a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24)] } }
      ]
    }, User);

    assert(!!out.bool.must[0].terms._id);
  }
}