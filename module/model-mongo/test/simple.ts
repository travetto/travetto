import { Model, ModelService, BaseModel } from '@encore2/model';
import { DependencyRegistry } from '@encore2/di';

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