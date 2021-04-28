import { Model, ModelType, ModelCrudSupport } from '@travetto/model';
import { Schema } from '@travetto/schema';
import { Application, AppUtil } from '@travetto/app';
import { Inject } from '@travetto/di';

import { WithAsyncContext, AsyncContext } from '@travetto/context';

@Schema()
class Address {
  street1: string;
  street2?: string;
  street3?: string;
  city: string;
  zip?: number;
}

@Model()
class Person implements ModelType {
  id: string;
  name: string;
  age: number;
  gender: 'm' | 'f';
  address?: Address;
}

@Model()
class Employee implements ModelType {
  id: string;
  name: string;
}

@Application('multi')
export class Service {

  @Inject({ resolution: 'any' })
  src: ModelCrudSupport;

  @Inject()
  context: AsyncContext;

  @WithAsyncContext({})
  async run() {
    await this.src.create(Person, Person.from({ name: 'bob', age: 10, gender: 'm', }));
    await this.src.create(Employee, Employee.from({ name: 'bob2' }));
    return AppUtil.waitHandle();
  }
}