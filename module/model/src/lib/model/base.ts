import { Field, getDiscriminator } from '../decorate';
import { bindData } from '../util';
import { Base } from '@encore/mongo';

export abstract class BaseModel implements Base {

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

  constructor(data?: Object) {
    bindData(this, data);
    this._type = getDiscriminator(this.constructor);
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