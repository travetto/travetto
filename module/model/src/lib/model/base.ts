import { ModelCore } from './model';
import { SchemaRegistry, Cls, Field, SchemaBound } from '@encore/schema';
import { ModelOptions } from '../service';

export abstract class BaseModel extends SchemaBound implements ModelCore {

  @Field(String)
  _id: string;

  @Field(String)
  _version: string;

  @Field(String)
  _type: string | undefined;

  @Field(Date)
  createdDate: Date;

  @Field(Date)
  updatedDate: Date;

  constructor() {
    super();
    let cons: Cls<any> = SchemaRegistry.getCls(this);
    this._type = SchemaRegistry.getClassMetadata<any, ModelOptions>(cons, 'model').discriminator;
  }

  preSave(): this {
    if (!this.createdDate) {
      this.createdDate = new Date();
    }
    this.updatedDate = new Date();
    return this;
  }

  postLoad(): this {
    return this;
  }
}