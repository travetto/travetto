import { Schema, Field, Required } from '../index';

@Schema()
export class Address {

  @Field(String)
  @Required()
  street1: string;

  @Field(String)
  street2: string;
}