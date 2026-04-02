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

export async function getExample(modelService: any) {
  const user = await modelService.getByIndex(User, userByName, {
    name: 'John Doe'
  });
  return user;
}
