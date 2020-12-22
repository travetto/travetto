import { Class } from '@travetto/registry';
import { Schema } from '@travetto/schema';
import { ModelRegistry } from '../registry/model';
import { ModelType } from './model';

/**
 * Base model, provides basic functionality dates and subtype support
 */
@Schema()
export abstract class BaseModel implements ModelType {

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

  /**
   * Update timestamps on save
   */
  prePersist() {
    if (!this.createdDate) {
      this.createdDate = new Date();
    }
    this.updatedDate = new Date();
  }

  postLoad() {
  }
}
