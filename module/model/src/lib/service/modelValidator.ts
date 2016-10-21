import * as mongoose from "mongoose";
import { BaseModel, Model } from '../model';
import { getCls } from '../util';
import { Validator } from '../../mongo';


export class ModelValidator {
  static schemas: { [cls: string]: mongoose.Schema } = {};

  static getSchema<T extends BaseModel>(cls: Model<T>) {
    if (!ModelValidator.schemas[cls.name]) {
      ModelValidator.schemas[cls.name] = Validator.getSchema(cls.schema, cls.schemaOpts);
    }
    return ModelValidator.schemas[cls.name];
  }

  static async validate<T extends BaseModel>(o: T): Promise<T> {
    return await Validator.validate(o, ModelValidator.getSchema(getCls(o)));
  }

  static async validateAll<T extends BaseModel>(obj: T[]): Promise<T[]> {
    return await Validator.validateAll(obj, obj.map(x => ModelValidator.getSchema(getCls(x))));
  }
}