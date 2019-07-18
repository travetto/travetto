import { Model, ModelCore, ModelService } from '@travetto/model';
import { Schema } from '@travetto/schema';
import { Application, Inject } from '@travetto/di';

// tslint:disable-next-line: no-import-side-effect
import '../../extension/mysql/dialect';
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

@Application('multi', { watchable: true, standalone: false })
export class Service {

  @Inject()
  src: ModelService;

  @Inject()
  context: AsyncContext;

  @WithAsyncContext({})
  async run() {
    await this.src.save(Person, Person.from({ name: 'bob', age: 10, gender: 'm', }));
    await this.src.save(Employee, Employee.from({ name: 'bob2' }));

    setTimeout(() => { }, 100000000);
  }
}