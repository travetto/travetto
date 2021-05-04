import { Currency, Schema } from '@travetto/schema';

@Schema()
export class TestUser {
  age: number;
  name: string;
  @Currency()
  salary: number;
}
