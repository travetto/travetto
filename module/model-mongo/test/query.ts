import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { MongoUtil } from '../src/internal/util';

class User {
  id: string;
  name: string;
}

@Suite()
export class QueryTest {

  @Test()
  async validateQuery() {

    let out: any = MongoUtil.extractSimple({ a: { b: { c: 5 } } });
    assert(out['a.b.c'] === 5);

    type Type = { a: { d: number, b: { c: number } }, d: { e: boolean }, g: { z: string[] }, name: number, age: number };

    out = MongoUtil.extractWhereClause<Type>({
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

    assert(out.$and[0]['a.b.c'] === 5);

    assert(out.$and[1]['d.e'] === true);

    assert(out.$and[2].$or[0]['name'] === 5);

    assert(out.$and[2].$or[1]['age'] === 10);

    assert(out.$and[4]['a.d'].$gt === 20);

    assert(out.$and[3]['g.z'] === 'a');
  }

  @Test()
  async translateIds() {
    const out: any = MongoUtil.extractWhereClause<User>({
      $and: [
        { id: { $in: ['a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24)] } }
      ]
    });

    assert(!!out.$and[0]._id);
  }

  @Test()
  async translateRegex() {
    const out: any = MongoUtil.extractWhereClause<User>({
      name: { $regex: '/google.$/' }
    });

    assert(out.name.$regex instanceof RegExp);
    assert(out.name.$regex.source === 'google.$');
  }
}