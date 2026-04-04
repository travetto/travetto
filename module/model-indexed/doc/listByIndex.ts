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

export async function listStreamExample(modelService: ModelIndexedSupport) {
  const items: User[] = [];

  for await (const user of modelService.listByIndex(User, recentUsers, {})) {
    items.push(user);
  }

  return items;
}
