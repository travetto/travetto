import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry, Injectable, InjectableFactory } from '@travetto/di';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { ModelMongoSource, ModelMongoConfig } from '../index';
import * as assert from 'assert';
import { RootRegistry } from '@travetto/registry';
import { QueryVerifierService } from '@travetto/model/src/service/query';

@Model()
class Person extends BaseModel {
  name: string;
  age: number;
  gender: 'm' | 'f';
}

class Init {
  @InjectableFactory({ class: ModelMongoSource })
  static getModelSource(conf: ModelMongoConfig) {
    return new ModelMongoSource(conf);
  }

  @InjectableFactory({ class: ModelService })
  static getModelService(src: ModelMongoSource, query: QueryVerifierService) {
    const out = new ModelService(src, query);
    return out;
  }
}

@Suite('Simple Save')
class TestSave {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    const source = await DependencyRegistry.getInstance(ModelMongoSource);
    await source.resetDatabase();
  }

  @Test('save it')
  async save() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const source = await DependencyRegistry.getInstance(ModelMongoSource);

    assert.ok(source);

    const res = await service.save(Person, Person.from({
      name: 'Bob',
      age: 20,
      gender: 'm'
    }));

    assert.ok(res);

    const match = await service.getAllByQuery(Person, {
      where: {
        name: 'Bob'
      }
    });

    assert.ok(match.length === 1);

    const match2 = await service.getByQuery(Person, {
      where: {
        name: 'Bob'
      }
    });

    assert.ok(match2);
  }
}