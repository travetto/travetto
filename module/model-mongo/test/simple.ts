import * as assert from 'assert';

import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';
import { Suite, Test } from '@travetto/test';
import { Schema } from '@travetto/schema';
import { GenerateUtil } from '@travetto/schema/extension/faker';

import { ModelMongoSource } from '../';
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

@Model()
class Simple {
  id?: string;
  name: string;
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
      const person = GenerateUtil.generate(Person);
      delete person.id;
      const res = await service.save(Person, person);
    }

    const match = await service.getAllByQuery(Person, {
      where: {
        $and: [
          {
            name: { $exists: true }
          },
          {
            age: { $gte: 0 }
          }
        ]
      }
    });

    assert(match.length === 4);

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

    assert(match3.length > 0);
    assert(Object.keys(match3[0]).includes('address'));
    assert(!Object.keys(match3[0]).includes('age'));
    assert(Object.keys(match3[0]).includes('id'));
    // assert(!Object.keys(match3[0].address).includes('street2'));
    assert(Object.keys(match3[0].address).includes('street1'));
  }

  @Test('Verify update')
  async testUpdate() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const o = await service.save(Simple, Simple.from({ name: 'bob' }));
    o.name = 'roger';
    const b = await service.update(Simple, o);
    const id = b.id!;

    const z = await service.getById(Simple, id);

    assert(z.name === 'roger');
  }
}