import { Field, Required, Schema } from '@travetto/schema';

@Schema()
export class Address {
  @Field({ type: { kind: 'primitive', value: String } })
  @Required()
  street1: string;

  @Field({ type: { kind: 'primitive', value: String } })
  street2: string;
}

export interface Address2 {
  street1: string;
  mode?: 'c' | 'd';
}

@Schema()
export class SortAddress {
  address: Address;
  sortOrder: 1 | -1;
}
