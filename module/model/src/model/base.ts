import { SchemaBound, Schema, BindUtil } from '@travetto/schema';
import { ModelCore } from './model';
import { ModelOptions, ModelRegistry } from '../service';
import { Class } from '@travetto/registry';

type DeepPartial<T> = {
  [p in keyof T]?: T[p] | DeepPartial<T[p]>;
}

@Schema()
export abstract class BaseModel implements ModelCore {

  static from = SchemaBound.from;

  id?: string;
  version?: string;
  type?: string;
  createdDate?: Date;
  updatedDate?: Date;

  constructor() {
    let type = ModelRegistry.get(this.constructor as Class).discriminator;
    if (type) {
      this.type = type;
    }
  }

  prePersist() {
    if (!this.createdDate) {
      this.createdDate = new Date();
    }
    this.updatedDate = new Date();
  }

  postLoad() {
  }
}

