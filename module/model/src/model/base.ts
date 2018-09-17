import { Class } from '@travetto/registry';
import { Schema } from '@travetto/schema';
import { ModelCore } from './core';
import { ModelRegistry } from '../registry';

@Schema()
export abstract class BaseModel implements ModelCore {

  id?: string;
  version?: string;
  type?: string;
  createdDate?: Date;
  updatedDate?: Date;

  constructor() {
    const type = ModelRegistry.get(this.constructor as Class).discriminator;
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
