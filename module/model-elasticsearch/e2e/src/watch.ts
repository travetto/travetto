import { Model, ModelCore, ModelSource } from '@travetto/model';
import { Schema } from '@travetto/schema';
import { InjectableFactory, Application, Inject } from '@travetto/di';

import { ElasticsearchModelSource, ElasticsearchModelConfig } from '../..';

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

export class Conf {
  @InjectableFactory()
  static getSource(config: ElasticsearchModelConfig): ModelSource {
    return new ElasticsearchModelSource(config);
  }
}

@Application('multi')
export class Service {

  @Inject()
  src: ModelSource;

  async run() {
    await this.src.save(Person, Person.from({ name: 'bob', age: 10, gender: 'm', }));
    await this.src.save(Employee, Employee.from({ name: 'bob2' }));

    const res = await (this.src as ElasticsearchModelSource).getRawMultiQuery([Employee, Person], {
      where: {
        name: {
          $regex: /.*/
        }
      }
    });

    console.log(res);
  }
}