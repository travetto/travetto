import * as assert from 'assert';

import { Util } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';
import { Schema } from '@travetto/schema';
import { Suite, Test, BeforeAll } from '@travetto/test';
import type { WhereClause } from '@travetto/model-query';

import { ElasticsearchQueryUtil } from '../src/internal/query';

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

function isBool(o: unknown): o is { bool: { must: any, ['must_not']: any, ['should_not']: any } } {
  return Util.isPlainObject(o) && 'bool' in o;
}

function isRegexp(o: unknown): o is { regexp: { name: string } } {
  return Util.isPlainObject(o) && 'regexp' in o;
}


@Suite()
export class QueryTest {

  @BeforeAll()
  async beforeAll() {
    await RootRegistry.init();
  }

  @Test()
  async validateQuery() {
    let out = ElasticsearchQueryUtil.extractSimple({ a: { b: { c: 5 } } });
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

    out = ElasticsearchQueryUtil.extractWhereQuery(WhereType, qry);

    assert(isBool(out));

    if (isBool(out)) {
      assert.ok(out.bool);

      assert.ok(out.bool.must[0]);

      assert.ok(out.bool.must[0].nested);

      assert(out.bool.must[0].nested.path === 'a');

      assert(out.bool.must[0].nested.query);

      assert.ok(out.bool.must[0].nested.query.term);

      assert.ok(out.bool.must[0].nested.query.term['a.b.c']);

      assert(out.bool.must[0].nested.query.term['a.b.c'] === 5);
    }
  }

  @Test()
  async translateIds() {
    const out = ElasticsearchQueryUtil.extractWhereQuery(User, {
      $and: [
        { id: { $in: ['a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24)] } }
      ]
    });

    assert(isBool(out));

    if (isBool(out)) {
      assert(!!out.bool.must[0].terms._id);
    }
  }

  @Test()
  async testRegEx() {

    const out = ElasticsearchQueryUtil.extractWhereQuery(User, {
      name: {
        $regex: '/google.$/'
      }
    });

    assert(isRegexp(out));

    if (isRegexp(out)) {
      assert(typeof out.regexp.name === 'string');
      assert(out.regexp.name === 'google.$');
    }
  }
}