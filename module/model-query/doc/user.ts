import { Model } from '@travetto/model';

@Model()
export class User {
  id: string;
  name: string;
  age: number;
  contact?: boolean;
}
