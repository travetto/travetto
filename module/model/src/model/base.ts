import { Class } from '@travetto/registry';
import { Schema } from '@travetto/schema';
import { ModelCore } from './core';
import { ModelRegistry } from '../registry';

@Schema()
// TODO: Document
export abstract class BaseModel implements ModelCore {

  id?: string;
  version?: string;
  type?: string;
  createdDate?: Date;
  updatedDate?: Date;

  constructor() {
    const conf = ModelRegistry.get(this.constructor as Class);
    if (conf.subType) {
      this.type = conf.subType;
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
