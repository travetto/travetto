import assert from 'node:assert';

import { Model, type ModelId } from '@travetto/model';
import { Suite, Test } from '@travetto/test';

import { MongoUtil } from '@travetto/model-mongo/src/internal/util.ts';

@Model()
class MongoUser {
  id: ModelId;
  name: string;
}

class Type {
  a: {
    d: number;
    b: { c: number };
  };
  d: { e: boolean };
  g: { z: string[] };
  name: number;
  age: number;
}

@Suite()
export class QueryTest {
  @Test()
  async validateQuery() {
    const out = MongoUtil.extractSimple(MongoUser, { a: { b: { c: 5 } } });
    assert(out['a.b.c'] === 5);

    const out2 = MongoUtil.extractWhereClause(Type, {
      $and: [
        { a: { b: { c: 5 } } },
        { d: { e: true } },
        {
          $or: [{ name: 5 }, { age: 10 }]
        },
        { g: { z: 'a' } },
        { a: { d: { $gt: 20 } } }
      ]
    });

    assert.deepEqual(out2, {
      $and: [{ 'a.b.c': 5 }, { 'd.e': true }, { $or: [{ name: 5 }, { age: 10 }] }, { 'g.z': 'a' }, { 'a.d': { $gt: 20 } }]
    });
  }

  @Test()
  async translateIds() {
    const ids = ['a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24)];
    const out = MongoUtil.extractWhereClause(MongoUser, {
      $and: [{ id: { $in: ids } }]
    });

    assert.deepStrictEqual(out, {
      $and: [
        {
          _id: { $in: ids.map(x => MongoUtil.uuid(x)) }
        }
      ]
    });
  }

  @Test()
  async translateRegex() {
    const out = MongoUtil.extractWhereClause(MongoUser, {
      name: { $regex: '/google.$/' }
    });

    assert.deepStrictEqual(out, {
      name: { $regex: /google.$/ }
    });
  }
}
