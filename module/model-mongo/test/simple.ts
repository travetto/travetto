import { Model, ModelService, BaseModel } from '@travetto/model';
import { DependencyRegistry } from '@travetto/di';

@Model()
class Person extends BaseModel {
  name: string;
  age: number;
}

async function run() {
  let service = await DependencyRegistry.getInstance(ModelService);
  let res = await service.save(Person, Person.from({
    name: 'Bob',
    age: 20
  }));

  console.log(res.age);
}

console.log('Running')

run();