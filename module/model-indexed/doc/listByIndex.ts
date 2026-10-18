import { Model, type ModelId } from '@travetto/model';
import { type ModelIndexedSupport, sortedIndex } from '@travetto/model-indexed';

@Model()
export class User {
  id: ModelId;
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

  for await (const batch of modelService.listByIndex(User, recentUsers, {}, { limit: 25 })) {
    items.push(...batch);
  }

  return items;
}
