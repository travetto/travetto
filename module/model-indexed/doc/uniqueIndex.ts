import { Model, type ModelId } from '@travetto/model';
import { uniqueIndex } from '@travetto/model-indexed';

@Model()
export class User {
  id: ModelId;
  name: string;
  email: string;
}

export const emailUnique = uniqueIndex(User, {
  name: 'uniqueEmail',
  key: { email: true }
});
