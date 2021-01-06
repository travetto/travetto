import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Schema, Text, Precision } from '@travetto/schema';

import { BaseModelSuite } from './base';
import { ModelCrudSupport, Model, BaseModel, NotFoundError } from '..';

@Model()
class Person extends BaseModel {
  @Text() name: string;
  @Precision(3, 0)
  age: number;
  gender: 'm' | 'f';
}

@Suite()
export abstract class ModelBasicSuite extends BaseModelSuite<ModelCrudSupport> {

  @Test('save it')
  async create() {
    const service = await this.service;

    const person = Person.from({
      id: service.uuid(),
      name: 'Bob',
      age: 25,
      gender: 'm'
    });

    await service.create(Person, person);

    const single = await service.get(Person, person.id!);
    assert(single !== undefined);
    assert(single.age === 23);

    await assert.rejects(async () => {
      await service.get(Person, service.uuid());
    }, NotFoundError);

    await service.delete(Person, person.id!);

    await assert.rejects(async () => {
      await service.get(Person, person.id!);
    }, NotFoundError);
  }
}