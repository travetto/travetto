import { SchemaRegistry, SchemaBound, Schema } from '@encore/schema';

import { ModelCore } from './model';
//import { ModelOptions } from '../service';

@Schema()
export abstract class BaseModel extends SchemaBound implements ModelCore {

  _id: string;
  _version: string;
  _type?: string;
  createdDate: Date;
  updatedDate: Date;

  constructor() {
    super();
    let cons = SchemaRegistry.getClass(this);
    //this._type = SchemaRegistry.getClassMetadata<any, ModelOptions>(cons, 'model').discriminator;
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