import { Model, type ModelId } from '@travetto/model';

@Model()
export class User {
  id: ModelId;
  name: string;
  age: number;
  contact?: boolean;
}
