import { Schema, Field, Required } from '@travetto/schema';

@Schema()
export class Address {

  @Field({ type: String })
  @Required()
  street1: string;

  @Field({ type: String })
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