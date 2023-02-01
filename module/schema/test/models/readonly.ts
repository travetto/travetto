import { Schema } from '../../src/decorator/schema';

@Schema()
export class ReadonlyUser {
  readonly name: string;

  readonly profile: {
    readonly age: number;
  };
}