import { Model, type ModelId } from '@travetto/model';
import { type ModelIndexedSupport, sortedIndex } from '@travetto/model-indexed';

@Model()
export class User {
  id: ModelId;
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
  const result = await modelService.pageByIndex(
    User,
    usersByNameAge,
    {
      name: 'John'
    },
    {
      limit: 10
    }
  );
  return result;
}
