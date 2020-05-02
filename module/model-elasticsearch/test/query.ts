import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { Schema } from '@travetto/schema';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { WhereClause } from '@travetto/model/';

import { ElasticsearchUtil } from '../src/internal/util';

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
    await RootRegistry.init();
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

    out = ElasticsearchUtil.extractWhereQuery(WhereType, qry);

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
    const out = ElasticsearchUtil.extractWhereQuery(User, {
      $and: [
        { id: { $in: ['a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24)] } }
      ]
    });

    assert(!!out.bool.must[0].terms._id);
  }

  @Test()
  async testRegEx() {

    const out = ElasticsearchUtil.extractWhereQuery(User, {
      name: {
        $regex: '/google.$/'
      }
    });

    assert(typeof out.regexp.name === 'string');
    assert(out.regexp.name === 'google.$');
  }
}