import { Schema } from '@travetto/schema';

@Schema()
export class ReadonlyUser {
  readonly name: string;

  readonly profile: {
    readonly age: number;
  };
}