import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';

import { BaseModelSuite } from './base';
import { ModelCrudSupport, Model, NotFoundError } from '../..';

@Model('basic_person')
class Person {
  id: string;
  name: string;
  age: number;
  gender: 'm' | 'f';
}

@Suite()
export abstract class ModelBasicSuite extends BaseModelSuite<ModelCrudSupport> {

  @Test('create, read, delete')
  async create() {
    const service = await this.service;

    const person = Person.from({
      id: service.uuid(),
      name: 'Bob',
      age: 25,
      gender: 'm'
    });

    await service.create(Person, person);

    const single = await service.get(Person, person.id);
    assert(single !== undefined);
    assert(single.age === 25);

    await assert.rejects(async () => {
      await service.get(Person, service.uuid());
    }, NotFoundError);

    await service.delete(Person, person.id);

    await assert.rejects(async () => {
      await service.get(Person, person.id);
    }, NotFoundError);
  }


  @Test('create, read, delete')
  async createRaw() {
    const service = await this.service;

    const { id } = await service.create(Person, {
      id: service.uuid(),
      name: 'Bob',
      age: 25,
      gender: 'm'
    });

    const single = await service.get(Person, id);
    assert(single !== undefined);
    assert(single.age === 25);
  }
}