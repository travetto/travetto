import { Schema } from '@travetto/schema';

@Schema()
export class Unknowable {
  value?: unknown;

  sub?: {
    value2: unknown;
  };
}
