import { Model, ModelCore, ModelService } from '@travetto/model';
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

@Application('multi')
export class Service {

  @Inject()
  src: ModelService;

  @Inject()
  context: AsyncContext;

  @WithAsyncContext({})
  async run() {
    await this.src.save(Person, Person.from({ name: 'bob', age: 10, gender: 'm', }));
    await this.src.save(Employee, Employee.from({ name: 'bob2' }));
    return AppUtil.waitHandle();
  }
}