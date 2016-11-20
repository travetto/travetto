import { Field } from '../decorate';
import { bindModel } from '../util';
import { models } from '../service';
import { ModelCore } from './model';

export abstract class BaseModel implements ModelCore {

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
    bindModel(this, data);
    this._type = models[this.constructor.name].discriminator;
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