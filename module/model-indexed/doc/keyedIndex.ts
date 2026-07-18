import { Model } from '@travetto/model';
import { keyedIndex } from '@travetto/model-indexed';

@Model()
export class User {
  id: string;
  name: string;
  email: string;
}

export const userByName = keyedIndex(User, {
  name: 'userByName',
  key: { name: true }
});
