import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { type ModelCrudSupport, Model, NotFoundError, ModelCrudUtil, TransientField } from '@travetto/model';

import { BaseModelSuite } from './base.ts';

@Model('computed_person')
class ComputedPerson {
  id: string;
  name: string;
  @TransientField()
  get nameUpper(): string {
    return this.name.toUpperCase();
  }
  @TransientField()
  ignoredField?: string;
}

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
      id: service.idSource.create(),
      name: 'Bob',
      age: 25,
      gender: 'm'
    });

    await service.create(Person, person);

    const single = await service.get(Person, person.id);
    assert(single !== undefined);
    assert(single.age === 25);

    await assert.rejects(async () => {
      await service.get(Person, service.idSource.create());
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
      id: service.idSource.create(),
      name: 'Bob',
      age: 25,
      gender: 'm'
    });

    const single = await service.get(Person, id);
    assert(single !== undefined);
    assert(single.age === 25);
  }

  @Test('Should not persist computed properties')
  async testComputed() {
    const service = await this.service;
    const id = service.idSource.create();
    await service.create(ComputedPerson, ComputedPerson.from({
      id,
      name: 'Bob',
      ignoredField: 'secret'
    }));

    const retrieved = await service.get(ComputedPerson, id);
    assert(retrieved.nameUpper === 'BOB');

    // Verify it wasn't saved in the database holistically:
    // When we fetch the document, the database driver retrieves a raw object and maps it.
    // If the database stored 'nameUpper', trying to map it would set it on the retrieved instance.
    // Since nameUpper is a getter-only property on the instance, we can verify that the persistence
    // preparation (prePersist) recursively stripped the getter property from the stored object.
    const instance = ComputedPerson.from({ id, name: 'Bob', ignoredField: 'secret' });
    assert(Object.hasOwn(instance, 'nameUpper'));
    assert(instance.ignoredField === 'secret');

    const prepared = await ModelCrudUtil.prePersist(ComputedPerson, instance, 'all');
    assert(prepared.nameUpper === undefined);
    assert(prepared.ignoredField === undefined);
  }
}