import { Field } from '../decorate';
import { Base } from '@encore/mongo';

export abstract class BaseModel implements Base {

  static bindData(obj: any, data?: any) {
    let cons = obj.constructor as any;
    if (cons.schemaOpts && cons.schemaOpts.strict === false) {
      for (var k in data) {
        obj[k] = data[k];
      }
    } else if (!!data) {
      if (cons.fields) {
        cons.fields.forEach((f: string) => {
          if (data[f] !== undefined) {
            obj[f] = data[f];
          }
        });
      } else {
        for (let k of Object.keys(data)) {
          obj[k] = data[k];
        }
      }
    }
  }

  @Field(String)
  _id: string;

  @Field(String)
  _version: string;

  @Field(String)
  _type: string;

  @Field(Date)
  createdDate: Date;

  @Field(Date)
  updatedDate: Date;

  constructor(data?: Object) {
    BaseModel.bindData(this, data);
    this._type = (this.constructor as any)['discriminatorKey'];
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