import { Model } from '@travetto/model';
import { keyedIndex, type ModelIndexedSupport } from '@travetto/model-indexed';

@Model()
export class User {
  id: string;
  name: string;
  email: string;
}

const userByName = keyedIndex(User, {
  name: 'userByName',
  key: { name: true }
});

export async function upsertExample(modelService: ModelIndexedSupport) {
  const user = await modelService.upsertByIndex(User, userByName, {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com'
  });
  return user;
}
