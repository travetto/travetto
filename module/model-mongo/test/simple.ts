import { Model, ModelService, BaseModel, ModelSource, WhereClause } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';
import { Suite, Test } from '@travetto/test';
import { Schema } from '@travetto/schema';
import { ModelMongoSource, ModelMongoConfig } from '../index';
import { QueryVerifierService } from '@travetto/model/src/service/query';

import * as assert from 'assert';
import { BaseMongoTest } from './base';

@Schema()
class Address {
  street1: string;
  street2?: string;
}

@Model()
class Person extends BaseModel {
  name: string;
  age: number;
  gender: 'm' | 'f';
  address: Address;
}

@Suite('Simple Save')
class TestSave extends BaseMongoTest {

  @Test()
  async verifySource() {
    const source = await DependencyRegistry.getInstance(ModelSource);
    assert.ok(source);
    assert(source instanceof ModelMongoSource);
  }

  @Test('save it')
  async save() {
    const service = await DependencyRegistry.getInstance(ModelService);

    for (const x of [1, 2, 3, 8]) {
      const res = await service.save(Person, Person.from({
        name: 'Bob',
        age: 20 + x,
        gender: 'm',
        address: {
          street1: 'a',
          ...(x === 1 ? { street2: 'b' } : {})
        }
      }));
    }

    const match = await service.getAllByQuery(Person, {
      where: {
        $and: [
          {
            name: 'Bob'
          },
          {
            $not: {
              age: {
                $gte: 24
              }
            }
          }
        ]
      }
    });

    assert(match.length === 3);

    const match2 = await service.getAllByQuery(Person, {
      where: {
        $and: [
          {
            address: {
              street1: {
                $ne: 'b',
              }
            }
          }
        ]
      }
    });

    assert(match2.length > 3);

    const match3 = await service.query(Person, {
      select: {
        id: 1,
        address: {
          street1: 1
        }
      },
      where: {
        address: {
          street2: {
            $exists: true
          }
        }
      }
    });

    assert(match3.length === 1);
    assert(Object.keys(match3[0]).includes('address'));
    assert(!Object.keys(match3[0]).includes('age'));
    assert(Object.keys(match3[0]).includes('id'));
    assert(!Object.keys(match3[0].address).includes('street2'));
    assert(Object.keys(match3[0].address) === ['street1']);
  }
}