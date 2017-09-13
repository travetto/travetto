import { Schema, SchemaBound, Field, View, Required } from '../index';

@Schema()
export class Address extends SchemaBound {

  @Field(String)
  @View('test')
  @Required()
  street1: string;

  @Field(String)
  street2: string;
}