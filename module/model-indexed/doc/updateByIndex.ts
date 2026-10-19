import { Model } from '@travetto/model';
import { keyedIndex, type ModelIndexedSupport } from '@travetto/model-indexed';

@Model()
export class User {
  id: string;
  name: string;
  email: string;
  age: number;
}

const userByName = keyedIndex(User, {
  name: 'userByName',
  key: { name: true }
});

export async function updateExample(modelService: ModelIndexedSupport) {
  // Full update — all fields required
  const user = await modelService.updateByIndex(User, userByName, {
    id: 'user-1',
    name: 'John Doe',
    email: 'john.new@example.com',
    age: 31
  });
  return user;
}

export async function updatePartialExample(modelService: ModelIndexedSupport) {
  // Partial update — only updated fields required
  const user = await modelService.updatePartialByIndex(User, userByName, {
    name: 'John Doe',
    email: 'john.newer@example.com'
  });
  return user;
}
