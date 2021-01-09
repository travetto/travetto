import { Schema } from '@travetto/schema';

@Schema()
export class User {
  name: string;
  age: number;
  favoriteFood?: 'pizza' | 'burrito' | 'salad';
}