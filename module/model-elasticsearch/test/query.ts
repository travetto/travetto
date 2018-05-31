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

    assert.ok(out.bool);

    assert.ok(out.bool.must[0]);

    assert.ok(out.bool.must[0].nested);

    assert(out.bool.must[0].nested.path === 'a');

    assert(out.bool.must[0].nested.query.nested.path === 'a.b');

    assert.ok(out.bool.must[0].nested.query.nested.query.term);

    assert.ok(out.bool.must[0].nested.query.nested.query.term['a.b.c']);

    assert(out.bool.must[0].nested.query.nested.query.term['a.b.c'].value === 5);

  }
}