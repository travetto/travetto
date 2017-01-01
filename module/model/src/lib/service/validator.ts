import * as mg from 'mongoose';
import { ModelCore } from '../model';
import { ModelCls, ModelRegistry } from './registry';
import { getCls } from '../util';

let mongoose = require('mongoose/lib/browser');
mongoose.Document = require('mongoose/lib/browserDocument.js');

export class Validator {

  static schemas: { [cls: string]: mg.Schema } = {};

  static getSchema<T extends ModelCore>(cls: ModelCls<T>, view: string = ModelRegistry.DEFAULT_VIEW) {
    const key = `${cls.name}::${view}`;
    if (!Validator.schemas[key]) {
      let config = ModelRegistry.models[cls.name];
      if (!config || !config.views[view]) {
        throw new Error(`Unknown view found: ${view}`);
      }
      Validator.schemas[key] = Validator.getSchemaRaw(config.views[view].schema, config.schemaOpts);
    }
    return Validator.schemas[key];
  }

  static getSchemaRaw(schema: any, opts: any = {}): mg.Schema {
    return new mongoose.Schema(schema, opts);
  }

  static async validateRaw<T>(o: T, schema: mg.Schema): Promise<T> {
    let doc = new mongoose.Document(o, schema);
    await doc.validate();
    return o;
  }

  static async validateAllRaw<T>(obj: T[], schema: mg.Schema): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => Validator.validateRaw(o, schema)));
  }

  static async validate<T extends ModelCore>(o: T, view?: string): Promise<T> {
    return await Validator.validateRaw(o, Validator.getSchema(getCls(o), view));
  }

  static async validateAll<T extends ModelCore>(obj: T[], view?: string): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => Validator.validate(o, view)));
  }
}