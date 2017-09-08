import { SchemaBound, Schema } from '@encore2/schema';
import { ModelCore } from './model';
import { ModelOptions, ModelRegistry } from '../service';
import { Class } from '@encore2/registry';

@Schema()
export abstract class BaseModel extends SchemaBound implements ModelCore {

  id: string;
  version: string;
  type?: string;
  createdDate: Date;
  updatedDate: Date;

  constructor() {
    super();
    this.type = ModelRegistry.getClass(this.constructor as Class).discriminator;
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