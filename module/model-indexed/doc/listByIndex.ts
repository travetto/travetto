import { Model } from '@travetto/model';
import { sortedIndex, type ModelIndexedSupport } from '@travetto/model-indexed';

@Model()
export class User {
  id: string;
  name: string;
  age: number;
  createdAt: Date;
}

const recentUsers = sortedIndex(User, {
  name: 'recentUsers',
  key: {},
  sort: { createdAt: -1 }
});

export async function listExample(modelService: ModelIndexedSupport) {
  const result = await modelService.pageByIndex(User, recentUsers, {}, {
    limit: 20,
    offset: '0'
  });

  console.log(result.items);      // Array of users
  console.log(result.nextOffset); // Token for next page, if more results exist
  return result;
}
