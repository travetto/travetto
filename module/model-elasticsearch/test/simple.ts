import { Model, ModelService, BaseModel, ModelSource } from '@travetto/model';
import { DependencyRegistry, Injectable } from '@travetto/di';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { ModelMongoSource } from '../index';
import * as assert from 'assert';
import { RootRegistry } from '@travetto/registry';

@Model()
class Person extends BaseModel {
  name: string;
  age: number;
}

@Injectable()
class Source extends ModelMongoSource {

}

@Suite('Simple Save')
class TestSave {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    let source = await DependencyRegistry.getInstance(ModelSource);
    (source as ModelMongoSource).resetDatabase();
  }

  @Test('save it')
  async save() {
    let service = await DependencyRegistry.getInstance(ModelService);
    let res = await service.save(Person, Person.from({
      name: 'Bob',
      age: 20
    }));
    assert(res.id);
  }
}
