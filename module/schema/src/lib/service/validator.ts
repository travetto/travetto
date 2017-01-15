import * as mg from 'mongoose';
import { Cls } from './types';
import { SchemaRegistry } from './registry';

let mongoose = require('mongoose/lib/browser');
mongoose.Document = require('mongoose/lib/browserDocument.js');

export class Validator {

  static schemas: { [cls: string]: mg.Schema } = {};

  static getCls<T>(o: T): Cls<T> {
    return o.constructor as any;
  }

  static getSchema<T>(cls: Cls<T>, view: string = SchemaRegistry.DEFAULT_VIEW) {
    const key = `${cls.name}::${view}`;
    if (!Validator.schemas[key]) {
      let config = SchemaRegistry.schemas[cls.name];
      if (!config || !config.views[view]) {
        throw new Error(`Unknown view found: ${view}`);
      }
      Validator.schemas[key] = Validator.getSchemaRaw(config.views[view].schema);
    }
    return Validator.schemas[key];
  }

  static getSchemaRaw(schema: any, opts: mg.SchemaOptions = {}): mg.Schema {
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

  static async validate<T>(o: T, view?: string): Promise<T> {
    return await Validator.validateRaw(o, Validator.getSchema(Validator.getCls(o), view));
  }

  static async validateAll<T>(obj: T[], view?: string): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => Validator.validate(o, view)));
  }
}