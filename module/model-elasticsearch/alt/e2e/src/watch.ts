import { Model, ModelType } from '@travetto/model-core';
import { Schema } from '@travetto/schema';
import { Application } from '@travetto/app';
import { InjectableFactory, Inject } from '@travetto/di';

import { ElasticsearchModelService, ElasticsearchModelConfig } from '../../..';

@Schema()
class Address {
  street1: string;
  street2?: string;
  city: string;
  zip?: number;
  name: string;
}

@Model()
class Person implements ModelType {
  id?: string;
  name: string;
  age: number;
  gender: 'm' | 'f';
  address?: Address;
}

@Model()
class Employee implements ModelType {
  id?: string;
  name: string;
}

export class Conf {
  @InjectableFactory()
  static getSource(config: ElasticsearchModelConfig) {
    return new ElasticsearchModelService(config);
  }
}

@Application('multi')
export class Service {

  @Inject()
  src: ElasticsearchModelService;

  async run() {
    await this.src.create(Person, Person.from({ name: 'bob', age: 10, gender: 'm', }));
    await this.src.create(Employee, Employee.from({ name: 'bob2' }));

    // const res = await this.src.getRawMultiQuery([Employee, Person], {
    //   where: {
    //     name: {
    //       $regex: /.*/
    //     }
    //   }
    // });

    // console.log(res);
  }
}