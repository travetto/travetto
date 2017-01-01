import { Field } from '../decorate';
import { ModelRegistry } from '../service';
import { ModelCore } from './model';
import { Bindable } from './bindable';

export abstract class BaseModel extends Bindable implements ModelCore {

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
    super(data);
    this._type = ModelRegistry.models[this.constructor.name].discriminator;
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