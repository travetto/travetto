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

export async function deleteExample(modelService: ModelIndexedSupport) {
  await modelService.deleteByIndex(User, userByName, {
    name: 'John Doe'
  });
}
