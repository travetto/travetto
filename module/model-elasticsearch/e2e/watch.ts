import { Model, ModelCore, ModelSource, ModelService } from '@travetto/model';
import { Schema } from '@travetto/schema';
import { DependencyRegistry, InjectableFactory, Application, Inject } from '@travetto/di';

import { ModelElasticsearchSource, ModelElasticsearchConfig } from '../';
import { Class } from '@travetto/registry';

@Schema()
class Address {
  street1: string;
  street2?: string;
  city: string;
  zip?: number;
  name: string;
}

@Model()
class Person implements ModelCore {
  id?: string;
  name: string;
  age: number;
  gender: 'm' | 'f';
  address?: Address;
}

@Model()
class Employee implements ModelCore {
  id?: string;
  name: string;
}

class Config {
  @InjectableFactory()
  static getSource(config: ModelElasticsearchConfig): ModelSource {
    return new ModelElasticsearchSource(config);
  }
}

@Application('multi')
class Service {

  @Inject()
  src: ModelSource;

  async run() {
    await this.src.save(Person, Person.from({ name: 'bob', age: 10, gender: 'm', }));
    await this.src.save(Employee, Employee.from({ name: 'bob2' }));

    const res = await (this.src as ModelElasticsearchSource).getMultiQuery([Employee, Person], {
      where: {
        name: {
          $regex: /.*/
        }
      }
    });

    console.log(res);
  }
}