import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry, Injectable, InjectableFactory, DEFAULT_INSTANCE } from '@travetto/di';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { ModelMongoSource, ModelMongoConfig, projectQuery } from '../index';
import * as assert from 'assert';
import { RootRegistry } from '@travetto/registry';
import { QueryVerifierService } from '@travetto/model/src/service/query';

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

const SYMBOL = Symbol();

class Init {
  @InjectableFactory()
  static getModelSource(conf: ModelMongoConfig): ModelSource {
    return new ModelMongoSource(conf);
  }
}

@Suite('Simple Save')
class TestSave {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    const source = (await DependencyRegistry.getInstance(ModelSource)) as ModelMongoSource;
    await source.resetDatabase();
  }

  @Test('save it')
  async save() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const source = (await DependencyRegistry.getInstance(ModelSource)) as ModelMongoSource;

    assert.ok(source);

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

      assert.ok(res);
    }

    const match = await service.getAllByQuery(Person, {
      where: {
        name: 'Bob'
      }
    });

    assert(match.length === 2);

    const match2 = await service.getAllByQuery(Person, {
      where: {
        address: {
          street1: 'a'
        }
      }
    });

    assert(match2.length === 2);
  }
}