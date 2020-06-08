import { Schema, Field, Required } from '../../';

@Schema()
export class Address {

  @Field(String)
  @Required()
  street1: string;

  @Field(String)
  street2: string;
}

export interface Address2 {
  street1: string;
  mode?: 'c' | 'd';
}
