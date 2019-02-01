import { Schema, Field, Required } from '../../';

@Schema()
export class Address {

  @Field(String)
  @Required()
  street1: string;

  @Field(String)
  street2: string;
}