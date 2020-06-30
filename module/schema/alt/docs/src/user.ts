import { Schema } from '../../../src/decorator/schema';

@Schema()
export class User {
  name: string;
  age: number;
  favoriteFood?: 'pizza' | 'burrito' | 'salad';
}