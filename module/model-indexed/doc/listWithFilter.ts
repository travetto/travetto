import { Model } from '@travetto/model';
import { sortedIndex, type ModelIndexedSupport } from '@travetto/model-indexed';

@Model()
export class User {
  id: string;
  name: string;
  age: number;
}

const usersByNameAge = sortedIndex(User, {
  name: 'usersByNameAge',
  key: { name: true },
  sort: { age: 1 }
});

export async function listWithFilterExample(modelService: ModelIndexedSupport) {
  // Get all users named 'John' sorted by age
  const result = await modelService.listByIndex(User, usersByNameAge, {
    name: 'John'
  }, {
    limit: 10
  });
  return result;
}
