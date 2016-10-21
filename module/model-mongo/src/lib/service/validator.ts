import * as mg from "mongoose";
import { Base, Named } from '../model';
import { nodeToPromise } from '../../util';

let mongoose = require('mongoose/lib/browser');
mongoose.Document = require('mongoose/lib/browserDocument.js');

export class Validator {

  static getSchema(schema: {}, opts: mg.SchemaOptions = {}): mg.Schema {
    return new mongoose.Schema(schema, opts);
  }

  static async validate<T>(o: T, schema: {}): Promise<T> {
    let doc = new mongoose.Document(o, schema);
    await doc.validate();
    return o;
  }

  static async validateAll<T>(obj: T[], schema: {}[]): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => Validator.validate(o, schema[i])));
  }
}