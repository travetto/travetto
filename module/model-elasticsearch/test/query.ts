import { Suite, Test, BeforeAll } from '@travetto/test';
import { extractSimple, extractWhereQuery } from '../src/service';
import * as assert from 'assert';
import { Schema, SchemaRegistry } from '@travetto/schema';

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
  a: WhereTypeA;
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
    let out = extractSimple({ a: { b: { c: 5 } } });
    assert(out['a.b.c'] === 5);

    out = extractWhereQuery({
      $and: [
        { a: { b: { c: 5 } } },
        { d: { e: true } },
        {
          $or: [{ name: 5 }, { age: 10 }]
        },
        { g: { z: { $all: ['a', 'b', 'c'] } } },
        { a: { d: { $gt: 20 } } }
      ]
    }, WhereType);

    assert(out.$and[0]['a.b.c'] === 5);

    assert(out.$and[1]['d.e'] === true);

    assert(out.$and[2].$or[0]['name'] === 5);

    assert(out.$and[2].$or[1]['age'] === 10);

    assert(out.$and[4]['a.d'].$gt === 20);

    assert(out.$and[3]['g.z'].length === 3);
  }
}