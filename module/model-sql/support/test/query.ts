import assert from 'node:assert';

import { Schema, FieldConfig } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';
import { castTo } from '@travetto/runtime';
import { BaseModelSuite } from '@travetto/model/support/test/base.ts';

import { VisitStack } from '../../src/types.ts';
import { SQLModelService } from '../../src/service.ts';

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
export abstract class BaseSQLTest extends BaseModelSuite<SQLModelService> {

  get dialect() {
    return this.service.then(s => s.client);
  }

  @Test()
  async validateQuery() {
    const qry = {
      $and: [
        { a: { b: { c: 5 } } },
        { d: { e: true } },
        {
          $or: [{ name: 5 }, { age: 10 }]
        },
        { g: { z: { $in: ['a', 'b', 'c'] } } },
        { a: { d: { $gt: 20 } } }
      ]
    };

    const dct = await this.dialect;
    dct.resolveName = (stack: VisitStack[]) => {
      const field: FieldConfig = castTo(stack.at(-1));
      const parent: FieldConfig = castTo(stack.at(-2));
      return `${field.owner ? field.owner.name : parent.name}.${field.name}`;
    };

    const qryStr = dct.getWhereGroupingSQL(WhereType, qry);
    assert(qryStr === "(WhereTypeAB.c = 5 AND WhereTypeD.e = TRUE AND (WhereType.name = 5 OR WhereType.age = 10) AND z.z IN ('a','b','c') AND WhereTypeA.d > 20)");
  }

  @Test()
  async testRegEx() {
    const dct = await this.dialect;
    dct.resolveName = (stack: VisitStack[]) => {
      const field: FieldConfig = castTo(stack.at(-1));
      return `${field.owner?.name}.${field.name}`;
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

    assert(outBoundary === `User.name ${dct.SQL_OPS.$regex} '${dct.regexWordBoundary}google${dct.regexWordBoundary}'`);
  }
}