import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { MongoUtil } from '../src/internal/util';

class User {
  id: string;
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

    const out = MongoUtil.extractSimple(User, { a: { b: { c: 5 } } });
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
    }) as {
      $and: [
        { ['a.b.c']: number },
        { ['d.e']: boolean },
        { $or: [{ name: number }, { age: number }] },
        { ['g.z']: string },
        { ['a.d']: { $gt: number } },
      ];
    };

    assert(out2.$and[0]['a.b.c'] === 5);

    assert(out2.$and[1]['d.e'] === true);

    assert(out2.$and[2].$or[0]['name'] === 5);

    assert(out2.$and[2].$or[1]['age'] === 10);

    assert(out2.$and[4]['a.d'].$gt === 20);

    assert(out2.$and[3]['g.z'] === 'a');
  }

  @Test()
  async translateIds() {
    const out = MongoUtil.extractWhereClause(User, {
      $and: [
        { id: { $in: ['a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24)] } }
      ]
    }) as { $and: [{ _id: string }] };

    assert(!!out.$and[0]._id);
  }

  @Test()
  async translateRegex() {
    const out = MongoUtil.extractWhereClause(User, {
      name: { $regex: '/google.$/' }
    }) as { name: { $regex: RegExp } };

    assert(out.name.$regex instanceof RegExp);
    assert(out.name.$regex.source === 'google.$');
  }
}