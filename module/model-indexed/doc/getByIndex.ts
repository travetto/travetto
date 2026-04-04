import { Model } from '@travetto/model';
import { keyedIndex, type ModelIndexedSupport } from '@travetto/model-indexed';

@Model()
export class User {
  id: string;
  name: string;
}

const userByName = keyedIndex(User, {
  name: 'userByName',
  key: { name: true }
});

export async function getExample(modelService: ModelIndexedSupport) {
  const user = await modelService.getByIndex(User, userByName, {
    name: 'John Doe'
  });
  return user;
}

export async function getScopedExample(modelService: ModelIndexedSupport) {
  const user = await modelService.getByIndex(User, userByName, {
    name: 'John Doe',
    id: 'user-123'
  });
  return user;
}
