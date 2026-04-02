import { Model } from '@travetto/model';
import { keyedIndex } from '@travetto/model-indexed';

@Model()
export class User {
  id: string;
  name: string;
}

const userByName = keyedIndex(User, {
  name: 'userByName',
  key: { name: true }
});

export async function deleteExample(modelService: any) {
  await modelService.deleteByIndex(User, userByName, {
    name: 'John Doe'
  });
}
