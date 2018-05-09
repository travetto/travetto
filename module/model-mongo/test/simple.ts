import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';
import { Suite, Test } from '@travetto/test';
import { ModelMongoSource, ModelMongoConfig } from '../index';
import { QueryVerifierService } from '@travetto/model/src/service/query';

import * as assert from 'assert';
import { BaseMongoTest } from './base';

@Model()
class Address extends BaseModel {
  street1: string;
  street2?: string;
}

@Model()
class Person extends BaseModel {
  name: string;
  age: number;
  gender: 'm' | 'f';
  address: Address
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

    for (const x of [1, 2]) {
      const res = await service.save(Person, Person.from({
        name: 'Bob',
        age: 20,
        gender: 'm',
        address: {
          street1: 'a',
          street2: 'b'
        }
      }));
    }

    const match = await service.getAllByQuery(Person, {
      where: {
        name: 'Bob'
      }
    });

    assert(match.length === 2);

    const match2 = await service.getAllByQuery(Person, {
      where: {
        $and: [
          {
            address: {
              street1: {
                $ne: 'b'
              }
            }
          }
        ]
      }
    });

    assert(match2.length === 2);
  }
}